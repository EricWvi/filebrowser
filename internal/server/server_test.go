package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"filebrowser/internal/favorites"
	"filebrowser/internal/files"
)

func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	base := t.TempDir()
	root := filepath.Join(base, "root")
	mk := func(rel, content string) {
		p := filepath.Join(root, filepath.FromSlash(rel))
		os.MkdirAll(filepath.Dir(p), 0o755)
		if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	mk("docs/README.md", "# hi")
	mk("page.html", "<script>alert(1)</script>")
	mk("pic.svg", `<svg xmlns="http://www.w3.org/2000/svg"/>`)
	mk("blob.bin", "\x00\x01")
	mk("中文 名.txt", "x")
	os.WriteFile(filepath.Join(base, "secret"), []byte("s"), 0o644)
	os.Symlink(filepath.Join(base, "secret"), filepath.Join(root, "escape"))

	tree, err := files.Open(root)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { tree.Close() })
	favs, err := favorites.Open(filepath.Join(base, "config", "fav.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { favs.Close() })
	web := fstest.MapFS{"index.html": {Data: []byte("<html>app</html>")}}
	h, err := New(tree, favs, web, Options{Name: "projects"})
	if err != nil {
		t.Fatal(err)
	}
	return h
}

func do(h http.Handler, method, target, body string, hdr ...string) *httptest.ResponseRecorder {
	var req *http.Request
	if body != "" {
		req = httptest.NewRequest(method, target, strings.NewReader(body))
	} else {
		req = httptest.NewRequest(method, target, nil)
	}
	for i := 0; i+1 < len(hdr); i += 2 {
		req.Header.Set(hdr[i], hdr[i+1])
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestListAndStat(t *testing.T) {
	h := newTestServer(t)
	rec := do(h, "GET", "/api/list?path=/", "")
	if rec.Code != 200 {
		t.Fatalf("list: %d %s", rec.Code, rec.Body)
	}
	var entries []files.Entry
	json.Unmarshal(rec.Body.Bytes(), &entries)
	if len(entries) == 0 || entries[0].Name != "docs" {
		t.Fatalf("entries = %+v", entries)
	}
	for _, e := range entries {
		if e.Name == "escape" {
			t.Fatal("symlink leaving the root is listed")
		}
	}

	for target, code := range map[string]int{
		"/api/stat?path=/docs/README.md": 200,
		"/api/stat?path=/missing":        404,
		"/api/stat?path=/../secret":      400,
		"/api/stat?path=/escape":         404,
		"/api/list?path=/page.html":      400,
		"/api/nope":                      404,
	} {
		if rec := do(h, "GET", target, ""); rec.Code != code {
			t.Errorf("%s: %d, want %d (%s)", target, rec.Code, code, rec.Body)
		}
	}
}

func TestRawHeaders(t *testing.T) {
	h := newTestServer(t)
	cases := []struct {
		path, ct, disposition string
	}{
		{"/page.html", "text/plain; charset=utf-8", "inline"},
		{"/pic.svg", "image/svg+xml", "inline"},
		{"/blob.bin", "application/octet-stream", "attachment"},
	}
	for _, c := range cases {
		rec := do(h, "GET", "/api/raw?path="+c.path, "")
		if rec.Code != 200 {
			t.Fatalf("%s: %d", c.path, rec.Code)
		}
		if got := rec.Header().Get("Content-Type"); got != c.ct {
			t.Errorf("%s content-type = %q, want %q", c.path, got, c.ct)
		}
		if got := rec.Header().Get("Content-Disposition"); !strings.HasPrefix(got, c.disposition) {
			t.Errorf("%s disposition = %q", c.path, got)
		}
		if !strings.Contains(rec.Header().Get("Content-Security-Policy"), "sandbox") {
			t.Errorf("%s has no sandbox CSP", c.path)
		}
	}
	rec := do(h, "GET", "/api/raw?path=/"+"%E4%B8%AD%E6%96%87%20%E5%90%8D.txt&download=1", "")
	if got := rec.Header().Get("Content-Disposition"); !strings.HasPrefix(got, "attachment") || !strings.Contains(got, "filename*=") {
		t.Errorf("non-ASCII download disposition = %q", got)
	}
	rec = do(h, "GET", "/api/raw?path=/docs/README.md", "", "Range", "bytes=2-")
	if rec.Code != http.StatusPartialContent || rec.Body.String() != "hi" {
		t.Errorf("range: %d %q", rec.Code, rec.Body)
	}
	if rec := do(h, "GET", "/api/raw?path=/escape", ""); rec.Code != 404 {
		t.Errorf("raw escape: %d", rec.Code)
	}
}

func TestFavorites(t *testing.T) {
	h := newTestServer(t)
	for _, p := range []string{"/docs", "/docs/README.md", "/docs"} {
		if rec := do(h, "PUT", "/api/favorites", `{"path":"`+p+`"}`); rec.Code != 204 {
			t.Fatalf("add %s: %d %s", p, rec.Code, rec.Body)
		}
	}
	if rec := do(h, "PUT", "/api/favorites", `{"path":"/missing"}`); rec.Code != 404 {
		t.Errorf("add missing: %d", rec.Code)
	}
	if rec := do(h, "PUT", "/api/favorites", `{"path":"/docs"}`, "Sec-Fetch-Site", "cross-site"); rec.Code != 403 {
		t.Errorf("cross-site add: %d", rec.Code)
	}

	var favs []favorite
	json.Unmarshal(do(h, "GET", "/api/favorites", "").Body.Bytes(), &favs)
	if len(favs) != 2 || favs[0].Path != "/docs" || !favs[0].Dir || favs[1].Path != "/docs/README.md" {
		t.Fatalf("favorites = %+v", favs)
	}

	if rec := do(h, "DELETE", "/api/favorites?path=/docs", ""); rec.Code != 204 {
		t.Fatalf("remove: %d", rec.Code)
	}
	json.Unmarshal(do(h, "GET", "/api/favorites", "").Body.Bytes(), &favs)
	if len(favs) != 1 {
		t.Fatalf("after remove = %+v", favs)
	}
}

func TestAppShell(t *testing.T) {
	h := newTestServer(t)
	for _, p := range []string{"/", "/files/docs/README.md", "/files/docs"} {
		if rec := do(h, "GET", p, ""); rec.Code != 200 || !strings.Contains(rec.Body.String(), "app") {
			t.Errorf("%s: %d", p, rec.Code)
		}
	}
	if rec := do(h, "GET", "/assets/missing.js", ""); rec.Code != 404 {
		t.Errorf("missing asset: %d", rec.Code)
	}
}
