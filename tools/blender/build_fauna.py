"""
Builds the deer of the Clareira dos Cervos and the Campina das Ervas (sika deer, in the game's toon style) and
exports one rigged, animated GLB each: fauna_cervo.glb (the stag), fauna_cerva.glb (a doe), fauna_filhote.glb
(a fawn: built at a grown deer's size with a fawn's proportions; the game scales it down).

Run (headless):
  blender -b --factory-startup --python tools/blender/build_fauna.py -- --kind all --stage full --out <dir>
  blender -b --factory-startup --python tools/blender/build_fauna.py -- --kind cervo --stage model --out <dir>

Stages: model = the model and preview renders; full = model + rig + clips + GLB + pose renders.
The raw GLBs go to --out; tools/blender/compress_fauna.sh puts the compressed copies in the game.

Contract with the game (world/DeerModel.tsx):
  * Blender: Z up, faces -Y, hooves on z = 0. glTF/three.js: Y up, faces +Z. 1 unit = 1 meter.
  * One skinned mesh (one primitive per material) on bones: root body neck head, two bones a leg
    (leg.FL / leg.FL.2: shoulder to knee, knee to hoof; the hind ones hip to hock, hock to hoof), tail.1 tail.2,
    ear.L ear.R.
  * Clips (loops): idle, graze, walk, run, alert.
  * Materials by name, as the creatures': fur (toon, outlined), pad (nose, hooves, the white spots), wood (the
    antlers), eye, gloss. Colors are vertex colors.

Built on build_enemies.py's helpers (metaball blobs, toon eyes, the poser with squash and stretch).
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_shinichi as base  # noqa: E402
import build_rig as rig  # noqa: E402
import build_enemies as en  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
KIND = argv[argv.index('--kind') + 1] if '--kind' in argv else 'all'
STAGE = argv[argv.index('--stage') + 1] if '--stage' in argv else 'full'
OUT = argv[argv.index('--out') + 1] if '--out' in argv else os.path.join(HERE, '_fauna')

C, mix, smooth = en.C, en.mix, en.smooth
part, blob, ell, tube = en.part, en.blob, en.ell, en.tube
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
LEGS = ('FL', 'FR', 'BL', 'BR')


def ell_axes(name, center, semi, up, face):
    """An ellipsoid whose local z runs along `up` and whose thin local y faces `face` (ears)."""
    o = base.add_uv_sphere(name, 1.0, 18, 12)
    z = Vector(up).normalized()
    y = (Vector(face) - z * Vector(face).dot(z)).normalized()
    x = y.cross(z).normalized()
    m = Matrix((x, y, z)).transposed().to_4x4() @ Matrix.Diagonal((*semi, 1))
    m.translation = Vector(center)
    o.matrix_world = m
    bpy.context.view_layer.update()
    return o


def blend(a, b, k):
    """Weights split between two bones (k = how much of b)."""
    k = max(0.0, min(1.0, k))
    if k <= 0:
        return {a: 1.0}
    if k >= 1:
        return {b: 1.0}
    return {a: 1 - k, b: k}


# ── The deer ────────────────────────────────────────────────────────────────────
def build_deer(cfg):
    """A sika deer: a deep chest and slim waist, long legs with real joints (knee, hock, fetlock) on split hooves,
    a long neck, a wedge of a head with big soft eyes and big ears, white spots in rows along a dark back line,
    the white rump with its dark rim and the little white tail; the stag carries branching antlers."""
    B, H, L, N, E = cfg['body'], cfg['head'], cfg['legs'], cfg['neck'], cfg['ears']
    fur, dark, cream, white = C(cfg['fur']), C(cfg['dark']), C('#EFDDBF'), C('#FFF6E6')
    shin = mix(fur, C('#D8B48A'), 0.35)
    hoof = C('#3A2E2C')
    zc = 0.6 * L + 0.18 * B  # the body's centre height

    # legs: shoulder, elbow, the knee (the wrist), the slim cannon, the fetlock and the pastern; behind, the full
    # thigh, the stifle forward and the hock back. Two bones each.
    lx = 0.074 * B
    fy, hy = -0.2 * B, 0.21 * B
    legs, leg_el = {}, []
    for name in LEGS:
        s = 1 if name.endswith('L') else -1
        x = s * lx
        if name[0] == 'F':
            pts = [((x, fy, zc + 0.04 * B), 0.07 * B), ((x, fy + 0.03, zc - 0.16 * B), 0.052 * B),
                   ((x, fy, 0.33 * L), 0.032), ((x, fy - 0.004, 0.31 * L), 0.034), ((x, fy - 0.01, 0.11 * L), 0.022),
                   ((x, fy - 0.016, 0.075 * L), 0.026), ((x, fy - 0.03, 0.035), 0.022)]
            knee = Vector((x, fy - 0.004, 0.31 * L))
        else:
            pts = [((x, hy + 0.03, zc + 0.03 * B), 0.08 * B), ((x, hy - 0.01, zc - 0.13 * B), 0.075 * B),
                   ((x, hy - 0.05, zc - 0.25 * B), 0.048 * B), ((x, hy + 0.09, 0.35 * L), 0.033),
                   ((x, hy + 0.11, 0.33 * L), 0.03), ((x, hy + 0.06, 0.11 * L), 0.022),
                   ((x, hy + 0.05, 0.075 * L), 0.026), ((x, hy + 0.035, 0.035), 0.022)]
            knee = Vector((x, hy + 0.1, 0.34 * L))
        for k in range(len(pts) - 1):
            leg_el += en.chain([pts[k][0], pts[k + 1][0]], [pts[k][1], pts[k + 1][1]], 0.012)
        foot = Vector(pts[-1][0])
        legs[name] = (Vector(pts[0][0]), knee, Vector((foot.x, foot.y, 0.0)), foot)

    # neck: deep and narrow, from inside the chest up and forward to the head (grown out of the body too)
    nb = Vector((0, -0.27 * B, zc + 0.06 * B))
    nt = nb + Vector((0, -0.15, 0.4)) * N
    hc = nt + Vector((0, -0.05, 0.05)) * H
    nr = cfg['neck_r']
    neck_el = []
    for i in range(9):
        t = i / 8
        p = nb.lerp(nt, t) + Vector((0, 0.015 * math.sin(math.pi * t), 0))
        r = nr * (1 - 0.32 * t) * (1.15 if i == 0 else 1)
        neck_el.append((tuple(p), (r * 0.78, r, r * 1.05)))
    neck_el.append((tuple(nt + Vector((0, -0.02, -0.02))), (0.055 * H, 0.06 * H, 0.06 * H)))  # throat
    ncol = C(cfg.get('mane', cfg['fur']))
    axis = nt - nb

    def neckness(co):
        t = (co - nb).dot(axis) / axis.length_squared
        radial = (co - (nb + axis * t)).length
        return smooth(-0.12, 0.08, t) * smooth(nr * 1.9, nr * 1.35, radial), t

    def neck_col(co, n, t):
        t = max(0.0, min(1.0, t))
        c = mix(fur, ncol, smooth(0.0, 0.3, t))
        c = mix(c, dark, smooth(0.03, 0.01, abs(co.x)) * smooth(0.5, 0.8, n.z + n.y * 0.6) * (1 - t) * 0.8)
        # the pale throat patch
        return mix(c, cream, smooth(-0.35, -0.7, n.y) * smooth(0.55, 0.85, t))

    def neck_w(t):
        if t < 0.3:
            return blend('body', 'neck', smooth(-0.15, 0.3, t))
        return blend('neck', 'head', smooth(0.88, 1.05, t))

    # body and legs are one smooth piece: chest, barrel, rump, the withers and the brisket, with the legs grown out
    body = blob('body', [
        ((0, -0.19 * B, zc + 0.02 * B), (0.155 * B, 0.2 * B, 0.19 * B)),
        ((0, 0.02 * B, zc), (0.16 * B, 0.22 * B, 0.165 * B)),
        ((0, 0.22 * B, zc + 0.02 * B), (0.15 * B, 0.16 * B, 0.17 * B)),
        ((0, -0.2 * B, zc + 0.14 * B), (0.085 * B, 0.12 * B, 0.08 * B)),
        ((0, -0.3 * B, zc - 0.05 * B), (0.105 * B, 0.08 * B, 0.11 * B)),
    ] + leg_el + neck_el, voxel=0.0062, keep=0.1)

    def which(co):
        return ('F' if co.y < 0.0 else 'B') + ('L' if co.x > 0 else 'R')

    def legness(co):
        """0 in the body, 1 down the leg: below the belly and close to that leg's line."""
        name = which(co)
        top, knee, _, _ = legs[name]
        side = math.hypot(co.x - top.x, co.y - (top.y + knee.y) / 2)
        return smooth(zc - 0.05 * B, zc - 0.2 * B, co.z) * smooth(0.13 * B, 0.08 * B, side), name, knee

    def body_col(co, n):
        k, name, knee = legness(co)
        s = 1 if co.x > 0 else -1
        c = fur
        # the dark line down the back
        c = mix(c, dark, smooth(0.035 * B, 0.012 * B, abs(co.x)) * smooth(0.55, 0.85, n.z))
        # the cream belly and the inside of the legs
        c = mix(c, cream, smooth(-0.25, -0.6, n.z) * (1 - k))
        c = mix(c, cream, smooth(-0.35, -0.75, n.x * s) * 0.75 * k)
        # the white rump, rimmed dark
        rump = smooth(0.2 * B, 0.28 * B, co.y) * smooth(zc - 0.17 * B, zc - 0.07 * B, co.z)
        c = mix(c, dark, smooth(0.18, 0.3, n.y) * rump * (1 - smooth(0.36, 0.46, n.y)) * 0.85)
        c = mix(c, white, rump * smooth(0.4, 0.5, n.y) * smooth(0.12 * B, 0.09 * B, abs(co.x)))
        # paler shins below the knee and the hock, and the white tuft outside the hind cannon
        c = mix(c, shin, smooth(knee.z + 0.12, knee.z + 0.02, co.z))
        if name[0] == 'B' and abs(co.z - (knee.z - 0.08)) < 0.028 and n.x * s > 0.45:
            c = mix(c, white, 0.9)
        nk, t = neckness(co)
        return mix(c, neck_col(co, n, t), nk) if nk > 0 else c

    def body_w(co):
        nk, t = neckness(co)
        if nk > 0 and co.z > zc:
            w = {bn: v * nk for bn, v in neck_w(t).items()}
            w['body'] = w.get('body', 0.0) + 1 - nk
            return w
        k, name, knee = legness(co)
        if k <= 0:
            return {'body': 1.0}
        lower = smooth(knee.z + 0.05, knee.z - 0.05, co.z)
        w = {}
        if k < 1:
            w['body'] = 1 - k
        if lower < 1:
            w[f'leg.{name}'] = k * (1 - lower)
        if lower > 0:
            w[f'leg.{name}.2'] = k * lower
        return w
    part(body, 'fur', body_col, body_w)

    # the cloven hooves: two toes, and the dewclaws behind
    for name in LEGS:
        foot = legs[name][3]
        low = f'leg.{name}.2'
        for t in (1, -1):
            part(ell('toe', foot + Vector((t * 0.011, -0.012, -0.012)), (0.012, 0.022, 0.024), forward=(0, -0.5, -1), segs=10, rings=6), 'pad', hoof, low)
            part(ell('dew', foot + Vector((t * 0.013, 0.02, 0.03)), (0.006, 0.008, 0.008), segs=6, rings=4), 'pad', hoof, low)

    # spots: little discs set into the coat, in rows each side of the back line (a fawn has more of them)
    rows = cfg['spots']
    for s in (1, -1):
        for ri, (dz, tilt, y0, y1, step, r) in enumerate(rows):
            y = y0 * B
            k = 0
            while y <= y1 * B + 1e-6:
                yy = y + (step * B * 0.5 if ri % 2 else 0)
                try:
                    hit = en.on_surface(body, (0, yy, zc + dz * B), (s, 0, tilt))
                except RuntimeError:
                    hit = None
                if hit:
                    loc, nor = hit
                    rr = r * B * (0.85 + 0.3 * ((k * 7 + ri * 3) % 5) / 4)
                    d = ell('spot', loc - nor * 0.003, (rr * 1.25, 0.005, rr), forward=tuple(nor), segs=8, rings=4)
                    part(d, 'pad', white, 'body')
                y += step * B
                k += 1

    # head: the round brow, a long face tapering to the muzzle, cheeks and the jaw
    def h(v):
        return tuple(hc + Vector(v) * H)
    head = blob('head', [
        (h((0, 0, 0)), (0.072 * H, 0.085 * H, 0.072 * H)),
        (h((0, -0.1, -0.03)), (0.058 * H, 0.08 * H, 0.054 * H)),
        (h((0, -0.19, -0.065)), (0.04 * H, 0.06 * H, 0.04 * H)),
        (h((0.042, -0.035, -0.035)), (0.035 * H, 0.05 * H, 0.04 * H)),
        (h((-0.042, -0.035, -0.035)), (0.035 * H, 0.05 * H, 0.04 * H)),
        (h((0, -0.09, -0.07)), (0.042 * H, 0.075 * H, 0.03 * H)),
    ], voxel=0.007)
    eyes = []
    for s in (1, -1):
        hit = en.on_surface(head, h((s * 0.05, -0.06, 0.012)), (s, -0.45, 0.25))
        eyes.append(hit[0])
    ew = cfg['eye'] * H
    muzzle = Vector(h((0, -0.2, -0.06)))

    def head_col(co, n):
        L_ = co - hc
        c = fur
        # the forehead a shade darker, the muzzle paler, the chin and lips white
        c = mix(c, tuple(v * 0.85 for v in fur), smooth(0.02 * H, 0.06 * H, L_.z) * smooth(-0.05 * H, 0.0, L_.y))
        c = mix(c, mix(fur, cream, 0.55), smooth(-0.12 * H, -0.17 * H, L_.y))
        c = mix(c, white, smooth(-0.04 * H, -0.075 * H, L_.z) * smooth(-0.06 * H, -0.12 * H, L_.y))
        c = mix(c, white, smooth(-0.3, -0.7, n.z) * smooth(-0.05 * H, -0.08 * H, L_.y))
        # a pale ring round each eye
        for e in eyes:
            d = (co - e).length
            c = mix(c, cream, smooth(ew * 1.75, ew * 1.35, d))
        return c
    part(head, 'fur', head_col, 'head')
    for s, e in zip((1, -1), eyes):
        en.eye(head, h((s * 0.05, -0.06, 0.012)), (s, -0.45, 0.25), ew * 1.1, ew * 0.92, C('#3A2418'))
    # the nose: dark, wide and soft, with two nostrils
    tip = en.on_surface(head, tuple(muzzle), (0, -1, 0.15))[0]
    part(ell('nose', tip + Vector((0, 0.004, 0.004)), (0.026 * H, 0.016 * H, 0.019 * H), forward=(0, -1, 0.3)), 'pad', C('#2B2226'), 'head')
    for s in (1, -1):
        part(ell('nostril', tip + Vector((s * 0.011 * H, -0.01 * H, 0.0)), (0.006 * H, 0.004, 0.008 * H), forward=(s * 0.4, -1, 0.1)), 'pad', (0.08, 0.06, 0.07), 'head')
    # ears: big, cupped, set high at the back of the head and held out to the sides
    for s in (1, -1):
        b = Vector(h((s * 0.05, 0.035, 0.05)))
        d = Vector((s * 0.85, 0.15, 0.55)).normalized()
        ln, wd = 0.1 * E, 0.048 * E
        o = ell_axes('ear', b + d * ln * 0.95, (wd, 0.016 * E, ln), d, (s * -0.3, -1, 0.15))
        inner = cream
        rim = dark

        def ear_col(co, n, b=b, d=d, ln=ln, o=o):
            Lc = o.matrix_world.inverted() @ co
            out = (co - b).dot(d) / (2 * ln)
            c = fur
            if Lc.y < 0.2 and math.hypot(Lc.x, Lc.z) < 0.8:
                c = mix(C('#F2D9C4'), inner, smooth(0.2, 0.7, out))
            return mix(c, rim, smooth(0.86, 0.96, out) * 0.85)
        tipp = b + d * ln * 1.9
        part(o, 'fur', ear_col, en.ear_bone(tuple(b), tuple(tipp)))
    # the tail: short and white, a dark line down the top
    tl = [(0, 0.36 * B, zc + 0.11 * B), (0, 0.41 * B, zc + 0.05 * B), (0, 0.43 * B, zc - 0.03 * B)]
    tail = blob('tail', en.chain(tl, [0.026, 0.024, 0.015], 0.01), voxel=0.006, keep=0.35)
    part(tail, 'fur', lambda co, n: mix(white, dark, smooth(0.6, 0.85, n.y) * smooth(0.016, 0.006, abs(co.x))), en.along(tl, ['tail.1', 'tail.2']))
    # antlers: two beams up and back from the burrs, a brow tine forward and two tines at the top
    if cfg.get('antlers'):
        bone_c, burr_c = C('#EBDDBE'), C('#8C6A48')
        for s in (1, -1):
            a0 = Vector(h((s * 0.035, 0.0, 0.062)))
            beam = [a0, a0 + Vector((s * 0.03, 0.025, 0.09)), a0 + Vector((s * 0.065, 0.06, 0.18)),
                    a0 + Vector((s * 0.08, 0.065, 0.26)), a0 + Vector((s * 0.075, 0.03, 0.33))]
            col = (lambda co, n, a0=a0: mix(burr_c, bone_c, smooth(a0.z + 0.01, a0.z + 0.12, co.z)))
            part(tube('beam', beam, [0.022, 0.019, 0.015, 0.011, 0.004], segs=8), 'wood', col, 'head')
            part(ell('burr', a0 + Vector((0, 0, 0.012)), (0.022, 0.022, 0.009), forward=(0, 0, 1), segs=10, rings=5), 'wood', burr_c, 'head')
            for p0, p1 in ((beam[1] + Vector((0, -0.005, -0.035)), beam[1] + Vector((s * 0.01, -0.1, 0.03))),
                           (beam[3], beam[3] + Vector((s * 0.01, -0.075, 0.05))),
                           (beam[2] + Vector((0, 0.01, 0.025)), beam[2] + Vector((s * 0.02, 0.08, 0.1)))):
                mid = p0.lerp(p1, 0.5) + Vector((0, 0, 0.02))
                part(tube('tine', [p0, mid, p1], [0.011, 0.008, 0.003], segs=6), 'wood', col, 'head')

    hips, chest = (0, 0.22 * B, zc), (0, -0.2 * B, zc)
    bones = [('root', (0, 0, 0), (0, 0, 0.12), None), ('body', hips, chest, 'root'),
             ('neck', tuple(nb), tuple(nt), 'body'), ('head', tuple(nt), tuple(muzzle), 'neck')]
    for name in LEGS:
        top, knee, foot, _ = legs[name]
        bones.append((f'leg.{name}', tuple(top), tuple(knee), 'body'))
        bones.append((f'leg.{name}.2', tuple(knee), tuple(foot), f'leg.{name}'))
    bones.append(('tail.1', tl[0], tl[1], 'body'))
    bones.append(('tail.2', tl[1], tl[2], 'tail.1'))
    return bones


# ── Clips ───────────────────────────────────────────────────────────────────────
def clips(cfg):
    add, loc = en.add, en.loc

    def legs(p, t, amp, duty, phases, flex_f, flex_h):
        """Each leg: swing at the shoulder or hip; while it is in the air the knee folds back and the hock forward."""
        for name, ph in zip(LEGS, phases):
            ang, lift = rig.gait(t, ph, duty, amp)
            add(p, f'leg.{name}', X, ang)
            if name[0] == 'F':
                add(p, f'leg.{name}.2', X, flex_f * lift)
            else:
                add(p, f'leg.{name}', X, -0.25 * flex_h * lift)
                add(p, f'leg.{name}.2', X, -flex_h * lift)

    def ears(p, back=0.0, out=0.0, twitch=(0.0, 0.0)):
        for bn, sgn, tw in (('ear.L', 1, twitch[0]), ('ear.R', -1, twitch[1])):
            add(p, bn, X, -back)
            add(p, bn, Y, sgn * (out + tw))

    def blip(t, a, b):
        return math.sin(math.pi * smooth(a, b, t)) if a <= t <= b else 0.0

    def tail(p, t, flick=0.0, up=0.0):
        add(p, 'tail.1', X, -up)
        add(p, 'tail.2', X, -up * 0.5)
        add(p, 'tail.1', Z, flick)

    def idle(t):
        # standing about: breathing, a look one way and the other, an ear flick, a tail flick
        p = {}
        s = math.sin(2 * math.pi * t)
        loc(p, 'body', (0, 0, 0.004 * s))
        look = math.sin(2 * math.pi * t) * smooth(0.1, 0.3, t) * (1 - smooth(0.7, 0.9, t))
        add(p, 'neck', X, -0.06 + 0.03 * math.sin(4 * math.pi * t))
        add(p, 'neck', Z, 0.22 * look)
        add(p, 'head', Z, 0.15 * look)
        add(p, 'head', X, 0.05 * math.sin(2 * math.pi * t + 1))
        ears(p, twitch=(0.5 * blip(t, 0.42, 0.48), 0.5 * blip(t, 0.78, 0.83)))
        tail(p, t, flick=0.5 * blip(t, 0.6, 0.66) - 0.5 * blip(t, 0.66, 0.72))
        return p

    def graze(t):
        # head down in the grass: front legs spread a little, a bite, chewing, a small step of the head aside
        p = {}
        loc(p, 'body', (0, 0.0, -0.03))
        add(p, 'body', X, 0.04)
        for bn in ('leg.FL', 'leg.FR'):
            add(p, bn, X, -0.12)
        for bn in ('leg.BL', 'leg.BR'):
            add(p, bn, X, -0.04)
        bite = blip(t, 0.15, 0.3) + blip(t, 0.55, 0.7)
        add(p, 'neck', X, 1.38 + 0.04 * math.sin(2 * math.pi * t))
        add(p, 'neck', Z, 0.15 * math.sin(2 * math.pi * t))
        add(p, 'head', X, -0.05 + 0.12 * bite + 0.03 * math.sin(2 * math.pi * t * 6))
        ears(p, back=0.55, out=-0.2, twitch=(0.4 * blip(t, 0.4, 0.45), 0.4 * blip(t, 0.85, 0.9)))
        tail(p, t, flick=0.4 * blip(t, 0.3, 0.36) - 0.4 * blip(t, 0.36, 0.42))
        return p

    def walk(t):
        # four beats: hind left, fore left, hind right, fore right
        p = {}
        legs(p, t, 0.32, 0.62, (0.25, 0.75, 0.0, 0.5), 1.0, 0.8)
        loc(p, 'body', (0, 0, 0.012 * math.cos(4 * math.pi * t)))
        add(p, 'body', Y, 0.025 * math.sin(2 * math.pi * t))
        add(p, 'neck', X, 0.12 + 0.05 * math.sin(4 * math.pi * t + 0.6))
        add(p, 'head', X, -0.04 * math.sin(4 * math.pi * t + 0.6))
        ears(p, back=0.08 * math.sin(4 * math.pi * t))
        tail(p, t, flick=0.12 * math.sin(2 * math.pi * t))
        return p

    def run(t):
        # a bounding gallop: the hind pair push off, the body flies, the front pair land and fold
        p = {}
        legs(p, t, 0.55, 0.36, (0.42, 0.5, 0.0, 0.07), 1.05, 0.85)
        loc(p, 'body', (0, 0, 0.03 + 0.06 * max(0.0, math.sin(2 * math.pi * (t - 0.12)))))
        add(p, 'body', X, 0.13 * math.sin(2 * math.pi * (t + 0.1)))
        add(p, 'neck', X, 0.35 - 0.1 * math.sin(2 * math.pi * (t + 0.1)))
        add(p, 'head', X, -0.1)
        ears(p, back=0.6)
        tail(p, t, up=0.9)
        p.setdefault('body', {})['scale'] = (1, 1 + 0.04 * math.sin(2 * math.pi * t), 1)
        return p

    def alert(t):
        # it has heard something: head high, ears forward, the white tail raised, and a stamp of a forefoot
        p = {}
        s = math.sin(2 * math.pi * t)
        loc(p, 'body', (0, 0.01, 0.006 + 0.003 * s))
        add(p, 'neck', X, -0.28)
        add(p, 'head', X, -0.08 + 0.02 * s)
        add(p, 'neck', Z, 0.12 * math.sin(2 * math.pi * t * 0.5))
        stamp = blip(t, 0.35, 0.5)
        add(p, 'leg.FR', X, -0.35 * stamp)
        add(p, 'leg.FR.2', X, 0.9 * stamp)
        ears(p, back=-0.35, out=-0.15, twitch=(0.25 * blip(t, 0.62, 0.68), 0.25 * blip(t, 0.8, 0.86)))
        tail(p, t, up=0.55)
        return p

    return [('idle', idle, 120), ('graze', graze, 90), ('walk', walk, 36), ('run', run, 18), ('alert', alert, 60)]


def rig_and_export(name, cfg, bones):
    arm = en.armature(name, bones)
    en.skin_all('deer', arm)
    bpy.context.scene.render.fps = rig.FPS
    poser = en.Poser(arm)
    ad = arm.animation_data_create()
    actions = {}
    for cname, fn, frames in clips(cfg):
        act = bpy.data.actions.new(cname)
        act.use_fake_user = True
        ad.action = act
        for f in range(frames + 1):
            poser.key(f, fn((f / frames) % 1.0))
        actions[cname] = act
        track = ad.nla_tracks.new()
        track.name = cname
        track.strips.new(cname, 0, act)
        track.mute = True
    ad.action = None
    rig.clear_pose(arm)
    os.makedirs(OUT, exist_ok=True)
    rig.export(os.path.join(OUT, f'fauna_{name}.glb'))
    return arm, actions


# rows of spots: (height over the body's centre, ray tilt, from y, to y, step, radius), all × the body's size
ADULT_SPOTS = [(0.15, 1.6, -0.2, 0.26, 0.068, 0.017), (0.09, 0.7, -0.14, 0.24, 0.072, 0.016), (0.03, 0.25, -0.04, 0.2, 0.08, 0.013)]
FAWN_SPOTS = [(0.15, 1.6, -0.22, 0.27, 0.06, 0.02), (0.09, 0.7, -0.2, 0.26, 0.06, 0.02), (0.03, 0.25, -0.16, 0.24, 0.065, 0.018),
              (-0.03, 0.05, -0.08, 0.2, 0.07, 0.015)]

KINDS = {
    'cervo': dict(fur='#B06B3A', dark='#5E3A24', mane='#8A5A38', body=1.08, head=1.3, legs=1.0, neck=0.86, neck_r=0.1, ears=1.12,
                  eye=0.03, spots=ADULT_SPOTS, antlers=True),
    'cerva': dict(fur='#BC7A45', dark='#6A4128', body=1.0, head=1.28, legs=1.0, neck=0.86, neck_r=0.085, ears=1.18,
                  eye=0.031, spots=ADULT_SPOTS),
    'filhote': dict(fur='#C4844C', dark='#6E4529', body=0.82, head=1.6, legs=0.94, neck=0.7, neck_r=0.08, ears=1.45,
                    eye=0.033, spots=FAWN_SPOTS),
}


def render(name, arm=None, actions=None):
    base.OUT_RENDERS = OUT
    cam = base.setup_render()
    target, dist = (0, -0.12, 0.72), 3.4
    if not arm:
        base.render_views(cam, f'fauna_{name}', target=target, dist=dist, views={'front': -90, 'tq': -55, 'side': 0, 'back': 120}, height=0.45)
        return
    for clip, frame in (('idle', 30), ('graze', 20), ('walk', 6), ('walk', 24), ('run', 4), ('run', 12), ('alert', 26)):
        rig.set_pose(arm, actions[clip], frame)
        base.render_views(cam, f'fpose_{name}_{clip}{frame:02d}', target=target, dist=dist, views={'tq': -55, 'side': 0}, height=0.45)
    rig.clear_pose(arm)


def main():
    names = list(KINDS) if KIND == 'all' else KIND.split(',')
    for name in names:
        cfg = KINDS[name]
        base.reset_scene()
        en.PARTS.clear()
        en.EARS.clear()
        bones = build_deer(cfg) + [(bn, b, t, 'head') for bn, b, t in en.EARS]
        if STAGE == 'model':
            render(name)
            continue
        arm, actions = rig_and_export(name, cfg, bones)
        render(name, arm, actions)
        print('BUILT', name)


if __name__ == '__main__':
    main()
