// Package server exposes the read-only tree, raw file access and favorites
// over HTTP, and serves the embedded frontend.
//
// Authentication is the reverse proxy's job (Caddy forward_auth to Authelia);
// the server trusts every request that reaches it.
package server

import (
	"encoding/json"
	"errors"
	"io/fs"
	"log/slog"
	"mime"
	"net/http"
	"path"
	"strings"

	"filebrowser/internal/favorites"
	"filebrowser/internal/files"
)

// Options configures the server.
type Options struct {
	// Name is shown for the mount root, e.g. "projects".
	Name    string
	Version string
}

type server struct {
	tree *files.Tree
	favs *favorites.Store
	opts Options
}

// New returns the HTTP handler.
func New(tree *files.Tree, favs *favorites.Store, web fs.FS, opts Options) (http.Handler, error) {
	st, err := newStatic(web)
	if err != nil {
		return nil, err
	}
	s := &server{tree: tree, favs: favs, opts: opts}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/info", s.info)
	mux.HandleFunc("GET /api/list", s.list)
	mux.HandleFunc("GET /api/stat", s.stat)
	mux.HandleFunc("GET /api/raw", s.raw)
	mux.HandleFunc("GET /api/favorites", s.listFavorites)
	mux.HandleFunc("PUT /api/favorites", s.sameOrigin(s.addFavorite))
	mux.HandleFunc("DELETE /api/favorites", s.sameOrigin(s.removeFavorite))
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		httpError(w, http.StatusNotFound, "not found")
	})
	mux.Handle("/", st)
	return mux, nil
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Warn("write response", "err", err)
	}
}

func httpError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// fsError maps tree errors to HTTP responses.
func fsError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, files.ErrInvalidPath):
		httpError(w, http.StatusBadRequest, "invalid path")
	case errors.Is(err, fs.ErrNotExist):
		httpError(w, http.StatusNotFound, "not found")
	case errors.Is(err, files.ErrNotDir):
		httpError(w, http.StatusBadRequest, "not a directory")
	case errors.Is(err, files.ErrIsDir):
		httpError(w, http.StatusBadRequest, "is a directory")
	case errors.Is(err, fs.ErrPermission):
		httpError(w, http.StatusForbidden, "permission denied")
	default:
		// os.Root reports paths escaping the mount as plain errors.
		if strings.Contains(err.Error(), "escapes from parent") {
			httpError(w, http.StatusNotFound, "not found")
			return
		}
		slog.Error("filesystem", "path", r.URL.Query().Get("path"), "err", err)
		httpError(w, http.StatusInternalServerError, "internal error")
	}
}

// sameOrigin rejects cross-site writes. The proxy's auth cookie would
// otherwise let any site change favorites on the owner's behalf.
func (s *server) sameOrigin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if site := r.Header.Get("Sec-Fetch-Site"); site != "" && site != "same-origin" && site != "none" {
			httpError(w, http.StatusForbidden, "cross-site request")
			return
		}
		next(w, r)
	}
}

func (s *server) info(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"name": s.opts.Name, "version": s.opts.Version})
}

func (s *server) list(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	entries, err := s.tree.List(q.Get("path"), q.Get("hidden") == "1")
	if err != nil {
		fsError(w, r, err)
		return
	}
	writeJSON(w, entries)
}

func (s *server) stat(w http.ResponseWriter, r *http.Request) {
	e, err := s.tree.Stat(r.URL.Query().Get("path"))
	if err != nil {
		fsError(w, r, err)
		return
	}
	writeJSON(w, e)
}

// inlineTypes may be shown in the browser as-is. Everything else is sent
// as text/plain (when it is text) or as a download, so a stored HTML or JS
// file never runs on this origin.
func inlineType(name string) string {
	ct := mime.TypeByExtension(path.Ext(name))
	base, _, _ := mime.ParseMediaType(ct)
	switch {
	case strings.HasPrefix(base, "image/"), strings.HasPrefix(base, "video/"),
		strings.HasPrefix(base, "audio/"), base == "application/pdf":
		return ct
	}
	return ""
}

func (s *server) raw(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f, e, err := s.tree.OpenFile(q.Get("path"))
	if err != nil {
		fsError(w, r, err)
		return
	}
	defer f.Close()

	h := w.Header()
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Cache-Control", "no-cache")
	ct := inlineType(e.Name)
	if ct == "" {
		ct = "application/octet-stream"
		if st, err := s.tree.Stat(e.Path); err == nil && st.Text != nil && *st.Text {
			ct = "text/plain; charset=utf-8"
		}
	}
	h.Set("Content-Type", ct)
	// Scripts inside SVG or anything else opened directly must not run here.
	// Chrome refuses to show PDFs in a sandboxed document, so PDFs are exempt.
	if !strings.HasPrefix(ct, "application/pdf") {
		h.Set("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'")
	}
	disposition := "inline"
	if q.Get("download") == "1" || ct == "application/octet-stream" {
		disposition = "attachment"
	}
	h.Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": e.Name}))

	info, err := f.Stat()
	if err != nil {
		fsError(w, r, err)
		return
	}
	http.ServeContent(w, r, "", info.ModTime(), f)
}

// favorite is a favorite path with its current state in the tree.
type favorite struct {
	files.Entry
	Missing bool `json:"missing,omitempty"`
}

func (s *server) listFavorites(w http.ResponseWriter, r *http.Request) {
	paths, err := s.favs.List(r.Context())
	if err != nil {
		slog.Error("list favorites", "err", err)
		httpError(w, http.StatusInternalServerError, "internal error")
		return
	}
	out := make([]favorite, 0, len(paths))
	for _, p := range paths {
		e, err := s.tree.Lookup(p)
		if err != nil {
			out = append(out, favorite{Entry: files.Entry{Name: path.Base(p), Path: p}, Missing: true})
			continue
		}
		out = append(out, favorite{Entry: e})
	}
	writeJSON(w, out)
}

func (s *server) addFavorite(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&body); err != nil {
		httpError(w, http.StatusBadRequest, "invalid body")
		return
	}
	e, err := s.tree.Lookup(body.Path)
	if err != nil {
		fsError(w, r, err)
		return
	}
	if e.Path == "/" {
		httpError(w, http.StatusBadRequest, "the root cannot be a favorite")
		return
	}
	if err := s.favs.Add(r.Context(), e.Path); err != nil {
		slog.Error("add favorite", "err", err)
		httpError(w, http.StatusInternalServerError, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) removeFavorite(w http.ResponseWriter, r *http.Request) {
	// Missing paths can still be removed, so only the syntax is checked.
	p, err := files.Clean(r.URL.Query().Get("path"))
	if err != nil {
		fsError(w, r, err)
		return
	}
	if err := s.favs.Remove(r.Context(), p); err != nil {
		slog.Error("remove favorite", "err", err)
		httpError(w, http.StatusInternalServerError, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
