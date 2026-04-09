---
created: 2026-04-08T00:00:00Z
title: Debug Playground block registration
area: compatibility
files:
  - /Users/danknauss/Developer/GitHub/wp-bibliography-block/block.json
  - /Users/danknauss/Developer/GitHub/wp-bibliography-block/webpack.config.js
  - /Users/danknauss/Developer/GitHub/wp-bibliography-block/.blueprint.json
---

## Problem

The bibliography block does not appear in the WordPress Playground block editor.
The `block.json`, build config, and e2e blueprint all look correct and `--auto-mount`
should mount the plugin directory. Most likely a runtime JS error prevents block
registration from completing.

## Requires

A browser-capable Claude session:
`/Users/danknauss/bin/claude-playwright` or `/Users/danknauss/bin/claude-browser-handoff`

## Investigation approach

1. Open the Playground session with the bibliography blueprint
2. Open the browser console before inserting a block
3. Check for JS errors on page load and during block registration
4. Check whether the block appears in the inserter at all
5. Check the Network tab for failed asset loads (chunk files, CSL templates)

## Acceptance targets

- Bibliography block appears in the Playground block inserter
- No JS errors on block registration
- Block can be inserted and a citation pasted without errors
