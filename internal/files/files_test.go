package files

import (
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
)

func write(t *testing.T, root, rel, content string) {
	t.Helper()
	p := filepath.Join(root, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func setup(t *testing.T) (*Tree, string) {
	t.Helper()
	base := t.TempDir()
	root := filepath.Join(base, "root")
	write(t, root, "b.txt", "hello")
	write(t, root, "A.md", "# a")
	write(t, root, "src/main.go", "package main")
	write(t, root, "src/.env", "X=1")
	write(t, root, ".git/HEAD", "ref")
	write(t, root, "node_modules/x/index.js", "")
	write(t, root, "bin.dat", "a\x00b")
	write(t, base, "outside.txt", "secret")
	if err := os.Symlink(filepath.Join(base, "outside.txt"), filepath.Join(root, "escape")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("src", filepath.Join(root, "link")); err != nil {
		t.Fatal(err)
	}
	tr, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { tr.Close() })
	return tr, root
}

func names(es []Entry) []string {
	out := make([]string, len(es))
	for i, e := range es {
		out[i] = e.Name
	}
	return out
}

func TestListSortsAndHides(t *testing.T) {
	tr, _ := setup(t)
	got, err := tr.List("/", false)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"link", "src", "A.md", "b.txt", "bin.dat"}
	if g := names(got); len(g) != len(want) {
		t.Fatalf("got %v, want %v", g, want)
	}
	for i, n := range want {
		if got[i].Name != n {
			t.Fatalf("got %v, want %v", names(got), want)
		}
	}
	if got[1].Path != "/src" || got[1].Count == nil || *got[1].Count != 1 {
		t.Fatalf("src entry = %+v, want path /src and count 1 (.env hidden)", got[1])
	}

	all, err := tr.List("/", true)
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != len(want)+2 {
		t.Fatalf("with hidden got %v", names(all))
	}
}

func TestPathsCannotEscape(t *testing.T) {
	tr, _ := setup(t)
	for _, p := range []string{"../outside.txt", "/../outside.txt", "/src/../../outside.txt", "relative", "/a\\b"} {
		if _, err := tr.Stat(p); !errors.Is(err, ErrInvalidPath) {
			t.Errorf("Stat(%q) err = %v, want ErrInvalidPath", p, err)
		}
	}
	if _, _, err := tr.OpenFile("/escape"); err == nil {
		t.Error("OpenFile followed a symlink out of the root")
	}
	if _, err := tr.Stat("/escape"); err == nil {
		t.Error("Stat followed a symlink out of the root")
	}
}

func TestStatAndOpen(t *testing.T) {
	tr, _ := setup(t)
	e, err := tr.Stat("/link/main.go")
	if err != nil {
		t.Fatal(err)
	}
	if e.Name != "main.go" || e.Dir || e.Text == nil || !*e.Text {
		t.Fatalf("Stat = %+v", e)
	}
	bin, err := tr.Stat("/bin.dat")
	if err != nil || *bin.Text {
		t.Fatalf("binary Stat = %+v, %v", bin, err)
	}
	if _, err := tr.Stat("/missing"); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("missing err = %v", err)
	}
	if _, err := tr.List("/b.txt", false); !errors.Is(err, ErrNotDir) {
		t.Fatalf("List(file) err = %v", err)
	}
	if _, _, err := tr.OpenFile("/src"); !errors.Is(err, ErrIsDir) {
		t.Fatalf("OpenFile(dir) err = %v", err)
	}
	f, _, err := tr.OpenFile("/b.txt")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	b, _ := io.ReadAll(f)
	if string(b) != "hello" {
		t.Fatalf("content = %q", b)
	}
}

func TestLooksText(t *testing.T) {
	cut := []byte("ab中")[:4] // "中" is 3 bytes; keep only the first
	if !looksText(cut, true) {
		t.Error("truncated rune at the end should still count as text")
	}
	if looksText(cut, false) {
		t.Error("an invalid rune in a complete file is not text")
	}
	if !looksText(nil, false) {
		t.Error("empty file is text")
	}
}
