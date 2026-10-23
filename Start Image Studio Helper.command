#!/bin/zsh
# Double-click to let the live Image Studio website make images with this Mac's ChatGPT plan.
# Keep this window open. The Mac won't go to sleep while the helper runs. Close the window (or Ctrl-C) to stop.
cd "$(dirname "$0")"
export PATH="/opt/homebrew/opt/node@22/bin:$HOME/.local/bin:$PATH"
if ! command -v node >/dev/null; then echo "Node.js 22 isn't installed. Install it with: brew install node@22"; read; exit 1; fi
if ! command -v codex >/dev/null; then echo "Codex isn't installed. Run: npm install -g @openai/codex  then: codex login"; read; exit 1; fi
[ -d node_modules ] || npm install || { read; exit 1; }
caffeinate -i npm run helper
