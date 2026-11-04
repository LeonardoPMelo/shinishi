"""
Builds the creatures of the wild lands (the bandits of the Espinho band and the forest's own) and exports one
rigged, animated GLB each: enemy_<kind>.glb.

Run (headless):
  blender -b --factory-startup --python tools/blender/build_enemies.py -- --kind all --stage full --out <dir>
  blender -b --factory-startup --python tools/blender/build_enemies.py -- --kind raposa --stage model --out <dir>

Stages: model = the model and preview renders; full = model + rig + clips + GLB + pose renders.
The raw GLBs go to --out; tools/blender/compress_enemies.sh puts the compressed copies in the game.

Contract with the game (world/EnemyModel.tsx):
  * Blender: Z up, faces -Y, feet on z = 0. glTF/three.js: Y up, faces +Z. 1 unit = 1 meter.
  * One skinned mesh (one primitive per material) on bones: root body head leg.FL leg.FR leg.BL leg.BR tail.1 tail.2
    (the spirit has no legs).
  * Clips: idle, walk, run, windup, attack, stunned, sleep (all loop; attack is one lunge and back).
  * Materials by name, as the villagers': fur (toon, outlined), cloth (outlined), leather (outlined), metal, pad,
    wood, eye, gloss. Colors are vertex colors.
  * The game still owns the windup shake, the hit flash, the red glow, the defeat shrink and the marks overhead.
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

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
KIND = argv[argv.index('--kind') + 1] if '--kind' in argv else 'all'
STAGE = argv[argv.index('--stage') + 1] if '--stage' in argv else 'full'
OUT = argv[argv.index('--out') + 1] if '--out' in argv else os.path.join(HERE, '_enemies')


def C(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ── Geometry helpers ─────────────────────────────────────────────────────────────
PARTS = []  # (object, weights) — weights: bone name, or fn(world_co) -> {bone: w}


def part(obj, mat, color, bone):
    """Colors (an rgb or fn(co, nor) -> rgb), material, smooth shading, and the bone(s) it rides."""
    base.paint(obj, color if callable(color) else (lambda co, n, c=color: c))
    base.assign(obj, base.material(mat, rough=0.8))
    base.shade_smooth(obj)
    PARTS.append((obj, bone))
    return obj


def blob(name, elements, voxel=0.01, keep=0.25):
    """Metaball ellipsoids → one smooth mesh (as Shinichi's body)."""
    mb = bpy.data.metaballs.new(name)
    mb.resolution = voxel
    mb.threshold = 0.6
    obj = base.link(bpy.data.objects.new(name, mb))
    for c, semi in elements:
        m = max(semi)
        el = mb.elements.new()
        el.type = 'ELLIPSOID'
        el.co = c
        el.radius = m / base.SURF
        el.size_x, el.size_y, el.size_z = semi[0] / m, semi[1] / m, semi[2] / m
        el.stiffness = 2.0
    base.activate(obj)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    rem = o.modifiers.new('remesh', 'REMESH')
    rem.mode = 'VOXEL'
    rem.voxel_size = voxel
    sm = o.modifiers.new('smooth', 'CORRECTIVE_SMOOTH')
    sm.iterations = 6
    sm.use_only_smooth = True
    dec = o.modifiers.new('decimate', 'DECIMATE')
    dec.ratio = keep
    base.apply_modifiers(o)
    o.data.validate(clean_customdata=False)
    return o


def chain(points, radii, step):
    """Ellipsoid elements along a polyline (limbs, tails, a weasel's body)."""
    out = []
    for i in range(len(points) - 1):
        a, b = Vector(points[i]), Vector(points[i + 1])
        n = max(1, int((b - a).length / step))
        for k in range(n + (1 if i == len(points) - 2 else 0)):
            t = k / n
            r = radii[i] + (radii[i + 1] - radii[i]) * t
            out.append((tuple(a.lerp(b, t)), (r, r, r)))
    return out


def ell(name, center, semi, forward=(0, -1, 0), segs=16, rings=10):
    o = base.ellipsoid(name, center, semi, forward, segs, rings)
    return o


def cone(name, a, b, r1, r2=0.0, segs=8):
    bm = bmesh.new()
    base.cone_between(bm, a, b, r1, r2, segs)
    return base.mesh_from_bmesh(name, bm)


def tube(name, pts, radii, segs=10, cap=True):
    """A smooth tube through points (ribbons, bows, straps)."""
    bm = bmesh.new()
    rings = []
    pts = [Vector(p) for p in pts]
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        ref = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
        u = d.cross(ref).normalized()
        v = d.cross(u).normalized()
        r = radii[i] if isinstance(radii, (list, tuple)) else radii
        rings.append([bm.verts.new(p + (u * math.cos(2 * math.pi * k / segs) + v * math.sin(2 * math.pi * k / segs)) * r) for k in range(segs)])
    for j in range(len(rings) - 1):
        for k in range(segs):
            m = (k + 1) % segs
            bm.faces.new((rings[j][k], rings[j][m], rings[j + 1][m], rings[j + 1][k]))
    if cap:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    return base.mesh_from_bmesh(name, bm)


def strip(name, pts, width, normal=(0, 0, 1), thick=0.012):
    """A flat cloth strip through points (scarf tails, mask knots, a cape's hem)."""
    bm = bmesh.new()
    pts = [Vector(p) for p in pts]
    nrm = Vector(normal).normalized()
    rows = []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        s = d.cross(nrm).normalized()
        w = width[i] if isinstance(width, (list, tuple)) else width
        rows.append([bm.verts.new(p + s * w / 2), bm.verts.new(p - s * w / 2)])
    for j in range(len(rows) - 1):
        bm.faces.new((rows[j][0], rows[j][1], rows[j + 1][1], rows[j + 1][0]))
    o = base.mesh_from_bmesh(name, bm)
    base.solidify(o, thick)
    return o


def rock(name, center, r, seed):
    """A chiseled stone: an icosphere pushed in and out."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)
    for v in bm.verts:
        k = 0.78 + 0.32 * (math.sin(v.co.x * 17 + seed) * math.cos(v.co.y * 13 - seed * 2) * 0.5 + 0.5)
        v.co *= k
        v.co.z *= 0.72
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector(center))
    o = base.mesh_from_bmesh(name, bm)
    for p in o.data.polygons:
        p.use_smooth = False
    return o


def on_surface(obj, center, direction):
    """Where a ray from outside, toward `center` along -direction, meets the surface."""
    d = Vector(direction).normalized()
    return base.surface_hit(obj, Vector(center) + d * 1.5, -d)


# ── Faces ───────────────────────────────────────────────────────────────────────
def eye(head, hc, aim, w, h, iris, slit=False, bone='head', lid=None, frown=0.45):
    """A big glossy toon eye sunk a little into the head, plus a highlight. `lid`: the fur colour of an upper lid
    painted across the top of the eye, lower toward the nose (the bandit's frown)."""
    loc, nor = on_surface(head, hc, aim)
    d = w * 0.45
    center = loc - nor * d * 0.35
    e = ell('eye', center, (w, d, h), forward=tuple(nor), segs=20, rings=14)
    dark = (0.07, 0.05, 0.08)
    out_sign = 1 if loc.x > 0 else -1

    def fn(co, n, e=e):
        L = e.matrix_world.inverted() @ co
        r = math.hypot(L.x, L.z)
        if lid:
            outer = max(-1.0, min(1.0, (co.x - center.x) * out_sign / w))
            if (co.z - center.z) / h > 0.42 + frown * outer:
                return lid
        if L.y > -0.2:
            return dark
        # pupil: a slit for the foxes, round for the others
        pupil = (abs(L.x) < 0.16 and abs(L.z) < 0.62) if slit else r < 0.34
        if pupil:
            return dark
        if r > 0.86:
            return dark
        return mix(tuple(c * 0.55 for c in iris), tuple(min(1, c * 1.2 + 0.12) for c in iris), (0.5 - L.z * 0.5))

    part(e, 'eye', fn, bone)
    side = 1 if loc.x > 0 else -1
    g = ell('gloss', loc + nor * d * 0.5 + Vector((side * w * 0.3, 0, h * 0.05)), (w * 0.22, w * 0.1, w * 0.22), forward=tuple(nor), segs=10, rings=6)
    part(g, 'gloss', (1, 1, 1), bone)
    return loc, nor


def nose(head, hc, aim, r, color, bone='head'):
    loc, nor = on_surface(head, hc, aim)
    part(ell('nose', loc, (r * 1.3, r, r), forward=tuple(nor), segs=12, rings=8), 'pad', color, bone)
    return loc


def mask_band(head, hc, z, color, height=0.06, tails=True, bone='head', tilt=0.0):
    """A ninja band around the head at eye height, knotted at the back with two short tails."""
    bm = base.ring_on_surface(head, Vector((hc[0], hc[1], z)), (0, math.sin(tilt), math.cos(tilt)), [-height / 2, height / 2], outward=0.008, steps=40, max_r=0.6)
    o = base.mesh_from_bmesh('band', bm)
    base.solidify(o, 0.01)
    part(o, 'cloth', color, bone)
    if tails:
        loc, nor = on_surface(head, (hc[0], hc[1], z), (0, 1, 0))
        part(ell('knot', loc + nor * 0.01, (0.035, 0.03, 0.03), forward=tuple(nor)), 'cloth', color, bone)
        for s in (1, -1):
            pts = [loc + nor * 0.01, loc + Vector((s * 0.05, 0.07, -0.03)), loc + Vector((s * 0.08, 0.14, -0.1))]
            part(strip('tail', pts, [0.04, 0.035, 0.028], normal=(0, -0.3, 1)), 'cloth', color, bone)


# ── Rig, skin, clips, export ─────────────────────────────────────────────────────
def armature(name, bones):
    data = bpy.data.armatures.new(f'{name}_rig')
    arm = base.link(bpy.data.objects.new(name, data))
    base.activate(arm)
    bpy.ops.object.mode_set(mode='EDIT')
    for bn, h, t, parent in bones:
        eb = data.edit_bones.new(bn)
        eb.head, eb.tail = Vector(h), Vector(t)
        eb.use_deform = bn != 'root'
        if parent:
            eb.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def skin_all(name, arm):
    """Every part gets its bone weights, then all of them become one mesh on the armature."""
    objs = []
    for obj, w in PARTS:
        bpy.context.view_layer.update()
        mw = obj.matrix_world
        groups = {}
        for v in obj.data.vertices:
            ws = w(mw @ v.co) if callable(w) else {w: 1.0}
            for bn, k in ws.items():
                if k <= 0:
                    continue
                g = groups.get(bn) or obj.vertex_groups.new(name=bn)
                groups[bn] = g
                g.add([v.index], k, 'REPLACE')
        objs.append(obj)
    body = base.join(objs, name)
    base.activate(body)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mod = body.modifiers.new('rig', 'ARMATURE')
    mod.object = arm
    body.parent = arm
    return body


def along(points, bones):
    """Weights that blend between consecutive bones along a polyline (tails)."""
    pts = [Vector(p) for p in points]

    def fn(co):
        best, bi, bt = 1e9, 0, 0.0
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            ab = b - a
            t = max(0.0, min(1.0, (co - a).dot(ab) / ab.length_squared))
            dist = (a + ab * t - co).length
            if dist < best:
                best, bi, bt = dist, i, t
        # bone i covers segment i; blend into the next one over the last third
        if bi < len(bones) - 1 and bt > 0.66:
            k = (bt - 0.66) / 0.34
            return {bones[bi]: 1 - k * 0.5, bones[bi + 1]: k * 0.5}
        if bi > 0 and bt < 0.34:
            k = (0.34 - bt) / 0.34
            return {bones[bi]: 1 - k * 0.5, bones[bi - 1]: k * 0.5}
        return {bones[min(bi, len(bones) - 1)]: 1.0}
    return fn


X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
LEGS = ('leg.FL', 'leg.FR', 'leg.BL', 'leg.BR')


def add(p, bone, axis, ang):
    rig.add(p, bone, axis, ang)


def loc(p, bone, v):
    p.setdefault(bone, {})['loc'] = tuple(v)


def tail_wag(p, t, amp, speed=1.0, up=0.0):
    for i, bn in enumerate(('tail.1', 'tail.2')):
        add(p, bn, Z, amp * math.sin(2 * math.pi * (t * speed) - i * 0.9))
        if up:
            add(p, bn, X, -up * (0.6 + 0.4 * i))


def clips(cfg):
    """The seven clips, built from the creature's own numbers (leg swing, bob, how it lunges)."""
    legs = cfg.get('legs', True)
    a = cfg.get('swing', 0.45)
    lunge = cfg.get('lunge', 0.25)
    sink = cfg.get('sink', 0.12)

    def gait(p, t, amp, duty, phases):
        if not legs:
            return
        for bn, ph in zip(LEGS, phases):
            ang, lift = rig.gait(t, ph, duty, amp)
            add(p, bn, X, ang)
            loc(p, bn, (0, 0, lift * amp * 0.06))

    def idle(t):
        p = {}
        s = math.sin(2 * math.pi * t)
        loc(p, 'body', (0, 0, 0.006 * s))
        add(p, 'head', X, 0.04 * math.sin(2 * math.pi * t + 1))
        add(p, 'head', Z, 0.12 * math.sin(2 * math.pi * t * 0.5 + 0.3) if cfg.get('look', True) else 0.0)
        tail_wag(p, t, 0.18)
        return p

    def walk(t):
        p = {}
        gait(p, t, a, 0.56, (0.0, 0.5, 0.5, 0.0))
        loc(p, 'body', (0, 0, 0.018 * abs(math.sin(2 * math.pi * t))))
        add(p, 'body', Z, 0.04 * math.sin(2 * math.pi * t))
        add(p, 'head', X, -0.04 * math.sin(4 * math.pi * t))
        tail_wag(p, t, 0.3, up=0.1)
        if not legs:
            loc(p, 'body', (0, 0, 0.05 * math.sin(2 * math.pi * t)))
            add(p, 'body', X, 0.08 * math.sin(2 * math.pi * t))
        return p

    def run(t):
        p = {}
        # a bounding gallop: the front pair, then the back pair
        gait(p, t, a * 1.55, 0.42, (0.0, 0.08, 0.5, 0.58))
        loc(p, 'body', (0, 0, 0.045 * abs(math.sin(2 * math.pi * t))))
        add(p, 'body', X, 0.09 * math.sin(2 * math.pi * t))
        add(p, 'head', X, -0.08 * math.sin(2 * math.pi * t))
        tail_wag(p, t, 0.15, up=0.35)
        return p

    def windup(t):
        # crouched, weight on the back legs, head low and aimed: the tell before the charge
        p = {}
        s = 0.5 + 0.5 * math.sin(2 * math.pi * t)
        loc(p, 'body', (0, 0.05, -sink * 0.55 - 0.01 * s))
        add(p, 'body', X, -0.1)
        add(p, 'head', X, 0.22 + 0.03 * s)
        if legs:
            for bn in ('leg.FL', 'leg.FR'):
                add(p, bn, X, -0.32)
            for bn in ('leg.BL', 'leg.BR'):
                add(p, bn, X, 0.42)
        tail_wag(p, t, 0.08, speed=3, up=0.55)
        return p

    def attack(t):
        # the lunge forward and back (the game moves the creature itself; this is the body stretching into it)
        p = {}
        k = math.sin(math.pi * min(1.0, t * 1.6)) if t < 0.62 else 0.0
        back = smooth(0.62, 1.0, t)
        e = k * (1 - back)
        if cfg.get('throws'):
            # the archer rears up and swings its forepaws: throwing a pinecone
            add(p, 'body', X, -0.45 * e)
            loc(p, 'body', (0, 0.06 * e, 0.08 * e))
            add(p, 'head', X, -0.25 * e)
            if legs:
                add(p, 'leg.FL', X, -1.1 * e)
                add(p, 'leg.FR', X, (-1.4 + 1.8 * k) * e)
                for bn in ('leg.BL', 'leg.BR'):
                    add(p, bn, X, 0.25 * e)
            return p
        loc(p, 'body', (0, -lunge * e, 0.03 * e))
        add(p, 'body', X, 0.06 * e)
        add(p, 'head', X, -0.2 * e)
        if legs:
            for bn in ('leg.FL', 'leg.FR'):
                add(p, bn, X, -0.75 * e)
            for bn in ('leg.BL', 'leg.BR'):
                add(p, bn, X, 0.65 * e)
        tail_wag(p, t, 0.05, up=0.6 * e)
        return p

    def stunned(t):
        # dizzy: the head draws circles, the body sways, the legs splay
        p = {}
        add(p, 'head', Y, 0.28 * math.sin(2 * math.pi * t * 2))
        add(p, 'head', X, 0.12 + 0.08 * math.cos(2 * math.pi * t * 2))
        add(p, 'body', Y, 0.1 * math.sin(2 * math.pi * t))
        loc(p, 'body', (0, 0, -sink * 0.25))
        if legs:
            for bn, s in zip(LEGS, (1, -1, 1, -1)):
                add(p, bn, Y, -s * 0.22)
        tail_wag(p, t, 0.1)
        return p

    def sleep(t):
        # lying down, legs folded under, head on the paws, the tail curled round
        p = {}
        breath = math.sin(2 * math.pi * t)
        loc(p, 'body', (0, 0, -sink + 0.008 * breath))
        add(p, 'head', X, 0.32)
        loc(p, 'head', (0, 0, -0.03))
        if legs:
            for bn in ('leg.FL', 'leg.FR'):
                add(p, bn, X, -1.35)
            for bn in ('leg.BL', 'leg.BR'):
                add(p, bn, X, 1.25)
        for i, bn in enumerate(('tail.1', 'tail.2')):
            add(p, bn, Z, 0.7 + 0.25 * i)
            add(p, bn, X, 0.3)
        return p

    return [('idle', idle, 60), ('walk', walk, 24), ('run', run, 16), ('windup', windup, 30),
            ('attack', attack, 18), ('stunned', stunned, 36), ('sleep', sleep, 72)]


def rig_and_export(name, cfg, bones):
    arm = armature(name, bones)
    skin_all('creature', arm)
    bpy.context.scene.render.fps = rig.FPS
    poser = rig.Poser(arm)
    ad = arm.animation_data_create()
    actions = {}
    for cname, fn, frames in clips(cfg):
        act = bpy.data.actions.new(cname)
        act.use_fake_user = True
        ad.action = act
        for f in range(frames + 1):
            poser.key(f, fn((f / frames) % 1.0 if cname != 'attack' else f / frames))
        actions[cname] = act
        track = ad.nla_tracks.new()
        track.name = cname
        track.strips.new(cname, 0, act)
        track.mute = True
    ad.action = None
    rig.clear_pose(arm)
    os.makedirs(OUT, exist_ok=True)
    rig.export(os.path.join(OUT, f'enemy_{name}.glb'))
    return arm, actions


def quad_bones(hips, chest, neck, head_tip, legs, tail):
    """root, body, head, four legs (hip → foot) and two tail bones."""
    b = [('root', (0, 0, 0), (0, 0, 0.12), None),
         ('body', hips, chest, 'root'),
         ('head', neck, head_tip, 'body')]
    for bn, (top, foot) in zip(LEGS, legs):
        b.append((bn, top, foot, 'body'))
    b.append(('tail.1', tail[0], tail[1], 'body'))
    b.append(('tail.2', tail[1], tail[2], 'tail.1'))
    return b


def leg_parts(spots, top_z, r, foot, color, foot_color, bone_names=LEGS, mat='fur', upper=None):
    """Stubby legs (a tube from inside the body to the ground) with a round paw. `upper`: the body colour the
    leg starts in, turning into `color` (the socks) below the middle."""
    for (x, y), bn in zip(spots, bone_names):
        mid = top_z * 0.5 + foot
        paint = color if not upper else (lambda co, n, u=upper, c=color, m=mid: mix(c, u, smooth(m * 0.85, m * 1.25, co.z)))
        part(tube('leg', [(x, y, top_z), (x, y + r * 0.1, mid), (x, y - r * 0.1, foot * 1.4)], [r * 1.35, r * 1.0, r * 0.78], segs=12), mat, paint, bn)
        part(ell('paw', (x, y - r * 0.45, foot * 0.95), (r * 1.2, r * 1.55, foot), segs=14, rings=8), 'pad', foot_color, bn)


# ── The creatures ────────────────────────────────────────────────────────────────
def build_fox(cfg):
    """A ninja fox: slim and quick, a bushy tail with a cream tip, a dark mask band and amber slit eyes."""
    fur, cream, dark = C(cfg['fur']), C('#F4EAD8'), C(cfg.get('dark', '#3A2A22'))
    body = blob('body', [
        ((0, -0.15, 0.47), (0.15, 0.15, 0.16)),
        ((0, 0.0, 0.46), (0.15, 0.2, 0.15)),
        ((0, 0.16, 0.45), (0.15, 0.15, 0.15)),
        ((0, -0.2, 0.56), (0.11, 0.09, 0.12)),  # neck ruff
    ], voxel=0.012)
    part(body, 'fur', lambda co, n: mix(fur, cream, smooth(0.02, -0.12, n.z) * smooth(0.05, -0.2, co.y + 0.05) + smooth(-0.5, -0.9, n.z) * 0.8), 'body')
    hc = Vector((0, -0.33, 0.72))
    head = blob('head', [
        (tuple(hc), (0.165, 0.155, 0.15)),
        (tuple(hc + Vector((0, 0.0, 0.06))), (0.13, 0.12, 0.09)),  # forehead
        (tuple(hc + Vector((0.115, -0.02, -0.07))), (0.075, 0.07, 0.05)),  # cheek ruffs
        (tuple(hc + Vector((-0.115, -0.02, -0.07))), (0.075, 0.07, 0.05)),
        (tuple(hc + Vector((0, -0.15, -0.055))), (0.06, 0.1, 0.05)),  # muzzle
        (tuple(hc + Vector((0, -0.24, -0.06))), (0.035, 0.05, 0.032)),  # pointed tip
    ], voxel=0.008)
    part(head, 'fur', lambda co, n: mix(fur, cream, smooth(hc.z - 0.03, hc.z - 0.085, co.z) + smooth(-0.44, -0.56, co.y) * 0.9), 'head')
    iris = C(cfg.get('iris', '#F2C14E'))
    for sx in (1, -1):
        eye(head, hc + Vector((sx * 0.07, -0.05, 0.035)), (sx * 0.5, -1, 0.12), 0.05, 0.048, iris, slit=True, lid=fur)
    nose(head, hc + Vector((0, -0.27, -0.05)), (0, -1, 0.2), 0.022, (0.1, 0.07, 0.08))
    mask_band(head, hc, hc.z + 0.105, C(cfg['band']), height=0.04, tilt=-0.25)
    for s_ in (1, -1):
        b = hc + Vector((s_ * 0.09, 0.03, 0.1))
        tip = hc + Vector((s_ * 0.16, 0.07, 0.3))
        part(cone('ear', b, tip, 0.07, 0.006, segs=12), 'fur',
             lambda co, n, b=b, tip=tip: dark if (co - b).length / (tip - b).length > 0.72 else (cream if n.y < -0.35 else fur), 'head')
    tail = [(0, 0.27, 0.5), (0, 0.5, 0.62), (0, 0.66, 0.78)]
    tl = blob('tail', chain(tail, [0.07, 0.12, 0.08], 0.03), voxel=0.012)
    part(tl, 'fur', lambda co, n: mix(fur, cream, smooth(0.6, 0.7, co.y)), along(tail, ['tail.1', 'tail.2']))
    spots = [(0.09, -0.16), (-0.09, -0.16), (0.09, 0.17), (-0.09, 0.17)]
    leg_parts(spots, 0.4, 0.056, 0.038, dark, dark, upper=fur)
    extras = cfg.get('extras')
    if extras:
        extras(body, head, hc)
    return quad_bones((0, 0.1, 0.46), (0, -0.15, 0.5), (0, -0.2, 0.58), tuple(hc + Vector((0, -0.1, 0))),
                      [((x, y, 0.4), (x, y, 0.02)) for x, y in spots], tail)


def archer_extras(body, head, hc):
    """The archer's bow across the back and a quiver of pinecones."""
    wood, string, leather = C('#7A5236'), C('#EDE6D6'), C('#5A3B28')
    c = Vector((0.0, 0.04, 0.64))
    pts = [c + Vector((math.cos(a) * 0.3, 0.02, math.sin(a) * 0.26)) for a in [math.radians(-70 + i * 14) for i in range(11)]]
    pts = [Matrix.Rotation(0.5, 3, 'Y') @ (p - c) + c for p in pts]
    part(tube('bow', pts, 0.016, segs=6), 'leather', wood, 'body')
    part(tube('string', [pts[0], pts[-1]], 0.004, segs=4), 'leather', string, 'body')
    q0, q1 = Vector((-0.1, 0.12, 0.58)), Vector((-0.16, 0.26, 0.86))
    part(tube('quiver', [q0, q1], [0.06, 0.055], segs=12), 'leather', leather, 'body')
    for k in range(3):
        o = Vector(((k - 1) * 0.025, 0.0, 0.0))
        part(cone('cone', q1 + o, q1 + o + Vector((0, 0.03, 0.09)), 0.03, 0.0, segs=7), 'wood', C('#8C5A36'), 'body')
    part(tube('strap', [Vector((0.15, -0.15, 0.56)), Vector((0.02, 0.0, 0.62)), Vector((-0.12, 0.16, 0.6))], 0.012, segs=6), 'leather', leather, 'body')


def hedgehog_body(cfg, s=1.0):
    """The round bandit hedgehog (the Chief is a bigger one): body, face, spines, mask, little legs."""
    S = lambda v: Vector(v) * s  # noqa: E731
    fur, face, spine = C(cfg['fur']), C('#E8D2B0'), C(cfg['spine'])
    tipc = C(cfg.get('tip', '#E8D8B8'))
    bc = S((0, 0.02, 0.3))
    body = blob('body', [(tuple(bc), tuple(S((0.32, 0.36, 0.27)))), (tuple(S((0, -0.12, 0.26))), tuple(S((0.27, 0.2, 0.22))))], voxel=0.012 * s)
    part(body, 'fur', lambda co, n: mix(fur, face, smooth(-0.1, -0.5, n.z)), 'body')
    hc = S((0, -0.3, 0.3))
    head = blob('head', [(tuple(hc), tuple(S((0.19, 0.14, 0.17)))), (tuple(hc + S((0, -0.13, -0.03))), tuple(S((0.07, 0.1, 0.06))))], voxel=0.008 * s)
    part(head, 'fur', face, 'head')
    # spines over the back and the top of the head: a cone each, dark at the root, pale at the tip
    cones = []
    n = int(260 * cfg.get('spines', 1.0))
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        zf = 1 - 2 * (i + 0.5) / n
        rr = math.sqrt(1 - zf * zf)
        d = Vector((math.cos(golden * i) * rr, math.sin(golden * i) * rr, zf))
        if d.z < -0.25 or d.y < -0.62 or (d.y < -0.3 and d.z < 0.25):
            continue
        try:
            loc0, nor = on_surface(body, bc, d)
        except RuntimeError:
            continue
        L = (0.12 + 0.04 * math.sin(i * 7.1)) * s
        aim = (nor * 0.6 + Vector((0, 0.75, 0.05))).normalized()
        c = cone('spine', loc0 - nor * 0.02 * s, loc0 + aim * L, 0.036 * s, 0.0, segs=5)
        part(c, 'pad', lambda co, n_, a=loc0, L=L: mix(spine, tipc, smooth(0.55, 1.0, (co - a).length / L)), 'body')
        cones.append(c)
    loc_l = eye(head, hc + S((0.07, 0, 0.03)), (0.5, -1, 0.1), 0.04 * s, 0.045 * s, C('#3A2A22'), lid=face)
    eye(head, hc + S((-0.07, 0, 0.03)), (-0.5, -1, 0.1), 0.04 * s, 0.045 * s, C('#3A2A22'), lid=face)
    nose(head, hc + S((0, -0.22, -0.03)), (0, -1, 0.1), 0.03 * s, (0.12, 0.08, 0.09))
    mask_band(head, hc, hc.z + 0.1 * s, C(cfg['band']), height=0.04 * s, tilt=-0.2)
    for sx in (1, -1):
        part(ell('ear', hc + S((sx * 0.12, 0.04, 0.12)), tuple(S((0.04, 0.025, 0.045))), segs=10, rings=8), 'fur', face, 'head')
    spots = [S((0.13, -0.14))[:2], S((-0.13, -0.14))[:2], S((0.14, 0.16))[:2], S((-0.14, 0.16))[:2]]
    spots = [(x, y) for x, y in spots]
    leg_parts(spots, 0.14 * s, 0.045 * s, 0.03 * s, C('#5A4434'), C('#3A2A22'))
    tail = [tuple(S((0, 0.34, 0.2))), tuple(S((0, 0.4, 0.18))), tuple(S((0, 0.44, 0.15)))]
    part(ell('tail', tail[1], tuple(S((0.04, 0.06, 0.035)))), 'fur', fur, along(tail, ['tail.1', 'tail.2']))
    return quad_bones(tuple(bc), tuple(S((0, -0.15, 0.32))), tuple(S((0, -0.2, 0.3))), tuple(hc + S((0, -0.1, 0))),
                      [((x, y, 0.16 * s), (x, y, 0.01)) for x, y in spots], tail), head, hc


def build_hedgehog(cfg):
    bones, _, _ = hedgehog_body(cfg)
    return bones


def build_chief(cfg):
    """O Chefe Espinho: a big hedgehog with golden-tipped spines, a red cape and a crown of golden spines."""
    s = 1.6
    bones, head, hc = hedgehog_body(cfg, s)
    red, gold = C('#8C2E2E'), C('#D9A520')
    S_ = lambda v, k: Vector(v) * k  # noqa: E731
    # a red cloak round the neck, fastened with a gold clasp under the chin, hanging over the chest
    nc = hc + S_((0, 0.1, -0.1), s)
    bm = base.ring_on_surface(head, nc, (0, -0.35, 1), [-0.03 * s, 0.03 * s], outward=0.02 * s, steps=36, max_r=0.24 * s)
    collar = base.mesh_from_bmesh('cloak', bm)
    base.solidify(collar, 0.02 * s)
    part(collar, 'cloth', red, 'head')
    for sx in (1, -1):
        a0 = hc + S_((sx * 0.14, -0.06, -0.14), s)
        part(strip('cloakfall', [a0, a0 + S_((sx * 0.05, 0.02, -0.08), s), a0 + S_((sx * 0.08, 0.06, -0.15), s)], [0.12 * s, 0.14 * s, 0.15 * s], normal=(sx * 0.6, -1, 0), thick=0.015 * s), 'cloth',
             lambda co, n: mix(red, (0.45, 0.1, 0.12), smooth(0.35 * s, 0.15 * s, co.z)), 'body')
    part(ell('clasp', hc + S_((0, -0.16, -0.15), s), (0.04 * s, 0.02 * s, 0.04 * s)), 'metal', gold, 'head')
    top = hc + S_((0, -0.02, 0.16), s)
    for i in range(5):
        a = top + S_(((i - 2) * 0.055, abs(i - 2) * 0.02, 0), s)
        part(cone('crown', a, a + S_((0, 0.0, 0.13 - abs(i - 2) * 0.025), s), 0.024 * s, 0.0, segs=6), 'metal', gold, 'head')
    part(tube('crownband', [top + S_((math.sin(t) * 0.13, (1 - math.cos(t)) * 0.08, 0), s) for t in [(k - 4) / 4 * 1.1 for k in range(9)]], 0.014 * s, segs=6), 'metal', gold, 'head')
    return bones


def build_boar(cfg):
    """The rock boar: huge and low-headed, tusks, a bristly ridge and stone plates growing on its back."""
    fur, dark, snout = C(cfg['fur']), C('#4A3E36'), C('#C99A8A')
    body = blob('body', [
        ((0, 0.1, 0.66), (0.5, 0.62, 0.48)),
        ((0, -0.45, 0.72), (0.46, 0.35, 0.47)),  # the shoulder hump
        ((0, 0.45, 0.6), (0.4, 0.3, 0.38)),
    ], voxel=0.02)
    part(body, 'fur', lambda co, n: mix(fur, tuple(c * 0.75 for c in fur), smooth(0.2, 0.8, n.z)), 'body')
    hc = Vector((0, -0.88, 0.6))
    head = blob('head', [(tuple(hc), (0.36, 0.33, 0.33)), (tuple(hc + Vector((0, -0.24, -0.07))), (0.22, 0.2, 0.19))], voxel=0.014)
    part(head, 'fur', fur, 'head')
    sn = hc + Vector((0, -0.46, -0.1))
    part(tube('snout', [sn + Vector((0, 0.08, 0)), sn], [0.14, 0.15], segs=16), 'pad', snout, 'head')
    for sx in (1, -1):
        part(ell('nostril', sn + Vector((sx * 0.05, -0.01, 0.0)), (0.025, 0.012, 0.035)), 'pad', (0.25, 0.15, 0.15), 'head')
        t0 = hc + Vector((sx * 0.14, -0.32, -0.12))
        part(tube('tusk', [t0, t0 + Vector((sx * 0.04, -0.05, 0.06)), t0 + Vector((sx * 0.03, -0.06, 0.16))], [0.035, 0.026, 0.006], segs=8), 'pad', C('#F4EAD8'), 'head')
        part(cone('ear', hc + Vector((sx * 0.2, 0.05, 0.2)), hc + Vector((sx * 0.3, 0.12, 0.34)), 0.07, 0.01, segs=8), 'fur', dark, 'head')
    eye(head, hc + Vector((0.15, -0.08, 0.1)), (0.75, -1, 0.25), 0.06, 0.055, C('#7A3A2A'), lid=fur)
    eye(head, hc + Vector((-0.15, -0.08, 0.1)), (-0.75, -1, 0.25), 0.06, 0.055, C('#7A3A2A'), lid=fur)
    # bristles along the spine, and the stone plates
    for k in range(14):
        y = -0.75 + k * 0.1
        z = 1.12 - 0.16 * (y + 0.2) ** 2
        part(cone('bristle', (0, y, z - 0.05), (0, y + 0.08, z + 0.12), 0.05, 0.0, segs=5), 'fur', dark, 'body')
    stone = C('#8E877A')
    for i, (x, y, z, r) in enumerate([(-0.28, -0.35, 1.06, 0.27), (0.3, -0.25, 1.04, 0.24), (0.12, 0.1, 1.1, 0.3), (-0.22, 0.32, 1.0, 0.26), (0.3, 0.42, 0.9, 0.2), (-0.05, -0.62, 1.08, 0.22)]):
        part(rock('plate', (x, y, z), r, i), 'metal', lambda co, n, i=i: mix(stone, (0.5, 0.48, 0.44), 0.5 + 0.5 * math.sin(co.x * 23 + co.y * 17 + i)), 'body')
    spots = [(0.3, -0.45), (-0.3, -0.45), (0.3, 0.45), (-0.3, 0.45)]
    leg_parts(spots, 0.5, 0.13, 0.07, dark, (0.2, 0.17, 0.16), upper=fur)
    tail = [(0, 0.72, 0.68), (0, 0.8, 0.6), (0, 0.84, 0.5)]
    part(tube('tail', tail, [0.03, 0.025, 0.02], segs=6), 'fur', dark, along(tail, ['tail.1', 'tail.2']))
    return quad_bones((0, 0.1, 0.66), (0, -0.4, 0.72), (0, -0.62, 0.66), tuple(hc + Vector((0, -0.2, 0))),
                      [((x, y, 0.5), (x, y, 0.02)) for x, y in spots], tail)


def build_badger(cfg):
    """The badger guard: stocky, a white face with two black stripes, a little helmet and a round shield."""
    fur, white, black = C(cfg['fur']), C('#F2EFE8'), C('#2A2A30')
    body = blob('body', [((0, 0.02, 0.48), (0.4, 0.46, 0.34)), ((0, -0.3, 0.5), (0.33, 0.22, 0.3))], voxel=0.014)
    part(body, 'fur', lambda co, n: mix(fur, black, smooth(-0.1, -0.6, n.z)), 'body')
    hc = Vector((0, -0.5, 0.6))
    head = blob('head', [(tuple(hc), (0.24, 0.22, 0.2)), (tuple(hc + Vector((0, -0.17, -0.05))), (0.11, 0.12, 0.09))], voxel=0.009)

    def face(co, n):
        L = co - hc
        # two black stripes from the nose back over the eyes to the ears (the face between them stays white)
        stripe = smooth(0.035, 0.06, abs(L.x)) * smooth(0.16, 0.12, abs(L.x))
        front = smooth(-0.12, -0.02, L.z + 0.4 * (L.y + 0.2))
        return mix(white, black, max(stripe * front, smooth(0.1, 0.2, L.y)))
    part(head, 'fur', face, 'head')
    eye(head, hc + Vector((0.09, -0.02, 0.03)), (0.5, -1, 0.15), 0.04, 0.038, C('#F2E27A'), lid=black)
    eye(head, hc + Vector((-0.09, -0.02, 0.03)), (-0.5, -1, 0.15), 0.04, 0.038, C('#F2E27A'), lid=black)
    nose(head, hc + Vector((0, -0.25, -0.05)), (0, -1, 0.1), 0.035, (0.1, 0.08, 0.09))
    for sx in (1, -1):
        part(ell('ear', hc + Vector((sx * 0.17, 0.06, 0.1)), (0.05, 0.03, 0.045), segs=10, rings=8), 'fur', black, 'head')
    # helmet: a dome with a rim and a little crest
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=10, radius=1.0)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.05], context='VERTS')
    hm = base.mesh_from_bmesh('helmet', bm)
    hm.scale = (0.25, 0.25, 0.17)
    hm.location = hc + Vector((0, 0.02, 0.08))
    base.solidify(hm, 0.02)
    part(hm, 'metal', C('#7A6A4E'), 'head')
    part(tube('rim', [hc + Vector((math.cos(a) * 0.255, 0.02 + math.sin(a) * 0.255, 0.08)) for a in [k / 24 * 2 * math.pi for k in range(25)]], 0.014, segs=6, cap=False), 'metal', C('#5E5038'), 'head')
    part(cone('crest', hc + Vector((0, 0.0, 0.22)), hc + Vector((0, 0.05, 0.33)), 0.03, 0.0, segs=6), 'cloth', C('#C8302C'), 'head')
    # shield, held in front of the right shoulder: planks, an iron rim and a boss
    sc = Vector((0.27, -0.62, 0.46))
    Rz = Matrix.Rotation(-0.28, 3, 'Z')
    fwd = Rz @ Vector((0, -1, 0))
    part(tube('shield', [sc - fwd * 0.03, sc], [0.29, 0.29], segs=24), 'wood',
         lambda co, n: mix(C('#8C5A36'), C('#6E4428'), 0.5 + 0.5 * math.sin(((Rz.inverted() @ (co - sc)).x) * 55)), 'leg.FR')
    part(tube('srim', [sc + Rz @ Vector((math.cos(a) * 0.29, 0.005, math.sin(a) * 0.29)) for a in [k / 24 * 2 * math.pi for k in range(25)]], 0.02, segs=6, cap=False), 'metal', C('#5E5038'), 'leg.FR')
    part(ell('boss', sc + fwd * 0.012, (0.08, 0.04, 0.08), forward=tuple(fwd)), 'metal', C('#B8A07A'), 'leg.FR')
    spots = [(0.26, -0.3), (-0.26, -0.3), (0.26, 0.33), (-0.26, 0.33)]
    leg_parts(spots, 0.36, 0.08, 0.05, black, black, upper=fur)
    tail = [(0, 0.46, 0.5), (0, 0.54, 0.46), (0, 0.6, 0.4)]
    part(tube('tail', tail, [0.07, 0.06, 0.03], segs=8), 'fur', fur, along(tail, ['tail.1', 'tail.2']))
    return quad_bones((0, 0.02, 0.48), (0, -0.3, 0.52), (0, -0.38, 0.6), tuple(hc + Vector((0, -0.12, 0))),
                      [((x, y, 0.36), (x, y, 0.02)) for x, y in spots], tail)


def build_weasel(cfg):
    """The ninja weasel: long and low, cream belly, a black mask band and a red scarf with two flying tails."""
    fur, cream, dark, red = C(cfg['fur']), C('#F2E2C2'), C('#5E3A22'), C('#C8302C')
    spine = [(0, 0.3, 0.3), (0, 0.05, 0.32), (0, -0.2, 0.34), (0, -0.36, 0.4)]
    body = blob('body', chain(spine, [0.12, 0.13, 0.12, 0.1], 0.04), voxel=0.01)
    part(body, 'fur', lambda co, n: mix(fur, cream, smooth(0.0, -0.45, n.z)), 'body')
    hc = Vector((0, -0.5, 0.47))
    head = blob('head', [(tuple(hc), (0.14, 0.15, 0.125)), (tuple(hc + Vector((0, -0.12, -0.03))), (0.07, 0.09, 0.06))], voxel=0.007)
    part(head, 'fur', lambda co, n: mix(fur, cream, smooth(hc.z - 0.02, hc.z - 0.08, co.z)), 'head')
    eye(head, hc + Vector((0.055, -0.02, 0.03)), (0.5, -1, 0.15), 0.032, 0.032, C('#2A1E1A'), lid=fur)
    eye(head, hc + Vector((-0.055, -0.02, 0.03)), (-0.5, -1, 0.15), 0.032, 0.032, C('#2A1E1A'), lid=fur)
    nose(head, hc + Vector((0, -0.2, -0.02)), (0, -1, 0.1), 0.02, (0.12, 0.08, 0.09))
    mask_band(head, hc, hc.z + 0.085, C('#1E1A22'), height=0.03, tilt=-0.2)
    for sx in (1, -1):
        part(ell('ear', hc + Vector((sx * 0.09, 0.05, 0.1)), (0.04, 0.02, 0.04), segs=10, rings=8), 'fur', dark, 'head')
    # the scarf round the neck and its two tails flying behind
    nc = Vector((0, -0.38, 0.42))
    bm = base.ring_on_surface(body, nc, (0, -0.6, 0.8), [-0.03, 0.03], outward=0.012, steps=32, max_r=0.4)
    sc = base.mesh_from_bmesh('scarf', bm)
    base.solidify(sc, 0.015)
    part(sc, 'cloth', red, 'body')
    for k, sx in enumerate((1, -1)):
        a = nc + Vector((sx * 0.04, 0.08, 0.11))
        part(strip('scarftail', [a, a + Vector((sx * 0.05, 0.14, -0.03 + k * 0.02)), a + Vector((sx * 0.09, 0.3, -0.06 + k * 0.02))], [0.06, 0.05, 0.04], normal=(0, 0.1, 1)), 'cloth', red, 'body')
    tail = [(0, 0.36, 0.32), (0, 0.6, 0.36), (0, 0.8, 0.44)]
    tl = blob('tail', chain(tail, [0.05, 0.055, 0.04], 0.025), voxel=0.009)
    part(tl, 'fur', lambda co, n: mix(fur, dark, smooth(0.62, 0.75, co.y)), along(tail, ['tail.1', 'tail.2']))
    spots = [(0.08, -0.25), (-0.08, -0.25), (0.08, 0.24), (-0.08, 0.24)]
    leg_parts(spots, 0.24, 0.042, 0.026, dark, dark, upper=fur)
    return quad_bones((0, 0.1, 0.32), (0, -0.25, 0.36), (0, -0.38, 0.44), tuple(hc + Vector((0, -0.1, 0))),
                      [((x, y, 0.26), (x, y, 0.02)) for x, y in spots], tail)


def build_spirit(cfg):
    """The forest spirit: a soft, pale drop of mist with a wisp for a tail, hollow eyes and a leaf on its head."""
    mist = C(cfg['fur'])
    body = blob('body', [((0, 0, 0.92), (0.36, 0.34, 0.4)), ((0, 0.02, 0.62), (0.3, 0.28, 0.26))], voxel=0.014)
    part(body, 'fur', lambda co, n: mix(mist, (0.7, 0.86, 0.95), smooth(0.9, 0.4, co.z)), 'body')
    tail = [(0, 0.05, 0.5), (0, 0.18, 0.3), (0, 0.34, 0.2)]
    tl = blob('wisp', chain(tail, [0.2, 0.12, 0.05], 0.025), voxel=0.012)
    part(tl, 'fur', lambda co, n: mix((0.7, 0.86, 0.95), mist, smooth(0.5, 0.2, co.z)), along(tail, ['tail.1', 'tail.2']))
    hc = Vector((0, 0, 0.95))
    for sx in (1, -1):
        loc0, nor = on_surface(body, hc + Vector((sx * 0.12, 0, 0.02)), (sx * 0.4, -1, 0.1))
        part(ell('hollow', loc0 - nor * 0.01, (0.06, 0.02, 0.08), forward=tuple(nor), segs=12, rings=8), 'eye', (0.12, 0.17, 0.24), 'head')
        part(ell('glint', loc0 + nor * 0.012 + Vector((sx * 0.015, 0, 0.03)), (0.016, 0.008, 0.016), forward=tuple(nor), segs=8, rings=6), 'gloss', (0.85, 0.97, 1.0), 'head')
        cl, cn = on_surface(body, hc + Vector((sx * 0.2, 0, -0.1)), (sx * 0.5, -1, -0.1))
        part(ell('cheek', cl + cn * 0.003, (0.05, 0.01, 0.03), forward=tuple(cn), segs=10, rings=6), 'gloss', (0.75, 0.9, 1.0), 'head')
    top, tn = on_surface(body, hc, (0, 0.1, 1))
    part(tube('stem', [top - tn * 0.02, top + Vector((0, 0.02, 0.08))], 0.012, segs=6), 'wood', C('#6E8E4A'), 'head')
    leaf = [top + Vector((0, 0.02, 0.08)), top + Vector((0.06, 0.04, 0.13)), top + Vector((0.14, 0.06, 0.12))]
    part(strip('leaf', leaf, [0.02, 0.07, 0.01], normal=(0, -0.4, 1), thick=0.008), 'wood', C('#8CC85A'), 'head')
    return [('root', (0, 0, 0), (0, 0, 0.12), None), ('body', (0, 0, 0.62), (0, 0, 0.95), 'root'),
            ('head', (0, 0, 0.9), (0, -0.2, 0.95), 'body'),
            ('tail.1', tail[0], tail[1], 'body'), ('tail.2', tail[1], tail[2], 'tail.1')]


KINDS = {
    'ourico': dict(build=build_hedgehog, fur='#8C6A4E', spine='#5A4434', band='#8C2E2E', swing=0.55, lunge=0.3, sink=0.1),
    'raposa': dict(build=build_fox, fur='#D9733A', band='#2E2A36', swing=0.5, lunge=0.3, sink=0.2),
    'arqueira': dict(build=build_fox, fur='#9AA0A8', band='#3E6A3A', dark='#3A3A40', iris='#9CD3E8', extras=archer_extras, swing=0.5, sink=0.2, throws=True),
    'javali': dict(build=build_boar, fur='#7A6656', swing=0.35, lunge=0.4, sink=0.3),
    'texugo': dict(build=build_badger, fur='#6E6A70', swing=0.4, lunge=0.25, sink=0.2),
    'doninha': dict(build=build_weasel, fur='#9A6238', swing=0.6, lunge=0.32, sink=0.14),
    'espirito': dict(build=build_spirit, fur='#CFE6F5', legs=False, lunge=0.35, sink=0.15, look=False),
    'chefe': dict(build=build_chief, fur='#5E4434', spine='#4A3424', tip='#D9A520', band='#8C2E2E', spines=1.3, swing=0.45, lunge=0.4, sink=0.16),
}


def render(name, arm=None, actions=None):
    base.OUT_RENDERS = OUT
    cam = base.setup_render()
    top = {'javali': 0.7, 'chefe': 0.6, 'espirito': 0.75}.get(name, 0.42)
    dist = {'javali': 3.6, 'chefe': 3.2, 'espirito': 2.6, 'texugo': 2.6}.get(name, 2.2)
    if not arm:
        base.render_views(cam, f'enemy_{name}', target=(0, -0.05, top), dist=dist, views={'front': -90, 'tq': -55, 'side': 0, 'back': 120}, height=0.35)
        return
    for clip, frame in (('idle', 0), ('walk', 6), ('windup', 8), ('attack', 6), ('stunned', 9), ('sleep', 10)):
        rig.set_pose(arm, actions[clip], frame)
        base.render_views(cam, f'epose_{name}_{clip}', target=(0, -0.05, top), dist=dist, views={'tq': -55}, height=0.35)
    rig.clear_pose(arm)


def main():
    names = list(KINDS) if KIND == 'all' else KIND.split(',')
    for name in names:
        cfg = KINDS[name]
        base.reset_scene()
        PARTS.clear()
        bones = cfg['build'](cfg)
        if STAGE == 'model':
            render(name)
            continue
        arm, actions = rig_and_export(name, cfg, bones)
        render(name, arm, actions)
        print('BUILT', name)


main()
