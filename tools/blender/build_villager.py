"""
Builds the village cast (bipedal chibi cats in kimono and work clothes) and exports one rigged,
animated GLB each to public/assets/models/characters/<name>.glb.

Run (headless):
  blender -b --factory-startup --python tools/blender/build_villager.py -- --char all --stage full
  blender -b --factory-startup --python tools/blender/build_villager.py -- --char mestre_lotus --stage model

Reuses Shinichi's helpers (face, eyes, lids, mouth shape keys, surface probing) from build_shinichi.py.

Contract with the game (VillagerModel.tsx):
  * Blender: Z up, faces -Y; feet on z = 0. glTF/three.js: Y up, faces +Z.
  * Clips: idle, walk, talk, wave, cheer
  * Bones: root hips spine chest neck head ear.L/R upperarm/forearm/hand.L/R thigh/shin/foot.L/R tail.1-4
  * Morph targets: lid.L / lid.R {blink angry sad happy sleepy}, mouth {smile open oh frown angry}
  * Materials: fur, eye, pupil, gloss, mouth, cloth, metal, leather, pad, wood, glass
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_shinichi as base  # noqa: E402
import build_rig as rig  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT_DIR = os.path.join(ROOT, 'public', 'assets', 'models', 'characters')
OUT_RENDERS = os.path.join(ROOT, 'docs', 'renders')

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
CHAR = argv[argv.index('--char') + 1] if '--char' in argv else 'all'
STAGE = argv[argv.index('--stage') + 1] if '--stage' in argv else 'full'


def C(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


# ── Cast (references 14, 16, 18, 19) ─────────────────────────────────────────────
CAST = {
    'mestre_lotus': dict(
        fur='#A9A6B2', light='#EEEBF2', ear='#7C7986', iris='#8A6FD0', width=1.05,
        outfit='robe', robe='#5B3E86', trim='#E2B84E', obi='#3B2A5C', hem=0.03, flare=0.07,
        sharp=True, extras=['straw_hat', 'beard', 'cane', 'brows'],
    ),
    'kiko': dict(
        fur='#E8873A', light='#FFE3C4', ear='#C9692A', iris='#2BB3A8', width=1.0,
        outfit='gi', robe='#F2B33D', trim='#7A4A22', obi='#6B4A30', pants='#3E5C8C',
        stripes='#C2602A', extras=['goggles', 'tool_bag'],
    ),
    'sora': dict(
        fur='#FBF7F0', light='#FFFFFF', ear='#E39B4A', iris='#4FBF5A', width=0.95,
        outfit='robe', robe='#F2E6D8', trim='#C2477A', obi='#7AA7E0', hem=0.1, flare=0.06,
        calico=True, extras=['scarf', 'satchel'],
    ),
    'taro': dict(
        fur='#3A3742', light='#6E6A78', ear='#2A2730', iris='#F2A93B', width=1.0,
        outfit='gi', robe='#2E2A36', trim='#C8302C', obi='#C8302C', pants='#2E2A36',
        sharp=True, marks='#C8302C', extras=['red_band'],
    ),
    'luna': dict(
        fur='#FBF7F2', light='#FFFFFF', ear='#E9A15A', iris='#9A6BE0', width=0.95,
        outfit='robe', robe='#B98AD9', trim='#F2E6FF', obi='#7A4FA8', hem=0.03, flare=0.09,
        calico_light=True, extras=['staff', 'hair_flower'],
    ),
    'boku': dict(
        fur='#8A5E3C', light='#E8D3B4', ear='#6E472C', iris='#6B4A30', width=1.25,
        outfit='robe', robe='#5E8C4A', trim='#E9D9B4', obi='#7A5236', hem=0.12, flare=0.05,
        stripes='#6E472C', extras=['backpack'],
    ),
    'hana': dict(
        fur='#F3D9B5', light='#FFF6EA', ear='#E39B4A', iris='#4FA3E0', width=1.05,
        outfit='robe', robe='#E8789A', trim='#FFFFFF', obi='#FFFFFF', hem=0.1, flare=0.06,
        apron='#FFFFFF', patches='#E39B4A', extras=['chef_hat'],
    ),
    # ── Stage "Prompt Mestre" (P2): the rest of the village and three new faces ──────────
    # Each one differs in species or body, outfit, props and resting pose (style), not only in color.
    'mestre_kuma': dict(  # old bear monk of the temple: round ears, big muzzle, saffron robe and sash
        species='bear', fur='#7A5232', light='#C9A27A', ear='#5E3D24', iris='#6B4A30', width=1.35,
        outfit='robe', robe='#E08A2E', trim='#8C2F25', obi='#8C2F25', hem=0.04, flare=0.05,
        kesa='#8C2F25', belly=True, tail='stub', ears='round', whiskers=False,
        extras=['mala'], style='behind',
    ),
    'roku': dict(  # clumsy guard: wide, lamellar chest armour, shoulder plates, flat hat and a training spear
        fur='#8E8E96', light='#D8D8DE', ear='#6E6E78', iris='#E0B13A', width=1.2,
        outfit='gi', robe='#3F5C86', trim='#D8B24A', obi='#2B3550', pants='#2B3550',
        extras=['armor', 'jingasa', 'spear'], style='attention',
    ),
    'neko': dict(  # sleepy neighbour: round, pyjama kimono with dots, night cap and a pillow under the arm
        fur='#F2E3C9', light='#FFFFFF', ear='#D9B98C', iris='#7FB0D9', width=1.3,
        outfit='robe', robe='#A9C7E8', trim='#FFFFFF', obi='#7C9CC4', hem=0.03, flare=0.04,
        dots='#FFFFFF', belly=True, extras=['nightcap', 'pillow'], style='sleepy',
    ),
    'tanuki': dict(  # raccoon dog: dark eye mask, round ears, ringed bushy tail, leaf on the head, bundle on the back
        species='tanuki', fur='#9A7A5C', light='#E9D9C3', ear='#3B2C24', iris='#5A3E2A', width=1.15,
        outfit='gi', robe='#6E8B3D', trim='#3B2C24', obi='#3B2C24', pants='#7A5A3E', jacket_hem=0.2,
        mask='#3B2C24', belly=True, tail='bushy', tail_rings='#3B2C24', ears='round', whiskers=False,
        extras=['leaf', 'bundle'], style='hands_belly',
    ),
    'kuro': dict(  # mysterious black cat: deep hood, purple scarf, arms crossed
        fur='#2A2630', light='#3A3542', ear='#1E1B24', iris='#E8D33A', width=1.0,
        outfit='robe', robe='#232036', trim='#6B4FA0', obi='#6B4FA0', hem=0.03, flare=0.04,
        sharp=True, scarf_col='#6B4FA0', extras=['hood', 'scarf'], style='crossed',
    ),
    'mochi': dict(  # the oldest villager: hunched, knitted shawl, round glasses and a cane
        fur='#E9E4EE', light='#FFFFFF', ear='#C9C0D6', iris='#9A86C2', width=1.15,
        outfit='robe', robe='#8C6BAE', trim='#E8D9F2', obi='#5E4680', hem=0.03, flare=0.05,
        extras=['shawl', 'glasses', 'cane'], style='hunch',
    ),
    'bigodes': dict(  # fishmonger: orange tabby, huge moustache, twisted headband, bib apron, a fish in hand
        fur='#D98E4A', light='#FFE6C7', ear='#B06A2E', iris='#3E8C5A', width=1.25,
        outfit='gi', robe='#2F5E8C', trim='#FFFFFF', obi='#1F3550', pants='#1F3550',
        apron='#E8E2D0', apron_top=0.44, stripes='#B06A2E', belly=True,
        extras=['moustache', 'hachimaki', 'fish'], style='hips',
    ),
    'pipo': dict(  # playful kitten: short kimono, pinwheel; the game draws the head bigger (kid proportions)
        fur='#FFFFFF', light='#FFFFFF', ear='#E39B4A', iris='#4FBF5A', width=0.92,
        outfit='robe', robe='#F2C94C', trim='#E8505B', obi='#E8505B', hem=0.15, flare=0.03,
        calico=True, extras=['pinwheel'], style='bouncy',
    ),
    'liria': dict(  # careful inventor (keeps Kiko in check): blue-grey, bandana, round glasses, work apron, clipboard
        fur='#8FA3B8', light='#DDE6EE', ear='#6F8398', iris='#E0A23A', width=0.98,
        outfit='robe', robe='#3E8C8C', trim='#F2E6D8', obi='#7A5236', hem=0.1, flare=0.05,
        apron='#F2E6D8', apron_top=0.4, pockets='#C9B48C', extras=['bandana', 'glasses', 'clipboard'], style='clipboard',
    ),
    'mimi': dict(  # Hana's young helper in the cantina (Etapa 4 da expansão): orange tabby, sky-blue kimono
        # (Hana wears pink), white apron, kitchen kerchief, bouncy like a kid on her first job
        fur='#F2B56B', light='#FFF1DC', ear='#C9772F', iris='#56B36B', width=0.9,
        outfit='robe', robe='#5FA8D3', trim='#FFFFFF', obi='#F2C94C', hem=0.12, flare=0.05,
        apron='#FFFFFF', apron_top=0.36, stripes='#C9772F', extras=['bandana'], style='bouncy',
    ),
    'kaito': dict(  # parkour specialist: slim, colour-point fur, tight sleeves, arm wraps, long flying scarf
        fur='#EFE3CF', light='#FFF6E8', ear='#4A3A32', iris='#3FA0E0', width=0.88,
        outfit='gi', robe='#2F4A3A', trim='#E8643A', obi='#E8643A', pants='#26302A', sleeve='tight',
        points='#4A3A32', sharp=True, extras=['long_scarf', 'wraps', 'nose_band'], style='ready',
    ),
    'tsubaki': dict(  # temple guardian: tortoiseshell, white top and wide red hakama, camellia flower, wooden naginata
        fur='#3A2E2A', light='#F2E6D8', ear='#2A201C', iris='#E8B33A', width=1.0,
        outfit='gi', robe='#FBF7F2', trim='#C8302C', obi='#C8302C', pants='#C8302C', hakama=True, jacket_hem=0.24,
        blobs=[((0.12, -0.05, 0.84), 0.09, '#D9893A'), ((-0.1, 0.12, 0.8), 0.1, '#D9893A'), ((0.0, 0.26, 0.4), 0.14, '#D9893A')],
        extras=['camellia', 'naginata'], style='guard',
    ),
    # ── Art audit (§25): the Bairro das Glicínias ────────────────────────────────────────
    'fuji': dict(  # elder gardener of the wisteria and the tea: grey tabby, wisteria kimono, garden apron, straw hat
        fur='#9A9AA6', light='#EEEAF2', ear='#6E6E7C', iris='#7FA65A', width=1.08,
        outfit='robe', robe='#9C7CC8', trim='#F6ECDD', obi='#5E7A3E', hem=0.05, flare=0.05,
        apron='#C9B48C', apron_top=0.4, pockets='#A8916A', stripes='#6E6E7C',
        extras=['straw_hat'], style='behind',
    ),
    # ── §26: Bambuzal das Águas Quentes and Bosque Antigo ───────────────────────────────
    'goro': dict(  # hot-spring keeper: big honey bear, teal happi coat, towel headband, proud moustache
        species='bear', fur='#B07A4A', light='#E6CDA8', ear='#8C5A34', iris='#5A3E2A', width=1.4,
        outfit='gi', robe='#3E8C8C', trim='#24504F', obi='#F2E6D8', pants='#2F3E5E', jacket_hem=0.2,
        belly=True, tail='stub', ears='round', whiskers=False,
        extras=['hachimaki', 'moustache'], style='hips',
    ),
    'hinoki': dict(  # forest keeper: brown tabby elder, moss-green robe with a leaf, bushy brows and a staff
        fur='#6E5440', light='#F2E6D8', ear='#4A3A2C', iris='#C9A23A', width=1.0,
        outfit='robe', robe='#5E7A3E', trim='#C9B48C', obi='#7A5236', hem=0.03, flare=0.06,
        stripes='#4A3A2C', kesa='#C9B48C', extras=['staff', 'brows', 'leaf', 'satchel'],
    ),
    # ── Etapa 5 da expansão: the Ninja Academy and Mikage's residence ─────────────────────
    'mikage': dict(  # the village leader: tall silver-grey elder, white mane, bushy brows and beard, indigo robe with gold, staff with a bell
        fur='#A9A9B4', light='#F4F2EE', ear='#7C7C88', iris='#D9A520', width=1.3,
        outfit='robe', robe='#3D3552', trim='#D9A520', obi='#7A4FB0', hem=0.03, flare=0.06,
        kesa='#D9A520', extras=['mane', 'brows', 'beard', 'staff', 'bell'],
    ),
    'sumi': dict(  # academy head, numbers and logic: tuxedo cat, deep green robe, round glasses, clipboard, a flower
        fur='#2E2A2E', light='#F4F2EE', ear='#1E1B20', iris='#7FC8A0', width=1.0,
        outfit='robe', robe='#2F4A3A', trim='#F2E6D8', obi='#C9A04A', hem=0.05, flare=0.05,
        extras=['glasses', 'clipboard', 'hair_flower'], style='clipboard',
    ),
    'haru': dict(  # movement teacher: sandy athletic cat, blue training gi and black belt, headband and arm wraps
        fur='#D9A15B', light='#FFF1DC', ear='#B87A3A', iris='#4FA3E0', width=0.95,
        outfit='gi', robe='#2F6E9E', trim='#F4F2EE', obi='#2E2A2E', pants='#2A4F6E',
        extras=['hachimaki', 'wraps'], style='ready',
    ),
    'toshi': dict(  # gate guard of the residence: dark brown tabby, red-brown gi with gold trim, headband, wooden naginata
        fur='#6B5A4A', light='#D9CBB8', ear='#4A3D32', iris='#E0B13A', width=1.15,
        outfit='gi', robe='#7E3B32', trim='#D9A520', obi='#2E2A2E', pants='#2E2A2E',
        stripes='#4A3D32', extras=['hachimaki', 'naginata'], style='guard',
    ),
    'yuki': dict(  # strategist: white cat, steel-blue robe, long scarf, clipboard of plans
        fur='#F2F0EC', light='#FFFFFF', ear='#E8B4B4', iris='#4FA3E0', width=0.95,
        outfit='robe', robe='#5A7FB8', trim='#F2E6D8', obi='#2E3A78', hem=0.05, flare=0.06,
        extras=['long_scarf', 'clipboard'], style='clipboard',
    ),
    'fumi': dict(  # librarian: small tanuki, plum robe, round glasses, satchel of books
        species='tanuki', fur='#8C7A62', light='#E9DCC6', ear='#3B2C24', iris='#5A3E2A', width=1.05,
        outfit='robe', robe='#6A4C7A', trim='#E9D9AE', obi='#3B2C24', hem=0.04, flare=0.05,
        mask='#3B2C24', belly=True, tail='bushy', tail_rings='#3B2C24', ears='round', whiskers=False,
        extras=['glasses', 'satchel'], style='hands_belly',
    ),
    # Terras Selvagens (Etapa 7 da expansão)
    'bento': dict(  # the expedition's cartographer: sandy tanuki, khaki field gi, straw hat, big pack, map board
        species='tanuki', fur='#B08A5E', light='#EEDFC6', ear='#4A3A2E', iris='#4A6A3A', width=1.12,
        outfit='gi', robe='#5E7A44', trim='#E9D9AE', obi='#4A3A2E', pants='#5A4632', jacket_hem=0.2,
        mask='#4A3A2E', belly=True, tail='bushy', tail_rings='#4A3A2E', ears='round', whiskers=False,
        extras=['straw_hat', 'backpack', 'clipboard'], style='clipboard',
    ),
    # O Pacto das Duas Margens (Etapa 8 da expansão)
    'general_hissui': dict(  # from the far bank: jade-grey fur, dark armour, jade scarf, arms crossed, sharp eyes
        fur='#6E8C80', light='#D3DED6', ear='#46625A', iris='#E8C23A', width=1.28,
        outfit='gi', robe='#2E3A36', trim='#C9A23A', obi='#7A2E2E', pants='#2E3A36',
        sharp=True, stripes='#4E6A60', scarf_col='#4FA383', extras=['armor', 'brows', 'scarf'], style='crossed',
    ),
    'momo': dict(  # the expedition's herbalist: cream cat with brown patches, leaf-green robe, apron, flower, herb satchel
        fur='#F4EBDD', light='#FFFFFF', ear='#C99A6A', iris='#5FA35A', width=1.0,
        outfit='robe', robe='#4F8A5A', trim='#F2E6D8', obi='#7A5236', hem=0.06, flare=0.05,
        apron='#F4F1E4', apron_top=0.42, pockets='#9CC27A', patches='#B07A4A', extras=['hair_flower', 'satchel'], style='behind',
    ),
}

# ── Anatomy (biped chibi, ~1.1 m to the ear tips) ───────────────────────────────
HEAD = Vector((0, -0.02, 0.74))


def anatomy(w):
    return dict(
        shoulder=Vector((0.15 * w, 0.0, 0.47)), elbow=Vector((0.2 * w, -0.02, 0.36)), wrist=Vector((0.215 * w, -0.05, 0.27)),
        hip=Vector((0.075 * w, 0.0, 0.21)), knee=Vector((0.075 * w, -0.012, 0.115)), ankle=Vector((0.075 * w, 0.0, 0.05)),
        toe=Vector((0.075 * w, -0.1, 0.02)),
    )


TAIL = [(0, 0.12, 0.2), (0, 0.22, 0.23), (0, 0.29, 0.31), (0, 0.31, 0.43), (0, 0.28, 0.53)]


def tail_pts(cfg):
    """Tail joints: the cat's S curve, a bear's stub or a tanuki's low bushy tail (always 4 bones)."""
    kind = cfg.get('tail', 'cat')
    if kind == 'stub':
        return [(0, 0.11, 0.2), (0, 0.14, 0.21), (0, 0.16, 0.225), (0, 0.175, 0.24), (0, 0.185, 0.255)]
    if kind == 'bushy':
        return [(0, 0.12, 0.18), (0, 0.23, 0.17), (0, 0.32, 0.21), (0, 0.37, 0.3), (0, 0.37, 0.4)]
    return TAIL


def tail_radii(cfg):
    kind = cfg.get('tail', 'cat')
    if kind == 'stub':
        return [0.05, 0.058, 0.055, 0.045, 0.03]
    if kind == 'bushy':
        return [0.05, 0.07, 0.08, 0.075, 0.055]
    return [0.04, 0.038, 0.036, 0.034, 0.032]


def side(v, s):
    return Vector((v.x * s, v.y, v.z))


def body_elements(cfg):
    w = cfg['width']
    A = anatomy(w)
    E = []

    def ell(c, semi):
        E.append((tuple(c), semi))

    def chain(points, radii, step=0.018):
        for i in range(len(points) - 1):
            a, b = Vector(points[i]), Vector(points[i + 1])
            n = max(1, int((b - a).length / step))
            for k in range(n + (1 if i == len(points) - 2 else 0)):
                t = k / n
                r = radii[i] + (radii[i + 1] - radii[i]) * t
                ell(a.lerp(b, t), (r, r, r))

    ell((0, 0.01, 0.24), (0.14 * w, 0.12, 0.11))  # hips
    ell((0, 0.0, 0.36), (0.15 * w, 0.125, 0.14))  # torso
    ell((0, -0.06, 0.38), (0.11 * w, 0.07, 0.1))  # chest
    ell((0, -0.01, 0.5), (0.09, 0.08, 0.07))  # neck
    H = HEAD
    ell(H, (0.235, 0.21, 0.2))
    ell(H + Vector((0, -0.05, 0.08)), (0.16, 0.11, 0.09))
    for s in (1, -1):
        ell(H + Vector((s * 0.12, -0.07, -0.06)), (0.108, 0.095, 0.08))
    if cfg.get('species') == 'bear':
        ell(H + Vector((0, -0.17, -0.065)), (0.11, 0.075, 0.07))  # broad bear muzzle
    else:
        ell(H + Vector((0, -0.17, -0.05)), (0.085, 0.06, 0.055))
    ell(H + Vector((0, -0.145, -0.1)), (0.05, 0.04, 0.03))
    if cfg.get('belly'):
        ell((0, -0.06, 0.31), (0.13 * w, 0.09, 0.12))  # round belly, pushes the robe out
    for s in (1, -1):
        chain([side(A['shoulder'], s), side(A['elbow'], s), side(A['wrist'], s)], [0.052, 0.046, 0.043])
        ell(side(A['wrist'], s) + Vector((0, -0.02, -0.035)), (0.05, 0.052, 0.05))  # paw
        chain([side(A['hip'], s), side(A['knee'], s), side(A['ankle'], s)], [0.062, 0.056, 0.052])
        ell(side(A['ankle'], s) + Vector((0, -0.045, -0.02)), (0.056, 0.08, 0.036))  # foot
    chain(tail_pts(cfg), tail_radii(cfg), step=0.016)
    return E


def build_body(cfg):
    mb = bpy.data.metaballs.new('VillagerBody')
    mb.resolution = 0.008
    mb.threshold = 0.6
    obj = base.link(bpy.data.objects.new('VillagerBody', mb))
    for c, semi in body_elements(cfg):
        m = max(semi)
        el = mb.elements.new()
        el.type = 'ELLIPSOID'
        el.co = c
        el.radius = m / base.SURF
        el.size_x, el.size_y, el.size_z = semi[0] / m, semi[1] / m, semi[2] / m
        el.stiffness = 2.0
    base.activate(obj)
    bpy.ops.object.convert(target='MESH')
    body = bpy.context.view_layer.objects.active
    body.name = body.data.name = 'body'
    rem = body.modifiers.new('remesh', 'REMESH')
    rem.mode = 'VOXEL'
    rem.voxel_size = 0.008
    sm = body.modifiers.new('smooth', 'CORRECTIVE_SMOOTH')
    sm.iterations = 6
    sm.use_only_smooth = True
    dec = body.modifiers.new('decimate', 'DECIMATE')
    dec.ratio = 0.22
    base.apply_modifiers(body)
    body.data.validate(clean_customdata=False)
    base.shade_smooth(body)
    return body


# ── Fur pattern ──────────────────────────────────────────────────────────────
def fur_fn(cfg):
    fur, light = C(cfg['fur']), C(cfg['light'])
    blobs = []
    if cfg.get('calico'):
        blobs = [((0.12, -0.02, 0.86), 0.11, C('#E39B4A')), ((-0.13, 0.0, 0.88), 0.1, C('#2E2A30')), ((0.0, 0.2, 0.3), 0.1, C('#E39B4A')), ((0, 0.28, 0.45), 0.2, C('#2E2A30'))]
    if cfg.get('calico_light'):
        blobs = [((0.13, 0.0, 0.88), 0.1, C('#E9A15A')), ((0, 0.28, 0.45), 0.2, C('#E9A15A'))]
    if cfg.get('patches'):
        blobs = [((-0.12, 0.0, 0.88), 0.11, C(cfg['patches'])), ((0, 0.28, 0.45), 0.2, C(cfg['patches']))]
    if cfg.get('blobs'):
        blobs = [(c, r, C(col)) for c, r, col in cfg['blobs']]
    A = anatomy(cfg['width'])
    wrists = [side(A['wrist'], s) for s in (1, -1)]

    def f(co, nor=None):
        x, y, z = co.x, co.y, co.z
        hz = z - HEAD.z
        if cfg.get('mask') and y < HEAD.y - 0.06 and -0.075 < hz < 0.035 and 0.055 < abs(x) < 0.2:
            return C(cfg['mask'])  # tanuki eye mask
        if cfg.get('tail_rings') and y > 0.2 and z < 0.5 and (z * 15) % 1 < 0.35:
            return C(cfg['tail_rings'])
        if cfg.get('points'):  # colour-point: dark face mask, paws, feet and tail
            pt = C(cfg['points'])
            if y < HEAD.y - 0.1 and hz < 0.02 and abs(x) < 0.1:
                return pt
            if z < 0.07 or (y > 0.15 and z < 0.6) or any((co - wv).length < 0.075 for wv in wrists):
                return pt
        for c, r, col in blobs:
            if (Vector(c) - co).length < r:
                return col
        if cfg.get('stripes') and z > HEAD.z + 0.08 and y < 0.05 and abs((x * 9) % 1 - 0.5) < 0.12:
            return C(cfg['stripes'])
        if cfg.get('marks') and y < -0.05 and 0.14 < abs(x) < 0.21 and (abs(hz + 0.02) < 0.009 or abs(hz + 0.055) < 0.009):
            return C(cfg['marks'])  # Taro's red cheek stripes
        # light muzzle, chin and paws
        if y < HEAD.y - 0.08 and hz < 0.0 and abs(x) < 0.14:
            return light
        if z < 0.06 or (abs(x) > 0.17 * cfg['width'] and z < 0.3 and z > 0.22):
            return light
        return fur

    return f


# ── Outfit: robe / gi built from rings that follow the body ─────────────────────
def body_radius(body, z, d, max_r):
    inv = body.matrix_world.inverted()
    o = Vector((0, 0.005, z))
    ok, loc, nor, _ = body.ray_cast(inv @ o, (inv.to_3x3() @ d).normalized(), distance=max_r)
    return ((body.matrix_world @ loc) - o).length if ok else max_r


def build_robe(body, cfg):
    """Kimono (outfit 'robe', long hem with flare) or jacket (outfit 'gi', ends at the hips)."""
    w = cfg['width']
    robe_col, trim, obi = C(cfg['robe']), C(cfg['trim']), C(cfg['obi'])
    top, hip_z = 0.5, 0.22
    hem = cfg.get('hem', 0.1) if cfg['outfit'] == 'robe' else cfg.get('jacket_hem', 0.17)
    # fine enough that painted edges (collar V, apron, obi) stay straight
    steps = 96
    zs = [top - (top - hem) * j / 48 for j in range(49)]
    hip_r = []
    rows = []
    bm = bmesh.new()
    for z in zs:
        row = []
        for i in range(steps):
            a = 2 * math.pi * i / steps
            d = Vector((math.cos(a), math.sin(a), 0))
            if z >= hip_z:
                # near the collar the cloth hugs the neck; lower it can reach the full torso width
                cap = (0.11 + (0.5 - min(z, 0.5)) * 1.3) * w
                r = body_radius(body, z, d, min(0.19 * w, cap)) + 0.014
                if abs(z - hip_z) < 0.012:
                    hip_r.append(r)
            else:
                r0 = hip_r[i] if len(hip_r) == steps else 0.16 * w
                r = r0 + cfg.get('flare', 0.04) * (hip_z - z) / max(hip_z - hem, 1e-3) * 1.6
            row.append(bm.verts.new(Vector((math.cos(a) * r, 0.005 + math.sin(a) * r, z))))
        rows.append(row)
    for j in range(len(rows) - 1):
        for i in range(steps):
            k = (i + 1) % steps
            bm.faces.new((rows[j][i], rows[j][k], rows[j + 1][k], rows[j + 1][i]))
    robe = base.mesh_from_bmesh('robe', bm)
    base.solidify(robe, 0.008)
    base.shade_smooth(robe)
    apron = C(cfg['apron']) if cfg.get('apron') else None
    apron_top = cfg.get('apron_top', 0.27)
    kesa = C(cfg['kesa']) if cfg.get('kesa') else None
    dots = C(cfg['dots']) if cfg.get('dots') else None
    pockets = C(cfg['pockets']) if cfg.get('pockets') else None

    def col(co, nor):
        x, y, z = co.x, co.y, co.z
        front = y < -0.02
        if z < hem + 0.03:
            return trim
        if kesa and abs(x * (1 if front else -1) + (z - 0.36) * 1.1) < 0.045 and z > 0.2:
            return kesa  # monk's sash, left shoulder to right hip
        if apron and front and z < apron_top and abs(x) < 0.12 and not (0.27 < z < 0.33 and apron_top <= 0.27):
            if pockets and 0.17 < z < 0.24 and 0.03 < abs(x) < 0.1:
                return pockets
            return apron
        if 0.27 < z < 0.33:
            return obi
        # kimono collar: a V of trim with the light under-kimono showing between the lapels
        if front and z > 0.33:
            v = (z - 0.33) * 0.42
            if abs(abs(x) - v) < 0.016:
                return trim
            if abs(x) < v:
                return C(cfg['light'])
        if dots and math.sin(x * 70) * math.sin(z * 70) > 0.82:
            return dots  # pyjama polka dots
        return robe_col

    base.paint(robe, col)
    base.assign(robe, base.material('cloth', rough=0.85))
    parts = [robe]
    # bell sleeves around the arms
    A = anatomy(w)
    for s in (1, -1):
        sh, el, wr = side(A['shoulder'], s), side(A['elbow'], s), side(A['wrist'], s)
        sbm = bmesh.new()
        prev = None
        pts = [sh + (sh - el).normalized() * 0.01, el, wr + (wr - el).normalized() * 0.02]
        radii = [0.06, 0.056, 0.058] if cfg.get('sleeve') == 'tight' else [0.07, 0.075, 0.1]
        segs = 16
        rings = []
        for p, r in zip(pts, radii):
            axis = ((pts[-1] - pts[0])).normalized()
            u = axis.cross(Vector((0, 1, 0))).normalized()
            v = axis.cross(u).normalized()
            rings.append([sbm.verts.new(p + (u * math.cos(2 * math.pi * i / segs) + v * math.sin(2 * math.pi * i / segs)) * r) for i in range(segs)])
        for j in range(len(rings) - 1):
            for i in range(segs):
                k = (i + 1) % segs
                sbm.faces.new((rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]))
        sl = base.mesh_from_bmesh(f'sleeve.{"L" if s > 0 else "R"}', sbm)
        base.solidify(sl, 0.006)
        base.shade_smooth(sl)
        base.paint(sl, lambda co, n, wr=wr: trim if (co - wr).length < 0.06 else robe_col)
        base.assign(sl, base.material('cloth', rough=0.85))
        parts.append(sl)
    if cfg['outfit'] == 'gi':
        pants = C(cfg['pants'])
        for s in (1, -1):
            hip, knee, ankle = side(A['hip'], s), side(A['knee'], s), side(A['ankle'], s)
            pbm = bmesh.new()
            segs = 16
            rings = []
            ring_spec = ((hip + Vector((0, 0, 0.02)), 0.08), (knee, 0.07), (ankle + Vector((0, 0, 0.015)), 0.068))
            if cfg.get('hakama'):  # wide pleated trousers that almost reach the ground
                ring_spec = ((hip + Vector((0, 0, 0.03)), 0.095), (knee + Vector((0, 0, 0.01)), 0.115), (ankle + Vector((0, 0, -0.012)), 0.13))
            for p, r in ring_spec:
                rings.append([pbm.verts.new(p + Vector((math.cos(2 * math.pi * i / segs) * r, math.sin(2 * math.pi * i / segs) * r, 0))) for i in range(segs)])
            for j in range(len(rings) - 1):
                for i in range(segs):
                    k = (i + 1) % segs
                    pbm.faces.new((rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]))
            pl = base.mesh_from_bmesh(f'pants.{"L" if s > 0 else "R"}', pbm)
            base.solidify(pl, 0.006)
            base.shade_smooth(pl)
            if cfg.get('hakama'):
                base.paint(pl, lambda co, n, hp=hip: tuple(c * 0.78 for c in pants) if (math.atan2(co.y, co.x - hp.x) * 4 / math.pi) % 1 < 0.12 else pants)
            else:
                base.paint(pl, lambda co, n: C('#1E1B24') if co.z < 0.075 else pants)
            base.assign(pl, base.material('cloth', rough=0.85))
            parts.append(pl)
    return parts


# ── Accessories (rigid, parented to bones by the rig) ───────────────────────────
def mat(name, rgb, vertex=True, rough=0.8, metal=0.0):
    return base.material(name, rgb, rough=rough, metal=metal, vertex=vertex)


def colored(obj, rgb, matname='cloth'):
    base.flat_color(obj, rgb)
    base.assign(obj, base.material(matname, rough=0.8))
    base.shade_smooth(obj)
    return obj


def lathe(name, pts, segs=32):
    bm = bmesh.new()
    rings = []
    for r, z in pts:
        rings.append([bm.verts.new(Vector((math.cos(2 * math.pi * i / segs) * r, math.sin(2 * math.pi * i / segs) * r, z))) for i in range(segs)])
    for j in range(len(rings) - 1):
        for i in range(segs):
            k = (i + 1) % segs
            bm.faces.new((rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]))
    return base.mesh_from_bmesh(name, bm)


def build_extras(body, cfg):
    """Returns {bone_name: [objects]} so the rig can parent each piece to the right bone."""
    out = {'head': [], 'chest': [], 'spine': [], 'hand.R': [], 'hand.L': [], 'neck': []}
    w = cfg['width']
    A = anatomy(w)
    top = HEAD + Vector((0, 0.0, 0.2))
    for ex in cfg['extras']:
        if ex == 'straw_hat':
            hat = lathe('hat', [(0.0, 0.17), (0.08, 0.15), (0.2, 0.08), (0.36, 0.0), (0.37, -0.012), (0.0, -0.01)], 40)
            hat.location = HEAD + Vector((0, 0.01, 0.17))
            hat.rotation_euler = (math.radians(-6), 0, 0)
            bpy.context.view_layer.update()
            base.paint(hat, lambda co, n: C('#D9B567') if (co.z * 40) % 1 > 0.25 else C('#B8924A'))
            base.assign(hat, base.material('wood', rough=0.9))
            base.shade_smooth(hat)
            out['head'].append(hat)
        if ex == 'beard':
            # a soft tapered beard under the chin
            bm = bmesh.new()
            base.cone_between(bm, HEAD + Vector((0, -0.15, -0.11)), HEAD + Vector((0, -0.19, -0.3)), 0.07, 0.012, 14)
            bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=10, radius=0.07, matrix=Matrix.Translation(HEAD + Vector((0, -0.15, -0.11))))
            beard_obj = base.mesh_from_bmesh('beard', bm)
            sub = beard_obj.modifiers.new('sub', 'SUBSURF')
            sub.levels = 1
            base.apply_modifiers(beard_obj)
            beard = colored(beard_obj, C('#F2F0F5'), 'fur')
            out['head'].append(beard)
        if ex == 'mane':  # Mikage: a shaggy mane of light fur, drooping tufts at the front and sides, cheek tufts
            for k in range(13):
                a = -2.25 + k / 12 * 4.5  # 0 = front
                jitter = ((k * 7) % 3 - 1) * 0.018
                p = Vector((math.sin(a) * 0.16, -math.cos(a) * 0.135 + 0.01, 0.485 - 0.035 * math.cos(a) + jitter))
                semi = (0.055 + 0.018 * (k % 2), 0.055, 0.085 + 0.025 * (k % 3 == 1))
                tuft = base.ellipsoid(f'mane.{k}', p, semi, forward=(math.sin(a), -math.cos(a), -0.7))
                out['neck'].append(colored(tuft, C(cfg['light']), 'fur'))
            for s in (1, -1):
                cheek = base.ellipsoid(f'cheek.{s}', HEAD + Vector((s * 0.2, -0.07, -0.07)), (0.07, 0.05, 0.06), forward=(s * 1, -0.5, -0.5))
                out['head'].append(colored(cheek, C(cfg['light']), 'fur'))
        if ex == 'bell':  # a small golden bell at the top of the staff
            wr = side(A['wrist'], -1)
            bell = base.add_uv_sphere('bell', 0.034, 12, 10)
            bell.location = wr + Vector((0, -0.04, 0.47))
            out['hand.R'].append(colored(bell, C('#E2B84E'), 'metal'))
        if ex == 'brows':
            for s in (1, -1):
                b = base.ellipsoid(f'brow.{s}', HEAD + Vector((s * 0.09, -0.2, 0.09)), (0.045, 0.02, 0.016), forward=(s * 0.3, -1, 0.2))
                b.rotation_euler.y += math.radians(-18 * s)
                out['head'].append(colored(b, C('#F2F0F5'), 'fur'))
        if ex == 'cane':
            bm = bmesh.new()
            wr = side(A['wrist'], -1)
            base.cone_between(bm, wr + Vector((0, -0.04, -0.27)), wr + Vector((0, -0.04, 0.25)), 0.018, 0.016, 8)
            bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=8, radius=0.035, matrix=Matrix.Translation(wr + Vector((0, -0.04, 0.27))))
            out['hand.R'].append(colored(base.mesh_from_bmesh('cane', bm), C('#7A5236'), 'wood'))
        if ex == 'staff':
            bm = bmesh.new()
            wr = side(A['wrist'], -1)
            base.cone_between(bm, wr + Vector((0, -0.04, -0.27)), wr + Vector((0, -0.04, 0.42)), 0.016, 0.014, 8)
            staff = colored(base.mesh_from_bmesh('staff', bm), C('#8A5BB0'), 'wood')
            gem = base.add_uv_sphere('gem', 0.045, 12, 8)
            gem.location = wr + Vector((0, -0.04, 0.47))
            gem.scale = (1, 1, 1.4)
            out['hand.R'] += [staff, colored(gem, C('#E9D9FF'), 'glass')]
            ring = lathe('staffring', [(0.06, 0.0), (0.065, 0.01), (0.06, 0.02)], 20)
            ring.location = wr + Vector((0, -0.04, 0.43))
            out['hand.R'].append(colored(ring, C('#E2B84E'), 'metal'))
        if ex == 'hair_flower':
            for k in range(5):
                a = k / 5 * math.pi * 2
                pt = base.add_uv_sphere(f'petal{k}', 0.025, 8, 6)
                pt.location = HEAD + Vector((0.14 + math.cos(a) * 0.03, -0.08, 0.17 + math.sin(a) * 0.03))
                out['head'].append(colored(pt, C('#F7B6CB'), 'fur'))
        if ex == 'goggles':
            c = HEAD + Vector((0, 0, 0.1))
            axis = Vector((0, 0.15, 1)).normalized()
            band = base.mesh_from_bmesh('goggleband', base.ring_on_surface(body, c, axis, (-0.012, 0.012), outward=0.004, steps=48))
            base.solidify(band, 0.006)
            out['head'].append(colored(band, C('#5A4032'), 'leather'))
            p, n = base.surface_hit(body, c + Vector((0, -0.8, 0.12)), Vector((0, 1, -0.15)))
            for s in (1, -1):
                g = lathe(f'goggle{s}', [(0.0, 0.0), (0.045, 0.0), (0.05, 0.02), (0.045, 0.04), (0.0, 0.04)], 20)
                base.orient(g, p + n * 0.01 + Vector((s * 0.055, 0, 0.0)), n)
                g.rotation_euler.x += math.radians(90)
                out['head'].append(colored(g, C('#B07A3A'), 'metal'))
                lens = base.add_uv_sphere(f'lens{s}', 0.036, 12, 8)
                lens.location = p + n * 0.05 + Vector((s * 0.055, 0, 0))
                lens.scale = (1, 0.4, 1)
                out['head'].append(colored(lens, C('#9FE3FF'), 'glass'))
        if ex == 'red_band':
            c = HEAD + Vector((0, 0, 0.1))
            band = base.mesh_from_bmesh('redband', base.ring_on_surface(body, c, Vector((0, 0.2, 1)).normalized(), (-0.018, 0.0, 0.018), outward=0.004, steps=56))
            base.solidify(band, 0.007)
            out['head'].append(colored(band, C('#C8302C')))
            for s in (1, -1):
                tail = base.rounded_box(f'bandtail{s}', (0.04, 0.006, 0.16), bevel=0.004)
                tail.location = HEAD + Vector((s * 0.04, 0.24, 0.02))
                tail.rotation_euler = (math.radians(40), math.radians(15 * s), 0)
                out['head'].append(colored(tail, C('#C8302C')))
        if ex == 'scarf':
            ring = base.mesh_from_bmesh('scarf', base.ring_on_surface(body, Vector((0, -0.01, 0.5)), Vector((0, -0.3, 1)).normalized(), (-0.022, 0.0, 0.022), outward=0.012, steps=40, max_r=0.15))
            base.solidify(ring, 0.01)
            out['neck'].append(colored(ring, C(cfg.get('scarf_col', '#7AA7E0'))))
            knot = base.ellipsoid('scarfknot', Vector((0.05, -0.12, 0.47)), (0.04, 0.025, 0.035))
            out['neck'].append(colored(knot, C(cfg.get('scarf_col', '#7AA7E0'))))
        if ex in ('satchel', 'tool_bag'):
            bag = base.rounded_box('bag', (0.06, 0.12, 0.1), bevel=0.02)
            bag.location = Vector((0.18 * w, 0.02, 0.22))
            out['spine'].append(colored(bag, C('#8A5A34') if ex == 'satchel' else C('#6B4A30'), 'leather'))
            if ex == 'tool_bag':
                for k, dy in enumerate((-0.03, 0.0, 0.03)):
                    tool = base.rounded_box(f'tool{k}', (0.012, 0.012, 0.08), bevel=0.003)
                    tool.location = Vector((0.18 * w, 0.02 + dy, 0.3))
                    out['spine'].append(colored(tool, C('#C9CED8'), 'metal'))
            strap = base.mesh_from_bmesh('strap', base.ring_on_surface(body, Vector((0, 0.0, 0.36)), Vector((0.5, 0.1, 1.0)).normalized(), (-0.01, 0.01), outward=0.022, steps=48, max_r=0.2))
            base.solidify(strap, 0.006)
            out['chest'].append(colored(strap, C('#5A3A20'), 'leather'))
        if ex == 'backpack':
            pack = base.rounded_box('pack', (0.24, 0.16, 0.3), bevel=0.04)
            pack.location = Vector((0, 0.2, 0.42))
            roll = lathe('bedroll', [(0.06, -0.15), (0.065, -0.14), (0.065, 0.14), (0.06, 0.15)], 16)
            roll.rotation_euler = (0, math.radians(90), 0)
            roll.location = Vector((0, 0.2, 0.62))
            pan = base.add_uv_sphere('pan', 0.07, 16, 6)
            pan.scale = (1, 1, 0.3)
            pan.location = Vector((0.13, 0.27, 0.38))
            pan.rotation_euler = (0, math.radians(80), 0)
            out['chest'] += [colored(pack, C('#9A6A42'), 'leather'), colored(roll, C('#C9A16A')), colored(pan, C('#5E5A5E'), 'metal')]
        if ex == 'chef_hat':
            bm = bmesh.new()
            bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=0.15, radius2=0.15, depth=0.12, matrix=Matrix.Translation(top + Vector((0, 0.01, 0.02))))
            for dx, dy, dz in ((0, 0, 0.13), (0.09, 0.03, 0.1), (-0.09, 0.02, 0.1), (0, -0.08, 0.1), (0.02, 0.08, 0.11)):
                bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.1, matrix=Matrix.Translation(top + Vector((dx, dy, dz))))
            out['head'].append(colored(base.mesh_from_bmesh('chefhat', bm), C('#FFFFFF')))
        # ── extras for the rest of the village and the new faces ────────────────────
        wrR, wrL = side(A['wrist'], -1), side(A['wrist'], 1)
        if ex == 'mala':  # prayer beads, hanging lower in front
            bm = bmesh.new()
            n = 22
            for i in range(n):
                a = 2 * math.pi * i / n
                d = Vector((math.cos(a), math.sin(a), 0))
                drop = max(0.0, -math.sin(a))
                z = 0.5 - 0.1 * drop
                r = body_radius(body, z, d, 0.25) + 0.034
                bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.017, matrix=Matrix.Translation(Vector((math.cos(a) * r, 0.005 + math.sin(a) * r, z))))
            r = body_radius(body, 0.38, Vector((0, -1, 0)), 0.25) + 0.045
            bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=8, radius=0.028, matrix=Matrix.Translation(Vector((0, 0.005 - r, 0.38))))
            out['chest'].append(colored(base.mesh_from_bmesh('mala', bm), C('#5A2E1E'), 'wood'))
        if ex == 'armor':  # lamellar chest armour with lacing rows, plus shoulder plates on the upper arms
            bm = bmesh.new()
            rows = []
            for z in (0.295, 0.3325, 0.37, 0.4075, 0.445):
                row = []
                for i in range(48):
                    a = 2 * math.pi * i / 48
                    d = Vector((math.cos(a), math.sin(a), 0))
                    r = min(body_radius(body, z, d, 0.3), 0.19 * w) + 0.04
                    row.append(bm.verts.new(Vector((math.cos(a) * r, 0.005 + math.sin(a) * r, z))))
                rows.append(row)
            for j in range(len(rows) - 1):
                for i in range(48):
                    k = (i + 1) % 48
                    bm.faces.new((rows[j][i], rows[j][k], rows[j + 1][k], rows[j + 1][i]))
            plate = base.mesh_from_bmesh('armor', bm)
            base.solidify(plate, 0.012)
            base.shade_smooth(plate)
            base.paint(plate, lambda co, n: C('#D8B24A') if ((co.z - 0.295) / 0.0375) % 1 < 0.12 else C('#5E7FA8'))
            base.assign(plate, base.material('metal', rough=0.5, metal=0.3))
            out['spine'].append(plate)
            for s, S in ((1, 'L'), (-1, 'R')):
                sode = base.rounded_box(f'sode{S}', (0.03, 0.12, 0.11), bevel=0.012)
                sode.location = side(A['shoulder'], s) + Vector((s * 0.085, 0.0, -0.045))
                sode.rotation_euler = (0, math.radians(-14 * s), 0)
                base.paint(sode, lambda co, n: C('#D8B24A') if (co.z * 28) % 1 < 0.18 else C('#5E7FA8'))
                base.assign(sode, base.material('metal', rough=0.5, metal=0.3))
                out.setdefault(f'upperarm.{S}', []).append(sode)
        if ex == 'jingasa':  # flat lacquered guard hat
            hat = lathe('jingasa', [(0.0, 0.085), (0.06, 0.075), (0.22, 0.02), (0.29, 0.0), (0.29, -0.012), (0.0, -0.005)], 40)
            hat.location = HEAD + Vector((0, 0.01, 0.175))
            hat.rotation_euler = (math.radians(-5), 0, 0)
            bpy.context.view_layer.update()
            base.paint(hat, lambda co, n: C('#C8302C') if (co - hat.location).length > 0.27 else (C('#D8B24A') if co.z > hat.location.z + 0.06 else C('#22222A')))
            base.assign(hat, base.material('wood', rough=0.4))
            base.shade_smooth(hat)
            out['head'].append(hat)
        if ex == 'spear':  # training spear: wooden shaft, blunt padded tip and a red tassel
            bm = bmesh.new()
            base.cone_between(bm, wrR + Vector((0, -0.04, -0.26)), wrR + Vector((0, -0.04, 0.78)), 0.016, 0.014, 8)
            shaft = colored(base.mesh_from_bmesh('spear', bm), C('#7A5236'), 'wood')
            tip = base.add_uv_sphere('speartip', 0.035, 12, 8)
            tip.location = wrR + Vector((0, -0.04, 0.83))
            tip.scale = (1, 1, 1.6)
            tassel = lathe('tassel', [(0.02, 0.0), (0.045, -0.05), (0.03, -0.09)], 12)
            tassel.location = wrR + Vector((0, -0.04, 0.78))
            out['hand.R'] += [shaft, colored(tip, C('#E8E2D0')), colored(tassel, C('#C8302C'))]
        if ex == 'nightcap':  # floppy striped cap with a pompom
            pts = [HEAD + Vector(v) for v in ((0, 0.03, 0.13), (0.02, 0.05, 0.28), (0.12, 0.08, 0.35), (0.22, 0.1, 0.29))]
            radii = [0.2, 0.13, 0.075, 0.035]
            bm = bmesh.new()
            for i in range(3):
                base.cone_between(bm, pts[i], pts[i + 1], radii[i], radii[i + 1], 20)
            for i in (1, 2):
                bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=radii[i], matrix=Matrix.Translation(pts[i]))
            cap = base.mesh_from_bmesh('nightcap', bm)
            base.paint(cap, lambda co, n: C('#FFFFFF') if ((co - pts[0]).length * 14) % 1 < 0.45 else C('#7C9CC4'))
            base.assign(cap, base.material('cloth', rough=0.9))
            base.shade_smooth(cap)
            brim = lathe('capbrim', [(0.2, -0.02), (0.215, 0.0), (0.215, 0.03), (0.2, 0.045)], 32)
            brim.location = pts[0]
            pom = base.add_uv_sphere('pompom', 0.05, 12, 8)
            pom.location = pts[3]
            out['head'] += [cap, colored(brim, C('#FFFFFF')), colored(pom, C('#FFFFFF'), 'fur')]
        if ex == 'pillow':  # held under the left arm
            pil = base.rounded_box('pillow', (0.08, 0.2, 0.13), bevel=0.035)
            pil.location = wrL + Vector((0.05, 0.0, 0.08))
            base.paint(pil, lambda co, n: C('#F7E7A8') if abs(co.y - pil.location.y) > 0.085 else C('#FFF6D8'))
            base.assign(pil, base.material('cloth', rough=0.9))
            out['hand.L'].append(pil)
        if ex == 'leaf':  # the tanuki's magic leaf
            leaf = base.ellipsoid('leaf', HEAD + Vector((0.03, 0.0, 0.225)), (0.075, 0.15, 0.016), forward=(0.3, -1, 0.35))
            base.paint(leaf, lambda co, n: C('#3E7A2E') if abs((co - leaf.location).x * 3 - (co - leaf.location).y) < 0.006 else C('#6FB04A'))
            base.assign(leaf, base.material('cloth', rough=0.7))
            base.shade_smooth(leaf)
            out['head'].append(leaf)
        if ex == 'bundle':  # furoshiki bundle on the back, knotted on the chest
            bun = base.add_uv_sphere('bundle', 0.13, 20, 14)
            bun.location = Vector((0, 0.22, 0.42))
            bun.scale = (1.05, 0.8, 0.9)
            base.paint(bun, lambda co, n: C('#F2E6D8') if math.sin(co.x * 45 + math.sin(co.z * 30) * 2) > 0.7 else C('#3E8C7A'))
            base.assign(bun, base.material('cloth', rough=0.9))
            base.shade_smooth(bun)
            knot = base.ellipsoid('bundleknot', Vector((0.0, -0.14, 0.45)), (0.045, 0.03, 0.035))
            parts_b = [bun, colored(knot, C('#3E8C7A'))]
            for s in (1, -1):
                strap = base.mesh_from_bmesh('bstrap', base.ring_on_surface(body, Vector((0, 0.0, 0.42)), Vector((s * 0.45, 0.15, 1.0)).normalized(), (-0.012, 0.012), outward=0.032, steps=48, max_r=0.22))
                base.solidify(strap, 0.006)
                parts_b.append(colored(strap, C('#3E8C7A')))
            out['chest'] += parts_b
        if ex == 'hood':  # deep hood around the head (the ears poke through)
            bm = bmesh.new()
            bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=20, radius=0.27)
            hc = HEAD + Vector((0, 0.04, 0.02))
            for v in bm.verts:
                v.co = hc + Vector((v.co.x * 1.04, v.co.y, v.co.z))
            bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < HEAD.y - 0.07 or (v.co.z < HEAD.z - 0.16 and v.co.y < HEAD.y + 0.12)], context='VERTS')
            hood = base.mesh_from_bmesh('hood', bm)
            base.solidify(hood, 0.012)
            out['head'].append(colored(hood, C('#232036')))
        if ex == 'shawl':  # knitted shawl over the shoulders
            sh = base.mesh_from_bmesh('shawl', base.ring_on_surface(body, Vector((0, 0.0, 0.45)), Vector((0, 0.12, 1)).normalized(), (-0.06, -0.03, 0.0, 0.025), outward=0.036, steps=48, max_r=0.26))
            base.solidify(sh, 0.01)
            base.shade_smooth(sh)
            base.paint(sh, lambda co, n: C('#C76A8A') if (co.z * 45) % 1 < 0.5 else C('#E89AB4'))
            base.assign(sh, base.material('cloth', rough=0.95))
            out['chest'].append(sh)
            brooch = base.add_uv_sphere('brooch', 0.022, 10, 8)
            brooch.location = Vector((0, -0.165, 0.44))
            out['chest'].append(colored(brooch, C('#E2B84E'), 'metal'))
        if ex == 'glasses':  # round glasses in front of the eyes
            gl = []
            centers = []
            for s in (1, -1):
                c, ex_, ey_, n = base.eye_frame(body, s)
                p = c + n * 0.05
                centers.append(p)
                bpy.ops.mesh.primitive_torus_add(major_radius=0.07, minor_radius=0.0065, major_segments=28, minor_segments=6, location=p)
                ring = bpy.context.view_layer.objects.active
                ring.name = f'lensring{s}'
                base.orient(ring, p, n)
                ring.rotation_euler.rotate_axis('X', math.radians(90))
                bpy.context.view_layer.update()
                gl.append(ring)
                bm = bmesh.new()
                base.cone_between(bm, p + Vector((s * 0.068, 0, 0)), p + Vector((s * 0.1, 0.17, 0.02)), 0.005, 0.005, 6)
                gl.append(base.mesh_from_bmesh(f'temple{s}', bm))
            bm = bmesh.new()
            base.cone_between(bm, centers[0] - Vector((0.066, 0, 0)), centers[1] + Vector((0.066, 0, 0)), 0.005, 0.005, 6)
            gl.append(base.mesh_from_bmesh('bridge', bm))
            out['head'].append(colored(base.join(gl, 'glasses'), C('#B8862E'), 'metal'))
        if ex == 'moustache':  # Seu Bigodes' namesake
            for s in (1, -1):
                p, n = base.surface_hit(body, HEAD + Vector((s * 0.05, -0.8, -0.05)), (0, 1, 0))
                m = base.ellipsoid(f'stache{s}', p + n * 0.012 + Vector((s * 0.04, 0, 0)), (0.075, 0.022, 0.03), forward=(s * 0.45, -1, 0))
                m.rotation_euler.rotate_axis('Y', math.radians(14 * s))
                bpy.context.view_layer.update()
                out['head'].append(colored(m, C('#7A4520'), 'fur'))
        if ex == 'hachimaki':  # twisted headband with a side knot
            c = HEAD + Vector((0, 0, 0.1))
            band = base.mesh_from_bmesh('hachimaki', base.ring_on_surface(body, c, Vector((0, 0.15, 1)).normalized(), (-0.016, 0.0, 0.016), outward=0.004, steps=56))
            base.solidify(band, 0.008)
            base.paint(band, lambda co, n: C('#2F5E8C') if math.sin(math.atan2(co.y, co.x) * 14 + co.z * 120) > 0.3 else C('#FFFFFF'))
            base.assign(band, base.material('cloth', rough=0.85))
            knot = base.ellipsoid('hknot', HEAD + Vector((0.17, -0.1, 0.12)), (0.035, 0.03, 0.03))
            out['head'] += [band, colored(knot, C('#FFFFFF'))]
        if ex == 'fish':  # a fresh fish hanging from the right hand
            fish = base.ellipsoid('fish', wrR + Vector((0, -0.04, -0.15)), (0.03, 0.05, 0.1))
            base.paint(fish, lambda co, n: C('#DDE8F0') if co.y < fish.location.y - 0.025 else C('#5E8CB8'))
            base.assign(fish, base.material('glass', rough=0.35))
            base.shade_smooth(fish)
            fin = base.ellipsoid('fishtail', wrR + Vector((0, -0.04, -0.035)), (0.012, 0.05, 0.03))
            out['hand.R'] += [fish, colored(fin, C('#5E8CB8'), 'glass')]
        if ex == 'pinwheel':  # kazaguruma: stick and four coloured blades
            bm = bmesh.new()
            # leans outward: the 'bouncy' pose opens the arm, which would tip it behind the head
            base.cone_between(bm, wrR + Vector((0, -0.04, -0.04)), wrR + Vector((-0.2, -0.08, 0.44)), 0.008, 0.008, 6)
            stick = colored(base.mesh_from_bmesh('pinstick', bm), C('#C9A16A'), 'wood')
            hub = wrR + Vector((-0.2, -0.1, 0.46))
            blades = []
            for k, colr in enumerate(('#E8505B', '#F2C94C', '#4FA3E0', '#6FB04A')):
                a = k * math.pi / 2 + 0.4
                bl = base.rounded_box(f'blade{k}', (0.12, 0.01, 0.055), bevel=0.004)
                bl.location = hub + Vector((math.cos(a), 0, math.sin(a))) * 0.06
                bl.rotation_euler = (0, -a, 0)
                blades.append(colored(bl, C(colr)))
            pin = base.add_uv_sphere('pinhub', 0.018, 10, 8)
            pin.location = hub + Vector((0, -0.01, 0))
            blades.append(colored(pin, C('#FFFFFF')))
            out['hand.R'] += [stick] + blades
        if ex == 'clipboard':  # held in the left hand (the 'clipboard' style lifts it to the chest)
            board = base.rounded_box('board', (0.012, 0.13, 0.17), bevel=0.004)
            board.location = wrL + Vector((0.04, -0.02, 0.02))
            paper = base.rounded_box('paper', (0.004, 0.11, 0.14), bevel=0.001)
            paper.location = board.location + Vector((0.008, 0, -0.008))
            clip = base.rounded_box('clip', (0.012, 0.05, 0.02), bevel=0.003)
            clip.location = board.location + Vector((0.01, 0, 0.075))
            out['hand.L'] += [colored(board, C('#8A5A34'), 'wood'), colored(paper, C('#FFFFFF')), colored(clip, C('#C9CED8'), 'metal')]
        if ex == 'bandana':  # kerchief over the head, tied at the back
            c = HEAD + Vector((0, 0.01, 0.12))
            band = base.mesh_from_bmesh('bandana', base.ring_on_surface(body, c, Vector((0, 0.3, 1)).normalized(), (-0.022, 0.0, 0.022, 0.044), outward=0.005, steps=56))
            base.solidify(band, 0.007)
            base.paint(band, lambda co, n: C('#FFFFFF') if math.sin(co.x * 90) * math.sin(co.z * 90) > 0.85 else C('#E8B33A'))
            base.assign(band, base.material('cloth', rough=0.85))
            out['head'].append(band)
            for s in (1, -1):
                tail = base.rounded_box(f'bandanatail{s}', (0.035, 0.006, 0.1), bevel=0.004)
                tail.location = HEAD + Vector((s * 0.035, 0.23, 0.04))
                tail.rotation_euler = (math.radians(30), math.radians(25 * s), 0)
                out['head'].append(colored(tail, C('#E8B33A')))
        if ex == 'long_scarf':  # Kaito's scarf, two long tails flying back
            ring = base.mesh_from_bmesh('lscarf', base.ring_on_surface(body, Vector((0, -0.01, 0.5)), Vector((0, -0.2, 1)).normalized(), (-0.022, 0.0, 0.022), outward=0.012, steps=40, max_r=0.15))
            base.solidify(ring, 0.01)
            out['neck'].append(colored(ring, C('#E8643A')))
            for k, (dx, ang, ln) in enumerate(((0.04, 28, 0.34), (-0.035, 40, 0.28))):
                t_ = base.rounded_box(f'lscarftail{k}', (0.075, ln, 0.014), bevel=0.006)
                t_.location = Vector((dx, 0.12 + ln / 2 * math.cos(math.radians(ang)), 0.47 - ln / 2 * math.sin(math.radians(ang))))
                t_.rotation_euler = (math.radians(-ang), 0, math.radians(8 * (1 if k else -1)))
                out['neck'].append(colored(t_, C('#E8643A')))
        if ex == 'wraps':  # cloth wraps on the forearms
            for s, S in ((1, 'L'), (-1, 'R')):
                el, wr = side(A['elbow'], s), side(A['wrist'], s)
                bm = bmesh.new()
                base.cone_between(bm, el + (wr - el) * 0.35, wr + (wr - el).normalized() * 0.01, 0.064, 0.062, 16)
                wrap = base.mesh_from_bmesh(f'wrap{S}', bm)
                base.paint(wrap, lambda co, n: C('#D8D2C4') if (co.z * 60) % 1 < 0.5 else C('#F2EEE4'))
                base.assign(wrap, base.material('cloth', rough=0.9))
                base.shade_smooth(wrap)
                out.setdefault(f'forearm.{S}', []).append(wrap)
        if ex == 'nose_band':  # a plaster on the nose (parkour scrapes)
            p, n = base.surface_hit(body, HEAD + Vector((0.02, -0.8, 0.0)), (0, 1, 0))
            pb = base.rounded_box('plaster', (0.06, 0.008, 0.02), bevel=0.003)
            base.orient(pb, p + n * 0.004, n)
            pb.rotation_euler.rotate_axis('Y', math.radians(-20))
            bpy.context.view_layer.update()
            out['head'].append(colored(pb, C('#F2D6B0')))
        if ex == 'camellia':  # tsubaki flower over the right ear
            fc = HEAD + Vector((-0.16, -0.06, 0.15))
            for k in range(6):
                a = k / 6 * math.pi * 2
                pt = base.add_uv_sphere(f'cpetal{k}', 0.034, 10, 8)
                pt.location = fc + Vector((math.cos(a) * 0.034, -0.01, math.sin(a) * 0.034))
                pt.scale = (1, 0.5, 1)
                out['head'].append(colored(pt, C('#D8263B'), 'cloth'))
            mid = base.add_uv_sphere('cmid', 0.022, 10, 8)
            mid.location = fc + Vector((0, -0.03, 0))
            out['head'].append(colored(mid, C('#F2C94C'), 'cloth'))
            for s in (1, -1):
                lf = base.ellipsoid(f'cleaf{s}', fc + Vector((s * 0.05, 0.02, -0.04)), (0.035, 0.01, 0.02), forward=(s * 0.4, -1, 0))
                out['head'].append(colored(lf, C('#2E6B3A'), 'cloth'))
        if ex == 'naginata':  # wooden practice naginata
            bm = bmesh.new()
            base.cone_between(bm, wrR + Vector((0, -0.04, -0.26)), wrR + Vector((0, -0.04, 0.7)), 0.016, 0.015, 8)
            pole = colored(base.mesh_from_bmesh('nagipole', bm), C('#7A2E2A'), 'wood')
            guard = lathe('nagiguard', [(0.0, -0.006), (0.032, -0.006), (0.032, 0.006), (0.0, 0.006)], 16)
            guard.location = wrR + Vector((0, -0.04, 0.7))
            blade = base.ellipsoid('nagiblade', wrR + Vector((0.012, -0.04, 0.84)), (0.028, 0.009, 0.15), forward=(0, -1, 0))
            blade.rotation_euler.rotate_axis('Y', math.radians(-8))
            bpy.context.view_layer.update()
            out['hand.R'] += [pole, colored(guard, C('#2A201C'), 'metal'), colored(blade, C('#E8D2A8'), 'wood')]
    return out


def build_round_ear(s, cfg):
    """Bear and tanuki ears: a round outer shell with a lighter inner disc."""
    S = 'L' if s > 0 else 'R'
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=14, radius=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * 0.078, v.co.y * 0.04, v.co.z * 0.072 + 0.03))
    ear = base.mesh_from_bmesh(f'ear.{S}', bm)
    ibm = bmesh.new()
    bmesh.ops.create_uvsphere(ibm, u_segments=16, v_segments=10, radius=1.0)
    for v in ibm.verts:
        v.co = Vector((v.co.x * 0.05, v.co.y * 0.02 - 0.026, v.co.z * 0.046 + 0.034))
    inner = base.mesh_from_bmesh('earinner', ibm)
    base.flat_color(ear, C(cfg['ear']))
    base.flat_color(inner, C(cfg['light']))
    for o in (ear, inner):
        base.assign(o, base.material('fur', rough=0.9))
        base.shade_smooth(o)
    ear = base.join([ear, inner], f'ear.{S}')
    ear.location = HEAD + Vector((s * 0.15, 0.03, 0.14))
    ear.rotation_euler = (math.radians(-5), 0, math.radians(-20 * s))
    bpy.context.view_layer.update()
    return ear


# ── Rig and animation ────────────────────────────────────────────────────────
def bone_table(cfg):
    A = anatomy(cfg['width'])
    t = [
        ('root', (0, 0, 0), (0, 0, 0.1), None, False),
        ('hips', (0, 0, 0.18), (0, 0, 0.3), 'root', True),
        ('spine', (0, 0, 0.3), (0, 0, 0.42), 'hips', True),
        ('chest', (0, 0, 0.42), (0, 0, 0.5), 'spine', True),
        ('neck', (0, 0, 0.5), (0, -0.01, 0.58), 'chest', True),
        ('head', (0, -0.01, 0.58), (0, -0.02, 0.95), 'neck', True),
    ]
    tp = tail_pts(cfg)
    for i in range(4):
        t.append((f'tail.{i + 1}', tp[i], tp[i + 1], 'hips' if i == 0 else f'tail.{i}', True))
    for s, S in ((1, 'L'), (-1, 'R')):
        sh, el, wr = side(A['shoulder'], s), side(A['elbow'], s), side(A['wrist'], s)
        hp, kn, an, to = side(A['hip'], s), side(A['knee'], s), side(A['ankle'], s), side(A['toe'], s)
        t += [
            (f'upperarm.{S}', tuple(sh), tuple(el), 'chest', True),
            (f'forearm.{S}', tuple(el), tuple(wr), f'upperarm.{S}', True),
            (f'hand.{S}', tuple(wr), tuple(wr + Vector((0, -0.03, -0.07))), f'forearm.{S}', True),
            (f'thigh.{S}', tuple(hp), tuple(kn), 'hips', True),
            (f'shin.{S}', tuple(kn), tuple(an), f'thigh.{S}', True),
            (f'foot.{S}', tuple(an), tuple(to), f'shin.{S}', True),
        ]
    return t


X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)


def clip_idle(t):
    p = {}
    b = math.sin(2 * math.pi * t)
    rig.add(p, 'chest', X, 0.02 * b)
    rig.add(p, 'head', Z, 0.08 * math.sin(2 * math.pi * t + 0.7))
    rig.add(p, 'head', Y, 0.04 * b)
    for S, s in (('L', 1), ('R', -1)):
        rig.add(p, f'upperarm.{S}', Y, -s * (0.08 + 0.02 * b))
    p['hips'] = dict(p.get('hips', {}), loc=(0, 0, 0.003 * b))
    for i in range(1, 5):
        rig.add(p, f'tail.{i}', Y, 0.12 * math.sin(2 * math.pi * t - i * 0.6))
    return p


def clip_walk(t):
    p = {}
    ph = 2 * math.pi * t
    for S, s, off in (('L', 1, 0.0), ('R', -1, math.pi)):
        sw = math.sin(ph + off)
        rig.add(p, f'thigh.{S}', X, -0.42 * sw)
        rig.add(p, f'shin.{S}', X, 0.55 * max(0.0, math.sin(ph + off + 1.4)))
        rig.add(p, f'foot.{S}', X, -0.2 * max(0.0, math.sin(ph + off + 1.4)))
        rig.add(p, f'upperarm.{S}', X, 0.35 * sw)
        rig.add(p, f'upperarm.{S}', Y, -s * 0.1)
        rig.add(p, f'forearm.{S}', X, -0.2)
    rig.add(p, 'hips', Z, 0.06 * math.sin(ph))
    rig.add(p, 'chest', Z, -0.08 * math.sin(ph))
    rig.add(p, 'head', X, 0.03 * math.cos(2 * ph))
    p['hips'] = dict(p['hips'], loc=(0, 0, 0.012 * abs(math.cos(ph))))
    for i in range(1, 5):
        rig.add(p, f'tail.{i}', Y, 0.15 * math.sin(ph - i * 0.5))
    return p


def clip_talk(t):
    p = clip_idle(t)
    ph = 2 * math.pi * t
    rig.add(p, 'head', X, 0.06 * math.sin(ph * 2))
    rig.add(p, 'upperarm.R', X, -0.55 + 0.15 * math.sin(ph))
    rig.add(p, 'upperarm.R', Y, 0.25)
    rig.add(p, 'forearm.R', X, -0.7 + 0.2 * math.sin(ph * 2))
    rig.add(p, 'upperarm.L', X, -0.2 * max(0.0, math.sin(ph + 2)))
    rig.add(p, 'chest', Z, 0.05 * math.sin(ph))
    return p


def clip_wave(t):
    p = clip_idle(t)
    rig.add(p, 'upperarm.R', Y, 2.35)
    rig.add(p, 'forearm.R', Y, 0.45 * math.sin(2 * math.pi * t * 2))
    rig.add(p, 'head', Z, 0.12)
    return p


def clip_cheer(t):
    p = {}
    hop = abs(math.sin(2 * math.pi * t))
    rig.add(p, 'upperarm.L', Y, -2.5 - 0.15 * hop)
    rig.add(p, 'upperarm.R', Y, 2.5 + 0.15 * hop)
    for S in ('L', 'R'):
        rig.add(p, f'thigh.{S}', X, -0.25 * (1 - hop))
        rig.add(p, f'shin.{S}', X, 0.5 * (1 - hop))
        rig.add(p, f'foot.{S}', X, -0.25 * (1 - hop))
    rig.add(p, 'head', X, -0.12)
    p['hips'] = dict(p.get('hips', {}), loc=(0, 0, 0.06 * hop - 0.03 * (1 - hop)))
    for i in range(1, 5):
        rig.add(p, f'tail.{i}', X, -0.15)
    return p


CLIPS = [('idle', clip_idle, 60, True), ('walk', clip_walk, 24, True), ('talk', clip_talk, 48, True),
         ('wave', clip_wave, 36, True), ('cheer', clip_cheer, 24, True)]


def arm(p, S, x=0.0, y=0.0, fx=0.0, fy=0.0, fz=0.0):
    """Arm pose in readable terms. x: + swings back / - forward; y: + out to the side;
    fx: forearm + back / - forward; fy: forearm + out; fz: forearm turned + toward the body (applied after fx)."""
    s = 1 if S == 'L' else -1
    if y:
        rig.add(p, f'upperarm.{S}', Y, -s * y)
    if x:
        rig.add(p, f'upperarm.{S}', X, x)
    if fz:
        rig.add(p, f'forearm.{S}', Z, -s * fz)
    if fy:
        rig.add(p, f'forearm.{S}', Y, -s * fy)
    if fx:
        rig.add(p, f'forearm.{S}', X, fx)


def style_pose(p, cfg, t, clip):
    """Each villager's own body language on top of the shared clips. The arms only change where the clip
    leaves them free: all of them in idle, the left one in talk and wave (the right one gestures)."""
    style = cfg.get('style')
    if not style or clip == 'cheer':
        return p
    ph = 2 * math.pi * t
    free = ('L', 'R') if clip == 'idle' else (('L',) if clip in ('talk', 'wave') else ())

    def hips_loc(z):
        old = p.get('hips', {}).get('loc', (0, 0, 0))
        p['hips'] = dict(p.get('hips', {}), loc=(old[0], old[1], old[2] + z))

    if style == 'hunch':  # Vovó Mochi: bent back, head lifted to look ahead, slow
        rig.add(p, 'spine', X, 0.3)
        rig.add(p, 'chest', X, 0.22)
        rig.add(p, 'neck', X, -0.24)
        rig.add(p, 'head', X, -0.18)
        for S in free:
            arm(p, S, x=-0.25, fx=-0.35)
    elif style == 'behind':  # Mestre Kuma: hands clasped behind the back, calm nod
        rig.add(p, 'chest', X, -0.05)
        rig.add(p, 'head', X, 0.05 * math.sin(ph))
        for S in free:
            arm(p, S, x=0.45, y=-0.05, fx=0.9, fz=-0.9)
    elif style == 'attention':  # Guarda Roku: stiff at attention, and every loop a little wobble
        rig.add(p, 'chest', X, -0.07)
        wob = math.exp(-((t - 0.6) / 0.08) ** 2)
        rig.add(p, 'spine', Y, 0.12 * wob * math.sin(ph * 6))
        rig.add(p, 'head', Z, 0.25 * wob)
        for S in free:
            arm(p, S, y=-0.04)
    elif style == 'sleepy':  # Dona Neko: the head nods off and jerks back up
        nod = max(0.0, math.sin(ph)) ** 3 if clip == 'idle' else 0.0
        rig.add(p, 'neck', X, 0.06 + 0.14 * nod)
        rig.add(p, 'head', X, 0.04 + 0.12 * nod)
        rig.add(p, 'chest', Z, 0.04 * math.sin(ph * 0.5))
        if clip == 'idle':
            arm(p, 'R', x=-0.2, fx=-0.6, fz=0.4)  # the left arm keeps the pillow
    elif style == 'hands_belly':  # Tanuki: both paws on the round belly, patting it
        pat = 0.1 * max(0.0, math.sin(ph * 2))
        for S in free:
            arm(p, S, x=-0.3, y=0.1, fx=-1.0 - pat, fz=0.85)
        rig.add(p, 'chest', X, -0.05)
    elif style == 'crossed':  # Kuro: arms crossed, head a little down, tail flicking
        rig.add(p, 'head', X, 0.08)
        for S in free:
            arm(p, S, x=-0.45 if S == 'L' else -0.3, y=-0.12, fx=-1.35, fz=1.25)
        rig.add(p, 'tail.4', Y, 0.4 * math.sin(ph * 3))
    elif style == 'hips':  # Seu Bigodes: proud, chest out, fist on the hip (the right hand holds the fish)
        rig.add(p, 'chest', X, -0.1)
        rig.add(p, 'chest', Z, 0.06 * math.sin(ph))
        if 'L' in free:
            arm(p, 'L', y=0.65, fy=-1.7, fx=0.25)
    elif style == 'bouncy':  # Pipo: can't keep still
        hips_loc(0.025 * abs(math.sin(ph * 2)))
        rig.add(p, 'head', Y, 0.1 * math.sin(ph * 2))
        for S in free:
            arm(p, S, y=0.2 + 0.15 * abs(math.sin(ph * 2)), fx=-0.3)
    elif style == 'clipboard':  # Liria: reads her notes, head tilted
        rig.add(p, 'head', Y, 0.12)
        rig.add(p, 'head', X, 0.1)
        if 'L' in free:
            arm(p, 'L', x=-0.3, fx=-1.25, fz=0.55)
        if clip == 'idle':
            arm(p, 'R', x=-0.25, fx=-0.9 - 0.15 * max(0.0, math.sin(ph * 2)), fz=0.6)  # pencil hand taps
    elif style == 'ready':  # Kaito: athletic stance, bouncing on the toes
        k = 0.85 if clip != 'walk' else 0.0
        if k:
            for S in ('L', 'R'):
                rig.add(p, f'thigh.{S}', X, -0.32 * k)
                rig.add(p, f'shin.{S}', X, 0.64 * k)
                rig.add(p, f'foot.{S}', X, -0.32 * k)
            hips_loc(-0.012 + 0.008 * math.sin(ph * 4))
        rig.add(p, 'spine', X, 0.12)
        for S in free:
            arm(p, S, x=-0.3, fx=-1.0)
    elif style == 'guard':  # Tsubaki: upright, left fist on the hip, naginata at her side
        rig.add(p, 'chest', X, -0.04)
        if 'L' in free:
            arm(p, 'L', y=0.6, fy=-1.6, fx=0.2)
    return p


def skin_cloth(obj, arm, cfg):
    A = anatomy(cfg['width'])
    groups = {}

    def g(name):
        if name not in groups:
            groups[name] = obj.vertex_groups.new(name=name)
        return groups[name]

    def seg_t(p, a, b):
        ab = b - a
        return max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))

    kind = obj.name.split('.')[0]
    S = 'L' if obj.name.endswith('.L') else 'R'
    s = 1 if S == 'L' else -1
    mw = obj.matrix_world
    for v in obj.data.vertices:
        p = mw @ v.co
        w = {}
        if kind == 'sleeve':
            sh, el, wr = side(A['shoulder'], s), side(A['elbow'], s), side(A['wrist'], s)
            t1 = seg_t(p, sh, el)
            t2 = seg_t(p, el, wr)
            if (p - (sh + (el - sh) * t1)).length < (p - (el + (wr - el) * t2)).length:
                k = max(0.0, (t1 - 0.75) / 0.25) * 0.5
                w = {f'upperarm.{S}': 1 - k, f'forearm.{S}': k}
            else:
                k = max(0.0, (0.25 - t2) / 0.25) * 0.5
                w = {f'forearm.{S}': 1 - k, f'upperarm.{S}': k}
        elif kind == 'pants':
            z = p.z
            k = max(0.0, min(1.0, (A['knee'].z + 0.03 - z) / 0.06))
            w = {f'thigh.{S}': 1 - k, f'shin.{S}': k}
            if z > A['hip'].z:
                w = {f'thigh.{S}': 0.6, 'hips': 0.4}
        else:  # robe
            z = p.z
            if z > 0.46:
                w = {'chest': 0.75, 'neck': 0.25}
            elif z > 0.4:
                w = {'chest': 1.0}
            elif z > 0.32:
                k = (z - 0.32) / 0.08
                w = {'chest': k, 'spine': 1 - k}
            elif z > 0.22:
                k = (z - 0.22) / 0.1
                w = {'spine': k, 'hips': 1 - k}
            else:
                # skirt: mostly the hips, a little of the leg on its side so it sways with the stride
                leg = 0.35 * min(1.0, (0.22 - z) / 0.15) * min(1.0, abs(p.x) / 0.08)
                side_name = 'L' if p.x > 0 else 'R'
                w = {'hips': 1 - leg, f'thigh.{side_name}': leg}
        for name, val in w.items():
            if val > 0:
                g(name).add([v.index], val, 'REPLACE')
    mw0 = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = 'OBJECT'
    bpy.context.view_layer.update()
    obj.matrix_world = mw0
    mod = obj.modifiers.new('rig', 'ARMATURE')
    mod.object = arm


def build_rig_and_export(name, cfg, parts):
    data = bpy.data.armatures.new(f'{name}_rig')
    arm = base.link(bpy.data.objects.new(name, data))
    base.activate(arm)
    bpy.ops.object.mode_set(mode='EDIT')
    for bn, h, tl, parent, deform in bone_table(cfg):
        eb = data.edit_bones.new(bn)
        eb.head, eb.tail = Vector(h), Vector(tl)
        eb.use_deform = deform
        if parent:
            eb.parent = data.edit_bones[parent]
    for ear in parts['ears']:
        S = 'L' if ear.location.x > 0 else 'R'
        eb = data.edit_bones.new(f'ear.{S}')
        up = (ear.matrix_world.to_3x3().normalized() @ Vector((0, 0, 1))).normalized()
        eb.head = ear.matrix_world.translation
        eb.tail = eb.head + up * 0.12
        eb.parent = data.edit_bones['head']
        eb.use_deform = False
    bpy.ops.object.mode_set(mode='OBJECT')

    # the fur body gets automatic (heat) weights
    base.activate(parts['body'])
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    # clothes get hand-made weights: heat weights let the arms (which hang against the torso)
    # pull the kimono up like a cape whenever a villager waves or cheers
    for cloth in parts['clothes']:
        skin_cloth(cloth, arm, cfg)
    head_pieces = [e['eye'] for e in parts['eyes']] + [h for e in parts['eyes'] for h in e['highlights']] + [parts['nose']] + parts['whiskers']
    head_pieces += parts['extras'].pop('head', [])
    rig.bone_parent(base.join(head_pieces, 'headparts'), arm, 'head')
    for e in parts['eyes']:
        rig.bone_parent(e['pupil'], arm, 'head')
        rig.bone_parent(e['lid'], arm, 'head')
    rig.bone_parent(parts['mouth'], arm, 'head')
    for ear in parts['ears']:
        rig.bone_parent(ear, arm, f'ear.{"L" if ear.location.x > 0 else "R"}')
    for bone, objs in parts['extras'].items():
        if objs:
            rig.bone_parent(base.join(objs, f'extra_{bone.replace(".", "")}'), arm, bone)

    scene = bpy.context.scene
    scene.render.fps = rig.FPS
    poser = rig.Poser(arm)
    ad = arm.animation_data_create()
    actions = {}
    for cname, fn, frames, loop in CLIPS:
        act = bpy.data.actions.new(cname)
        act.use_fake_user = True
        ad.action = act
        for f in range(frames + 1):
            t = (f / frames) % 1.0 if loop else f / frames
            poser.key(f, style_pose(fn(t), cfg, t, cname))
        actions[cname] = act
        track = ad.nla_tracks.new()
        track.name = cname
        track.strips.new(cname, 0, act)
        track.mute = True
    ad.action = None
    rig.clear_pose(arm)
    os.makedirs(OUT_DIR, exist_ok=True)
    rig.export(os.path.join(OUT_DIR, f'{name}.glb'))
    return arm, actions


# ── Build one character ──────────────────────────────────────────────────────
def build_character(name, cfg):
    base.reset_scene()
    # point the shared face helpers at the villager's head, colors and ears
    base.HEAD = HEAD
    base.WHITE = C(cfg['light']) if cfg.get('calico') or cfg.get('calico_light') else C(cfg['fur'])
    base.BLACK = C(cfg['ear'])
    body = build_body(cfg)
    base.paint(body, fur_fn(cfg))
    base.assign(body, base.material('fur', rough=0.9))

    eyes = []
    for s in (1, -1):
        e = base.build_eye(body, s)
        iris = C(cfg['iris'])
        top = tuple(c * 0.45 for c in iris)
        bottom = tuple(min(1.0, c * 1.25 + 0.15) for c in iris)
        eye = e['eye']

        def iris_fn(co, nor, eye=eye, top=top, bottom=bottom):
            local = eye.matrix_world.inverted() @ co
            lv = local.normalized()
            theta = math.acos(max(-1.0, min(1.0, -lv.y)))
            if theta > 1.05:
                return (0.08, 0.07, 0.09)
            if theta > 0.9:
                return tuple(c * 0.3 for c in top)
            h = (local.z + 1) / 2
            col = tuple(bottom[i] + (top[i] - bottom[i]) * h for i in range(3))
            ring = max(0.0, (theta - 0.66) / 0.24)
            return tuple(col[i] * (1 - 0.5 * ring) for i in range(3))

        base.paint(eye, iris_fn)
        eyes.append(e)
    mouth, nose = base.build_mouth(body)
    parts = dict(
        body=body, eyes=eyes, mouth=mouth, nose=nose,
        whiskers=base.build_whiskers(body) if cfg.get('whiskers', True) else [],
        ears=[build_round_ear(s, cfg) if cfg.get('ears') == 'round' else base.build_ear(s) for s in (1, -1)],
        clothes=build_robe(body, cfg),
        extras=build_extras(body, cfg),
    )
    return parts


def render_preview(name):
    cam = base.setup_render()
    base.render_views(cam, f'villager_{name}', target=(0, -0.02, 0.55), dist=2.6, views={'front': -90, 'tq': -55, 'side': 0}, height=0.25)


def main():
    names = list(CAST) if CHAR == 'all' else CHAR.split(',')
    for name in names:
        cfg = CAST[name]
        parts = build_character(name, cfg)
        if STAGE == 'model':
            render_preview(name)
            continue
        arm, actions = build_rig_and_export(name, cfg, parts)
        cam = base.setup_render()
        for clip, frame in (('idle', 15), ('walk', 6), ('talk', 12), ('wave', 9), ('cheer', 6)):
            rig.set_pose(arm, actions[clip], frame)
            base.render_views(cam, f'vpose_{name}_{clip}', target=(0, -0.02, 0.6), dist=2.8, views={'f': -70, 's': 15} if clip == 'idle' else {'f': -70}, height=0.3)
        rig.clear_pose(arm)
        print('BUILT', name)


main()
