- 工作过程中临时文件放在各级工作目录的 .tmp 下，例如 clone 的源码等。
- 脚本所需依赖也放到 .tmp 下，例如 Python venv。
- 工作区下如果有 memories，先读 memories/AGENTS.md，再按其指引了解与当前项目有关的记忆。
- 工作区下如果有 specs，先读 specs/AGENTS.md。

## Commands

Project commands live in `Taskfile.yml`; run `task --list` to see them all. Run `task test` before considering a change complete.

- `task run:server` + `task run:web`: develop against a real directory (default: the parent directory).
- `task build`: release binary with the frontend embedded.
- `web-prototype/` is the mock-data UI prototype kept for reference; the app implements its variant B.
