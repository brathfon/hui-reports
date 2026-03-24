#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec "$SCRIPT_DIR/../node_modules/.bin/tsx" "$SCRIPT_DIR/import-sheet-data.ts" "$@"
