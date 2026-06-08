#!/bin/bash
# Auto-increments ?v=N in index.html when a js/*.js or css/*.css file is edited.
# Called as a PostToolUse hook; reads Claude tool JSON from stdin.

f=$(jq -r '.tool_input.file_path // empty')
echo "$f" | grep -qE '/(js|css)/[^/]+\.(js|css)$' || exit 0

base=$(basename "$f")
index="/Users/dg/IdeaProjects/BSP/index.html"

perl -i -pe "s/(\Q${base}\E\?v=)(\d+)/\$1.(\$2+1)/ge" "$index"
