#!/usr/bin/env sh
# Compresses the creature GLBs exported by build_enemies.py into the game's copies.
#   usage: sh tools/blender/compress_enemies.sh <folder with Blender exports> [kind ...]
#
# simplify 55% + meshopt (public/assets/models/characters/enemy_<kind>.glb). A creature is never seen closer than
# the camera's 7 m and is one mesh per material: 14–19k triangles came down to 8–12k with the eyes, the spines and
# the painted socks intact (checked in the studio: ?studio=enemies). No light copy: past the fog they are not drawn.
#
# GT: the gltf-transform CLI. Default: the copy already in the npm cache (nothing is downloaded).
set -e
SRC="$1"; shift
OUT="$(dirname "$0")/../../public/assets/models/characters"
GT="${GT:-$LOCALAPPDATA/npm-cache/_npx/425967af1abfabd4/node_modules/.bin/gltf-transform}"
KINDS="$*"
[ -z "$KINDS" ] && KINDS=$(cd "$SRC" && ls enemy_*.glb | sed 's/^enemy_//; s/\.glb$//')
TMP=$(mktemp -d)
for k in $KINDS; do
  "$GT" simplify "$SRC/enemy_$k.glb" "$TMP/enemy_$k.glb" --ratio 0.55 --error 0.002
  "$GT" meshopt "$TMP/enemy_$k.glb" "$OUT/enemy_$k.glb"
done
rm -rf "$TMP"
