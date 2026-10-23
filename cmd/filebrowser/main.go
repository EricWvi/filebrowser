// Command filebrowser serves a read-only directory for browsing on phones.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"filebrowser"
	"filebrowser/internal/favorites"
	"filebrowser/internal/files"
	"filebrowser/internal/server"
)

// Set at build time with -ldflags "-X main.version=... -X main.commit=...".
var (
	version = "dev"
	commit  = "unknown"
)

func main() {
	listen := flag.String("listen", ":8090", "listen address")
	root := flag.String("root", "/data", "directory to browse (mount it read-only)")
	name := flag.String("name", "", "display name of the root (default: base name of -root)")
	db := flag.String("db", "/config/filebrowser.db", "SQLite database for favorites; must be writable")
	showVersion := flag.Bool("version", false, "print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Printf("filebrowser %s (%s)\n", version, commit)
		return
	}
	if err := run(*listen, *root, *name, *db); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run(listen, root, name, db string) error {
	tree, err := files.Open(root)
	if err != nil {
		return err
	}
	defer tree.Close()
	favs, err := favorites.Open(db)
	if err != nil {
		return err
	}
	defer favs.Close()

	if name == "" {
		name = filepath.Base(filepath.Clean(root))
	}
	handler, err := server.New(tree, favs, filebrowser.Frontend(), server.Options{Name: name, Version: version})
	if err != nil {
		return err
	}
	srv := &http.Server{Addr: listen, Handler: handler, ReadHeaderTimeout: 10 * time.Second}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	errc := make(chan error, 1)
	go func() {
		slog.Info("listening", "addr", listen, "root", root, "db", db, "version", version)
		errc <- srv.ListenAndServe()
	}()
	select {
	case err := <-errc:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	case <-ctx.Done():
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
