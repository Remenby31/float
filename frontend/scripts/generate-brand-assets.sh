#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
command -v rsvg-convert >/dev/null || { echo 'rsvg-convert (librsvg) is required to render SVG assets.' >&2; exit 1; }
command -v zip >/dev/null || { echo 'zip is required to package the brand kit.' >&2; exit 1; }

rsvg-convert -w 512 -h 512 public/brand/mark.svg -o public/icon-512.png
rsvg-convert -w 192 -h 192 public/brand/mark.svg -o public/icon-192.png
rsvg-convert -w 180 -h 180 public/brand/mark.svg -o public/apple-touch-icon.png
rsvg-convert -w 32 -h 32 public/favicon.svg -o public/favicon.png
rsvg-convert -w 1200 -h 630 public/brand/social-card.svg -o public/brand/social-card.png

zip -j -q public/brand/float-daybook-kit.zip \
  ../docs/brand/branding-kit.md ../docs/brand/visual-style.md \
  public/brand/wordmark-ink.svg public/brand/wordmark-paper.svg \
  public/brand/mark.svg public/brand/palette.svg public/brand/tokens.json \
  public/brand/social-card.svg public/brand/social-card.png \
  public/icon-192.png public/icon-512.png public/apple-touch-icon.png \
  public/favicon.svg public/favicon.png

echo 'Float brand assets rendered and packaged.'
