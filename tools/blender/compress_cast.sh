#!/usr/bin/env sh
# Compresses the villager GLBs exported by build_villager.py into the game's two copies.
#   usage: sh tools/blender/compress_cast.sh <folder with Blender exports> [name ...]
#
# Full copy (public/assets/models/characters/<name>.glb): meshopt only, NO simplify.
#   Simplifying the robe makes it sink a little, and the fur under it pokes through as blotches of body
#   colour (Kiko's stripes on her gi, Hana's cream fur on her pink robe). Seen in the art audit of §25.
# Light copy (characters/lod/<name>.glb): simplify 25% + meshopt. VillagerModel swaps it in past 11 m,
#   for every mesh except the robe (and the morphing face parts), which stay whole.
set -e
SRC="$1"; shift
OUT="$(dirname "$0")/../../public/assets/models/characters"
mkdir -p "$OUT/lod"
NAMES="$*"
[ -z "$NAMES" ] && NAMES=$(cd "$SRC" && ls *.glb | sed 's/\.glb$//')
TMP=$(mktemp -d)
for n in $NAMES; do
  npx -y @gltf-transform/cli@4 meshopt "$SRC/$n.glb" "$OUT/$n.glb"
  npx -y @gltf-transform/cli@4 simplify "$SRC/$n.glb" "$TMP/$n.glb" --ratio 0.25 --error 0.004
  npx -y @gltf-transform/cli@4 meshopt "$TMP/$n.glb" "$OUT/lod/$n.glb"
done
rm -rf "$TMP"
