# filebrowser

A read-only file browser for phones: browse a mounted directory, read code with
highlighting and line numbers, and read Markdown with Mermaid and KaTeX.
Files and folders can be favorited; favorites appear on the home page.

- Go server (`cmd/filebrowser`) with the React frontend (`frontend/`) embedded.
- Every path goes through `os.Root`: `..` and symlinks leaving the mount are rejected.
- No login of its own. Put it behind an authenticating proxy (Caddy `forward_auth` to Authelia).
- Favorites live in SQLite in a writable config volume; the browsed directory is never written.

## Development

```sh
task install:frontend
task run:server            # serves the parent directory on :8090; ROOT=/some/dir to change
task run:web               # Vite on :5173, proxies /api to :8090
task test                  # typecheck, gofmt, vet, go test
task build                 # release/filebrowser with the frontend embedded
```

`web-prototype/` is the throwaway UI prototype with mock data (`task run:prototype`,
variants via `?variant=A|B|C`); variant B is what the app implements.

## Flags

| Flag | Default | |
|---|---|---|
| `-listen` | `:8090` | listen address |
| `-root` | `/data` | directory to browse; mount it read-only |
| `-name` | base name of `-root` | name shown for the root |
| `-db` | `/config/filebrowser.db` | favorites database; must be writable |

## Deployment

Images are published to GHCR by the release workflow on `v*` tags.

```yaml
services:
  filebrowser:
    image: ghcr.io/ericwvi/filebrowser:0.1.0
    restart: unless-stopped
    user: "1000:1000"            # must be able to read the mount and write /config
    command: ["-listen", ":8090", "-root", "/data", "-name", "projects", "-db", "/config/filebrowser.db"]
    volumes:
      - /home/eric/projects:/data:ro
      - /root/only/selfhost/filebrowser:/config
```

```caddyfile
files.example.com {
	forward_auth authelia:9091 {
		uri /api/authz/forward-auth
		copy_headers Remote-User Remote-Groups Remote-Email Remote-Name
	}
	reverse_proxy filebrowser:8090
}
```

## API

| Route | |
|---|---|
| `GET /api/info` | root name and version |
| `GET /api/list?path=/a&hidden=1` | children, directories first; dotfiles and `node_modules`, `__pycache__`, `target`, `dist` only with `hidden=1` |
| `GET /api/stat?path=/a/b` | one entry; files carry `text` (UTF-8 sniff) |
| `GET /api/raw?path=/a/b[&download=1]` | file content with Range support; only images, audio, video and PDF are served inline as themselves, other text as `text/plain`, the rest as a download; responses carry a sandbox CSP |
| `GET /api/favorites` | favorites with their current entry, or `missing` |
| `PUT /api/favorites` | `{"path": "/a"}` |
| `DELETE /api/favorites?path=/a` | |
