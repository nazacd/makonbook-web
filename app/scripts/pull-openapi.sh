#!/usr/bin/env sh
# Fetches the API contract from nazacd/makonbook-api (main) into api/, and
# records which commit it came from. Then run `npm run gen`.
set -eu
cd "$(dirname "$0")/.."
REPO=nazacd/makonbook-api
SHA=$(curl -fsSL "https://api.github.com/repos/$REPO/commits/main" | sed -n 's/^  "sha": "\([0-9a-f]*\)",$/\1/p' | head -1)
[ -n "$SHA" ] || { echo "could not read the latest commit of $REPO" >&2; exit 1; }
curl -fsSL "https://raw.githubusercontent.com/$REPO/$SHA/api/openapi.yaml" -o api/openapi.yaml
echo "$SHA" > api/SOURCE
echo "api/openapi.yaml from $REPO@$SHA"
