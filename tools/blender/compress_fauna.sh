#!/usr/bin/env sh
# Compresses the deer GLBs exported by build_fauna.py into the game's copies.
#   usage: sh tools/blender/compress_fauna.sh <folder with Blender exports> [kind ...]
#
# simplify + meshopt (public/assets/models/characters/fauna_<kind>.glb), as the creatures' (compress_enemies.sh),
# with a finer error so the white spots keep their shape. No light copy: a DistanceCull hides the herds from afar.
#
# GT: the gltf-transform CLI. Default: the copy already in the npm cache (nothing is downloaded).
set -e
SRC="$1"; shift
OUT="$(dirname "$0")/../../public/assets/models/characters"
GT="${GT:-$LOCALAPPDATA/npm-cache/_npx/425967af1abfabd4/node_modules/.bin/gltf-transform}"
KINDS="$*"
[ -z "$KINDS" ] && KINDS="cervo cerva filhote"
TMP=$(mktemp -d)
for k in $KINDS; do
  "$GT" simplify "$SRC/fauna_$k.glb" "$TMP/fauna_$k.glb" --ratio 0.5 --error 0.0015
  "$GT" meshopt "$TMP/fauna_$k.glb" "$OUT/fauna_$k.glb"
done
rm -rf "$TMP"
