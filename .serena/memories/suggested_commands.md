# Development Commands

## Core Commands
- `bun run start` - Run app (supports --trip, --page, --data-dir)
- `bun run check:type` - Type checking (tsc)
- `bun run check` - Linting and formatting (Biome)
- `bun run fix` - Auto-fix lint and format issues
- `bun test` - Run all tests
- `bun test <path>` - Run single test file
- `bun test <dir>/` - Run tests in directory

## Git Workflow
- Commit on main branch after each task
- Never use --no-verify or --amend
- Use HEREDOC for multi-line commit messages
- Append Co-Authored-By trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
