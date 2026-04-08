#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
RELEASE_ROOT="$ROOT_DIR/output/release"
STAGING_DIR="$RELEASE_ROOT/scholarly-bibliography"
ZIP_PATH="$RELEASE_ROOT/bibliography-block.zip"

mkdir -p "$RELEASE_ROOT"
rm -rf "$STAGING_DIR" "$ZIP_PATH"
mkdir -p "$STAGING_DIR"

cp "$ROOT_DIR/scholarly-bibliography.php" "$STAGING_DIR/"
cp "$ROOT_DIR/block.json" "$STAGING_DIR/"
cp "$ROOT_DIR/readme.txt" "$STAGING_DIR/"
cp "$ROOT_DIR/LICENSE" "$STAGING_DIR/"
cp -R "$ROOT_DIR/build" "$STAGING_DIR/build"

(
	cd "$RELEASE_ROOT"
	zip -rq "$(basename "$ZIP_PATH")" "$(basename "$STAGING_DIR")"
)

printf 'Created release staging directory: %s\n' "$STAGING_DIR"
printf 'Created release zip: %s\n' "$ZIP_PATH"
