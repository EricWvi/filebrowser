// Package files gives read-only access to the mounted directory.
//
// Every access goes through an os.Root, so client paths cannot leave the
// mount: ".." segments and symlinks pointing outside are rejected.
package files

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"sort"
	"strings"
	"unicode/utf8"
)

// ErrInvalidPath reports a client path that is not a clean absolute path.
var ErrInvalidPath = errors.New("invalid path")

// ErrNotDir reports a listing request for a file.
var ErrNotDir = errors.New("not a directory")

// ErrIsDir reports a file request for a directory.
var ErrIsDir = errors.New("is a directory")

// Entry describes one file or directory. Path is slash-separated and
// absolute within the mount ("/" is the mount itself).
type Entry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	Dir   bool   `json:"dir"`
	Size  int64  `json:"size"`
	MTime int64  `json:"mtime"` // unix milliseconds
	// Count is the number of visible children; set for directories in a listing.
	Count *int `json:"count,omitempty"`
	// Text reports whether a file looks like UTF-8 text; set by Stat only.
	Text *bool `json:"text,omitempty"`
}

// hiddenNames are dependency and build directories hidden by default,
// in addition to every dotfile.
var hiddenNames = map[string]bool{
	"node_modules": true,
	"__pycache__":  true,
	"target":       true,
	"dist":         true,
}

// Hidden reports whether name is hidden unless the client asks for hidden entries.
func Hidden(name string) bool {
	return strings.HasPrefix(name, ".") || hiddenNames[name]
}

// Tree is a read-only view of one directory.
type Tree struct {
	root *os.Root
	fsys fs.FS
}

// Open opens dir as the tree root.
func Open(dir string) (*Tree, error) {
	root, err := os.OpenRoot(dir)
	if err != nil {
		return nil, fmt.Errorf("open root: %w", err)
	}
	return &Tree{root: root, fsys: root.FS()}, nil
}

// Close releases the root directory.
func (t *Tree) Close() error { return t.root.Close() }

// Clean validates a client path and returns it in canonical form ("/a/b").
func Clean(p string) (string, error) {
	if p == "" {
		return "/", nil
	}
	if !strings.HasPrefix(p, "/") || strings.ContainsRune(p, 0) || strings.Contains(p, "\\") {
		return "", ErrInvalidPath
	}
	c := path.Clean(p)
	// Clean resolves "/a/../b"; refuse it so the client sees the path it sent.
	for _, seg := range strings.Split(p, "/") {
		if seg == ".." {
			return "", ErrInvalidPath
		}
	}
	return c, nil
}

func fsName(p string) string {
	if p == "/" {
		return "."
	}
	return p[1:]
}

func entryOf(p string, info fs.FileInfo) Entry {
	name := path.Base(p)
	if p == "/" {
		name = ""
	}
	e := Entry{Name: name, Path: p, Dir: info.IsDir(), MTime: info.ModTime().UnixMilli()}
	if !e.Dir {
		e.Size = info.Size()
	}
	return e
}

// Lookup describes the entry at p without reading it.
func (t *Tree) Lookup(p string) (Entry, error) {
	p, err := Clean(p)
	if err != nil {
		return Entry{}, err
	}
	info, err := fs.Stat(t.fsys, fsName(p))
	if err != nil {
		return Entry{}, err
	}
	return entryOf(p, info), nil
}

// Stat is Lookup plus, for files, a sniff of whether the content is text.
func (t *Tree) Stat(p string) (Entry, error) {
	e, err := t.Lookup(p)
	if err != nil {
		return Entry{}, err
	}
	if !e.Dir {
		text, err := t.sniffText(e.Path)
		if err != nil {
			return Entry{}, err
		}
		e.Text = &text
	}
	return e, nil
}

// List returns the children of directory p, directories first, then by name.
// Hidden entries are skipped unless showHidden is set. Entries that cannot
// be resolved (e.g. symlinks leaving the mount) are skipped.
func (t *Tree) List(p string, showHidden bool) ([]Entry, error) {
	p, err := Clean(p)
	if err != nil {
		return nil, err
	}
	info, err := fs.Stat(t.fsys, fsName(p))
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return nil, ErrNotDir
	}
	dirents, err := fs.ReadDir(t.fsys, fsName(p))
	if err != nil {
		return nil, err
	}
	out := make([]Entry, 0, len(dirents))
	for _, d := range dirents {
		if !showHidden && Hidden(d.Name()) {
			continue
		}
		child := path.Join(p, d.Name())
		info, err := fs.Stat(t.fsys, fsName(child)) // follows symlinks inside the root
		if err != nil {
			continue
		}
		e := entryOf(child, info)
		if e.Dir {
			n := t.countChildren(child, showHidden)
			e.Count = &n
		}
		out = append(out, e)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Dir != out[j].Dir {
			return out[i].Dir
		}
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	return out, nil
}

func (t *Tree) countChildren(p string, showHidden bool) int {
	f, err := t.fsys.Open(fsName(p))
	if err != nil {
		return 0
	}
	defer f.Close()
	rd, ok := f.(fs.ReadDirFile)
	if !ok {
		return 0
	}
	ents, _ := rd.ReadDir(-1)
	n := 0
	for _, e := range ents {
		if showHidden || !Hidden(e.Name()) {
			n++
		}
	}
	return n
}

// File is an open regular file.
type File interface {
	io.ReadSeeker
	io.Closer
	Stat() (fs.FileInfo, error)
}

// OpenFile opens the regular file at p for reading.
func (t *Tree) OpenFile(p string) (File, Entry, error) {
	p, err := Clean(p)
	if err != nil {
		return nil, Entry{}, err
	}
	f, err := t.root.Open(fsName(p))
	if err != nil {
		return nil, Entry{}, err
	}
	info, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, Entry{}, err
	}
	if info.IsDir() {
		f.Close()
		return nil, Entry{}, ErrIsDir
	}
	return f, entryOf(p, info), nil
}

const sniffLen = 8 << 10

// sniffText reports whether the first bytes of the file are valid UTF-8
// without NUL bytes. An empty file counts as text.
func (t *Tree) sniffText(p string) (bool, error) {
	f, err := t.fsys.Open(fsName(p))
	if err != nil {
		return false, err
	}
	defer f.Close()
	buf := make([]byte, sniffLen)
	n, err := io.ReadFull(f, buf)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		return false, err
	}
	return looksText(buf[:n], n == sniffLen), nil
}

func looksText(b []byte, truncated bool) bool {
	for _, c := range b {
		if c == 0 {
			return false
		}
	}
	if truncated {
		// The read may have cut a multi-byte rune in half.
		for i := 0; i < utf8.UTFMax && len(b) > 0; i++ {
			if utf8.Valid(b) {
				return true
			}
			b = b[:len(b)-1]
		}
	}
	return utf8.Valid(b)
}
