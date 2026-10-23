#!/bin/zsh
# Double-click to start Arnifi Image Studio on this Mac, then it opens in your browser.
# Leave this window open while you use the studio; close it (or press Ctrl-C) to stop.
cd "$(dirname "$0")"
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
if ! command -v node >/dev/null; then echo "Node.js 22 isn't installed. Install it with: brew install node@22"; read; exit 1; fi
[ -d node_modules ] || npm install || { read; exit 1; }
echo "Preparing Arnifi Image Studio… (about a minute)"
npm run build >/tmp/image-studio-build.log 2>&1 || { echo "The build failed — details in /tmp/image-studio-build.log"; read; exit 1; }
(sleep 3; open "http://127.0.0.1:3109/library") &
npm start
