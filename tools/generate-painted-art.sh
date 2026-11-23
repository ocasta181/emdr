#!/usr/bin/env bash
# Regenerates the hand-painted room art with the Codex CLI's built-in image generation
# (uses your ChatGPT sign-in; no API key needed). Writes JPEGs to assets/animated-room/painted/.
# Usage: tools/generate-painted-art.sh [room|orb|paper ...]   (no args = all)
# After regenerating room, re-measure the regions in src/renderer/animation/paintedRoom.ts.
set -euo pipefail

codex="${CODEX_BIN:-codex}"
command -v "$codex" >/dev/null 2>&1 || codex="/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex"
out_dir="$(cd "$(dirname "$0")/.." && pwd)/assets/animated-room/painted"
mkdir -p "$out_dir"

style="Style: hand-painted gouache and watercolor illustration with visible brush strokes and paper grain, soft edges, \
muted dusky palette of deep indigo, slate blue and warm amber, calm and contemplative storybook concept art. \
No text, no lettering, no people, no animals."

asset_prompt() {
  case "$1" in
    room) echo "Landscape 3:2 (1536x1024). A calm moonlit mountain overlook at night, seen from a low eye level. The lower \
third is a wide, flat, circular stone terrace whose center is left completely empty and open. On the far right of the \
terrace stands a traditional Japanese stone lantern glowing with warm amber light that softly lights the nearby stones. \
To the right of center, at the front of the terrace, rests a small old wooden chest with brass bands. Layered blue \
mountain ridges with drifting mist along the horizon, a soft full moon in the upper right, a quiet sky with scattered \
stars. Wide composition with plenty of open sky in the upper middle. ${style}" ;;
    orb) echo "Square 1024x1024 on a solid pure black (#000000) background, no transparency. A single small soft glowing orb \
of pale near-white light in the exact center, occupying about a third of the width. The bright core blooms outward like \
wet watercolor and fades smoothly into the pure black well before the image edges. Nothing else in the image." ;;
    paper) echo "Square 1024x1024. A seamless tileable texture of dark hand-painted paper: deep warm charcoal brown with very \
subtle gouache brush strokes and paper fibers, very low contrast, evenly lit, no objects, no vignette, no text." ;;
    *) echo "Unknown asset: $1" >&2; exit 1 ;;
  esac
}

if [ $# -eq 0 ]; then set -- room orb paper; fi

for name in "$@"; do
  echo "Generating ${name}…" >&2
  "$codex" exec --skip-git-repo-check --ephemeral -s workspace-write -C "$out_dir" \
    "Use your built-in image_gen tool to create exactly ONE image and save it in the current directory as ${name}.png. \
Do not create or edit any other files. $(asset_prompt "$name")" </dev/null >/dev/null
  sips -s format jpeg -s formatOptions 88 "${out_dir}/${name}.png" --out "${out_dir}/${name}.jpg" >/dev/null
  rm "${out_dir}/${name}.png"
  echo "  wrote ${out_dir}/${name}.jpg" >&2
done
