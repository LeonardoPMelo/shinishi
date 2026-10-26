"""
Builds Shinichi (tuxedo ninja cat) in Blender from code and exports a rigged, animated GLB.

Run (headless):
  blender -b --factory-startup --python tools/blender/build_shinichi.py -- --stage model [--engine cycles] [--views face|body|all]
  blender -b --factory-startup --python tools/blender/build_shinichi.py -- --stage full

Stages:
  model : body + face + accessories, colored, and preview renders (docs/renders/)
  full  : model + armature + weights + animation clips + GLB export + renders

Contract with the game (a hand-made model can replace this one if it keeps these names):
  * Blender: Z up, the cat faces -Y. glTF/three.js: Y up, faces +Z. 1 unit = 1 meter.
  * Bones: see build_rig.bone_table() (body, legs, tail.1-5, ear.L/R, ribbon.L/R.1-3).
  * Clips: idle, walk, run, jump, fall, land, sit, meow, crouch, attack, victory
  * Shape keys (morph targets):
      lid.L / lid.R : blink, angry, sad, happy, sleepy
      mouth         : smile, open, oh, frown, angry
  * Pupils: pupil.L / pupil.R (scale x/y for dilation)
  * Materials by name: fur, eye, pupil, gloss, mouth, cloth, metal, leather, pad
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from anatomy import CHEST, FRONT, FX, HEAD, HIND, HIPS, HOCK_BAND_Z, HX, NECK, TAIL, TAIL_R, WRIST_Z, side  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT_GLB = os.path.join(ROOT, 'public', 'assets', 'characters', 'shinichi.glb')
OUT_RENDERS = os.path.join(ROOT, 'docs', 'renders')

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
STAGE = argv[argv.index('--stage') + 1] if '--stage' in argv else 'full'
ENGINE = argv[argv.index('--engine') + 1] if '--engine' in argv else 'workbench'
VIEWS = argv[argv.index('--views') + 1] if '--views' in argv else 'all'

# ── Palette (reference 13) ──────────────────────────────────────────────────────
WHITE = (0.96, 0.94, 0.90)
BLACK = (0.085, 0.08, 0.10)
PINK = (0.95, 0.62, 0.66)
PAD = (0.93, 0.56, 0.62)
NOSE = (0.93, 0.55, 0.60)
CLOTH = (0.075, 0.08, 0.11)
LEATHER = (0.47, 0.27, 0.13)
LEATHER_DARK = (0.30, 0.17, 0.08)
METAL = (0.74, 0.76, 0.80)
METAL_DARK = (0.40, 0.42, 0.48)
MOUTH = (0.38, 0.08, 0.12)
TONGUE = (0.93, 0.48, 0.54)
LASH = (0.04, 0.035, 0.05)

SURF = 0.574  # metaball: surface radius = SURF * element radius (threshold 0.6, stiffness 2)


# ── Scene helpers ───────────────────────────────────────────────────────────────
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def activate(obj):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


def apply_modifiers(obj):
    activate(obj)
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def material(name, color=(1, 1, 1), rough=0.8, metal=0.0, vertex=True):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    tree = mat.node_tree
    bsdf = tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if vertex:
        vc = tree.nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Col'
        tree.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def paint(obj, fn):
    """Vertex colors per point: fn(world_co, normal) -> rgb."""
    me = obj.data
    attr = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    mw = obj.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    cols = {}
    for v in me.vertices:
        cols[v.index] = fn(mw @ v.co, (nm @ v.normal).normalized())
    for loop in me.loops:
        c = cols[loop.vertex_index]
        attr.data[loop.index].color = (c[0], c[1], c[2], 1.0)
    me.color_attributes.active_color = attr


def bake(obj):
    """Apply the object's own transform to its mesh."""
    obj.data.transform(obj.matrix_basis)
    obj.matrix_basis = Matrix.Identity(4)


def flat_color(obj, rgb):
    paint(obj, lambda co, n: rgb)


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def shade_smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def mesh_from_bmesh(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return link(bpy.data.objects.new(name, me))


def join(objs, name):
    activate(objs[0])
    for o in objs[1:]:
        o.select_set(True)
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


def add_uv_sphere(name, radius, segs=24, rings=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=radius)
    return mesh_from_bmesh(name, bm)


def orient(obj, location, forward, up=(0, 0, 1)):
    """Object's local -Y points along `forward` (the cat's own convention), right-handed."""
    f = Vector(forward).normalized()
    y = -f
    x = y.cross(Vector(up)).normalized()
    z = x.cross(y).normalized()
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = Vector(location)
    obj.matrix_world = m


def ellipsoid(name, center, semi, forward=(0, -1, 0), segs=16, rings=12):
    o = add_uv_sphere(name, 1.0, segs, rings)
    orient(o, center, forward)
    o.scale = semi
    bpy.context.view_layer.update()
    return o


def cone_between(bm, a, b, r1, r2, segs=8):
    a, b = Vector(a), Vector(b)
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=(b - a).length,
                          matrix=Matrix.Translation((a + b) / 2) @ (b - a).to_track_quat('Z', 'Y').to_matrix().to_4x4())


# ── Body: metaballs → smooth mesh ──────────────────────────────────────────────
def body_elements():
    E = []

    def ell(c, semi):
        E.append((tuple(c), semi))

    def chain(points, radii, step=0.02):
        for i in range(len(points) - 1):
            a, b = Vector(points[i]), Vector(points[i + 1])
            n = max(1, int((b - a).length / step))
            for k in range(n + (1 if i == len(points) - 2 else 0)):
                t = k / n
                r = radii[i] + (radii[i + 1] - radii[i]) * t
                ell(a.lerp(b, t), (r, r, r))

    # compact, fluffy torso
    ell(CHEST, (0.165, 0.160, 0.160))
    ell(HIPS, (0.165, 0.170, 0.155))
    ell((0, 0.03, 0.335), (0.160, 0.12, 0.150))
    ell(CHEST + Vector((0, -0.10, -0.01)), (0.120, 0.075, 0.125))  # chest fluff
    ell((0, 0.0, 0.235), (0.12, 0.16, 0.07))  # soft belly
    ell(NECK, (0.120, 0.100, 0.110))
    # big round head with full cheeks
    H = HEAD
    ell(H, (0.245, 0.215, 0.205))
    ell(H + Vector((0, -0.05, 0.085)), (0.170, 0.120, 0.095))  # forehead
    for s in (1, -1):
        ell(H + Vector((s * 0.128, -0.075, -0.070)), (0.112, 0.100, 0.086))  # cheeks
    ell(H + Vector((0, -0.172, -0.058)), (0.088, 0.060, 0.056))  # muzzle
    ell(H + Vector((0, -0.150, -0.108)), (0.050, 0.040, 0.030))  # chin
    # short, sturdy legs and big paws
    for s in (1, -1):
        ell(side((0.105, -0.10, 0.30), s), (0.085, 0.090, 0.100))  # shoulder
        chain([side(FRONT['shoulder'], s), side(FRONT['elbow'], s), side(FRONT['wrist'], s)], [0.062, 0.056, 0.054])
        ell(side((FX, -0.172, 0.040), s), (0.064, 0.078, 0.042))  # front paw
        ell(side((HX, 0.17, 0.25), s), (0.100, 0.120, 0.130))  # thigh
        chain([side(HIND['knee'], s), side(HIND['hock'], s)], [0.066, 0.054])
        chain([side(HIND['hock'], s), side((HX, 0.19, 0.045), s)], [0.052, 0.052])
        ell(side((HX, 0.178, 0.040), s), (0.064, 0.080, 0.042))  # hind paw
    chain(TAIL, TAIL_R, step=0.016)
    return E


def build_body():
    mb = bpy.data.metaballs.new('ShinichiBody')
    mb.resolution = 0.008
    mb.threshold = 0.6
    obj = link(bpy.data.objects.new('ShinichiBody', mb))
    for c, semi in body_elements():
        m = max(semi)
        el = mb.elements.new()
        el.type = 'ELLIPSOID'
        el.co = c
        el.radius = m / SURF
        el.size_x, el.size_y, el.size_z = semi[0] / m, semi[1] / m, semi[2] / m
        el.stiffness = 2.0
    activate(obj)
    bpy.ops.object.convert(target='MESH')
    body = bpy.context.view_layer.objects.active
    body.name = 'body'
    body.data.name = 'body'
    rem = body.modifiers.new('remesh', 'REMESH')
    rem.mode = 'VOXEL'
    rem.voxel_size = 0.008
    sm = body.modifiers.new('smooth', 'CORRECTIVE_SMOOTH')
    sm.iterations = 6
    sm.use_only_smooth = True
    dec = body.modifiers.new('decimate', 'DECIMATE')
    dec.ratio = 0.2
    apply_modifiers(body)
    body.data.validate(clean_customdata=False)
    shade_smooth(body)
    return body


# ── Surface probing ────────────────────────────────────────────────────────────
def surface_hit(body, origin, direction):
    mw = body.matrix_world
    inv = mw.inverted()
    o = inv @ Vector(origin)
    d = (inv.to_3x3() @ Vector(direction)).normalized()
    ok, loc, nor, _ = body.ray_cast(o, d)
    if not ok:
        raise RuntimeError(f'no surface hit from {tuple(origin)} dir {tuple(direction)}')
    return mw @ loc, (mw.to_3x3() @ nor).normalized()


def surface_out(body, inside, direction, max_d=0.5):
    """Exit point of a ray that starts inside the body."""
    inv = body.matrix_world.inverted()
    d = Vector(direction).normalized()
    ok, loc, nor, _ = body.ray_cast(inv @ Vector(inside), (inv.to_3x3() @ d).normalized(), distance=max_d)
    if not ok:
        raise RuntimeError(f'no exit from {tuple(inside)} dir {tuple(direction)}')
    return body.matrix_world @ loc, (body.matrix_world.to_3x3() @ nor).normalized()


def ring_on_surface(body, center, axis, up_offsets, outward=0.006, steps=48, max_r=0.35):
    """Band hugging the body: rays go outward from inside, so neighbouring limbs are never hit."""
    center = Vector(center)
    axis = Vector(axis).normalized()
    ref = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
    u = axis.cross(ref).normalized()
    v = axis.cross(u).normalized()
    inv = body.matrix_world.inverted()
    mw = body.matrix_world
    bm = bmesh.new()
    rows = []
    for off in up_offsets:
        row = []
        for i in range(steps):
            a = 2 * math.pi * i / steps
            d = (u * math.cos(a) + v * math.sin(a)).normalized()
            o = center + axis * off
            ok, loc, nor, _ = body.ray_cast(inv @ o, (inv.to_3x3() @ d).normalized(), distance=max_r)
            p = mw @ loc if ok else o + d * max_r
            row.append(bm.verts.new(p + d * outward))
        rows.append(row)
    for r in range(len(rows) - 1):
        for i in range(steps):
            j = (i + 1) % steps
            bm.faces.new((rows[r][i], rows[r][j], rows[r + 1][j], rows[r + 1][i]))
    return bm


# ── Fur pattern (tuxedo, reference 13) ─────────────────────────────────────────
PATCHES = [  # black saddle and hip patches: (center, radius)
    ((0.0, 0.06, 0.47), 0.15),
    ((0.13, 0.16, 0.40), 0.11),
    ((-0.11, 0.20, 0.41), 0.10),
    ((0.0, 0.25, 0.43), 0.11),
    ((-0.16, -0.03, 0.36), 0.055),
]


def fur_color(co, nor=None):
    x, y, z = co.x, co.y, co.z
    if y > 0.26 and z > 0.33:  # tail
        return BLACK
    hx, hy, hz = x, y - HEAD.y, z - HEAD.z
    if y < -0.08 and z > NECK.z + 0.05:
        if hy > 0.05 and hz > -0.03:  # back of the head
            return BLACK
        blaze = abs(x) < 0.028 + max(0.0, 0.17 - hz) * 0.42
        cap = hz > 0.115 - abs(x) * 0.38
        if cap and not (blaze and hy < -0.06):
            return BLACK
        return WHITE
    for c, r in PATCHES:
        if (Vector(c) - co).length < r:
            return BLACK
    # toe creases on the paws: subtle darker grooves
    if z < 0.07:
        for px in (FX, -FX, HX, -HX):
            dx = x - px
            if abs(dx) < 0.07 and (abs(abs(dx) - 0.02) < 0.0045) and (y < -0.18 or 0.21 > y > 0.12 and y < 0.14):
                return tuple(c * 0.78 for c in WHITE)
    return WHITE


# ── Eyes with shape-keyed lids ─────────────────────────────────────────────────
EYE_SEMI = (0.064, 0.078, 0.030)  # width, height, depth


def eye_frame(body, s):
    forward = Vector((s * 0.33, -1.0, 0.06)).normalized()
    p, n = surface_hit(body, HEAD + Vector((s * 0.088, 0, 0.012)) + forward * 0.7, -forward)
    c = p - n * 0.012
    up = (Vector((0, 0, 1)) - n * n.z).normalized()
    out = up.cross(n).normalized() * (-s)  # toward the outside of the face
    if out.x * s < 0:
        out = -out
    return c, out, up, n


def lid_shape(kind, s):
    """Edge angle e(u) of the upper lid: 0 = top of the eye, pi = bottom. u = -1 inner .. +1 outer."""
    if kind == 'basis':
        return lambda u: 0.42
    if kind == 'blink':
        return lambda u: 2.95
    if kind == 'angry':
        return lambda u: 1.15 - 0.50 * u
    if kind == 'sad':
        return lambda u: 1.10 + 0.45 * u
    if kind == 'happy':
        return lambda u: 1.45 + 0.70 * u * u
    if kind == 'sleepy':
        return lambda u: 1.75
    raise ValueError(kind)


def build_lid(c, ex, ey, ez, s, name):
    """Upper lid (sweeps down from the top) and lower lid (sweeps up from the bottom) in one mesh.
    Shape keys move the lid edges; only 'happy' moves the lower lid, closing the eye into a ^ arc."""
    ax, ay, az = EYE_SEMI[0] * 1.12, EYE_SEMI[1] * 1.10, EYE_SEMI[2] + 0.016
    nu, nt = 18, 8

    def grid(e_fn, lower):
        pts = []
        for j in range(nt + 1):
            t = j / nt
            for i in range(nu + 1):
                u = -1 + 2 * i / nu
                r = math.sqrt(max(0.0, 1 - u * u * 0.9))
                a = t * e_fn(u)
                X, Y, Z = u, math.cos(a) * r, math.sin(a) * r
                if lower:
                    Y = -Y
                pts.append(c + ex * (X * ax) + ey * (Y * ay) + ez * (Z * az * (0.98 if lower else 1.0)))
        return pts

    up_happy = lid_shape('happy', s)
    low_shapes = {'basis': lambda u: 0.22, 'happy': lambda u: math.pi - up_happy(u) + 0.14}

    def points(kind):
        return grid(lid_shape(kind, s), False) + grid(low_shapes.get(kind, low_shapes['basis']), True)

    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in points('basis')]
    half = (nt + 1) * (nu + 1)
    for off in (0, half):
        for j in range(nt):
            for i in range(nu):
                a = off + j * (nu + 1) + i
                quad = (vs[a], vs[a + 1], vs[a + nu + 2], vs[a + nu + 1])
                bm.faces.new(quad if off == 0 else tuple(reversed(quad)))
    lid = mesh_from_bmesh(name, bm)
    shade_smooth(lid)
    attr = lid.data.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    for loop in lid.data.loops:
        vi = loop.vertex_index
        j = (vi % half) // (nu + 1)
        col = LASH if (vi < half and j >= nt - 1) else WHITE
        attr.data[loop.index].color = (*col, 1)
    lid.data.color_attributes.active_color = attr
    assign(lid, material('fur', rough=0.9))
    lid.shape_key_add(name='Basis', from_mix=False)
    for kind in ('blink', 'angry', 'sad', 'happy', 'sleepy'):
        key = lid.shape_key_add(name=kind, from_mix=False)
        key.value = 0.0  # Blender 5 creates new keys at 1.0
        for k, p in enumerate(points(kind)):
            key.data[k].co = p
    return lid


def build_eye(body, s):
    S = 'L' if s > 0 else 'R'
    c, ex, ey, ez = eye_frame(body, s)
    eye = add_uv_sphere(f'eye.{S}', 1.0, 32, 24)
    orient(eye, c, ez)
    eye.scale = (EYE_SEMI[0], EYE_SEMI[2], EYE_SEMI[1])
    bpy.context.view_layer.update()

    def iris(co, nor):
        local = eye.matrix_world.inverted() @ co
        lv = local.normalized()
        theta = math.acos(max(-1.0, min(1.0, -lv.y)))
        if theta > 1.05:
            return BLACK
        if theta > 0.90:
            return (0.04, 0.12, 0.05)
        h = (local.z + 1) / 2
        top, bottom = (0.10, 0.36, 0.13), (0.56, 0.90, 0.36)
        col = tuple(bottom[i] + (top[i] - bottom[i]) * h for i in range(3))
        ring = max(0.0, (theta - 0.66) / 0.24)
        return tuple(col[i] * (1 - 0.5 * ring) for i in range(3))

    paint(eye, iris)
    assign(eye, material('eye', rough=0.15))
    shade_smooth(eye)

    pupil = add_uv_sphere(f'pupil.{S}', 1.0, 16, 12)
    orient(pupil, c + ez * 0.027, ez)
    pupil.scale = (0.030, 0.006, 0.042)
    flat_color(pupil, (0.02, 0.02, 0.035))
    assign(pupil, material('pupil', rough=0.2))
    shade_smooth(pupil)

    highlights = []
    for k, (dx, dy, r) in enumerate(((0.013, 0.020, 0.016), (-0.014, -0.022, 0.0075))):
        h = add_uv_sphere(f'highlight.{k}.{S}', r, 12, 8)
        h.location = c + ex * dx + ey * dy + ez * 0.031
        h.scale = (1, 1, 0.55)
        flat_color(h, (1, 1, 1))
        assign(h, material('gloss', rough=0.1))
        highlights.append(h)
    lid = build_lid(c, ex, ey, ez, s, f'lid.{S}')
    return dict(eye=eye, pupil=pupil, highlights=highlights, lid=lid, center=c, normal=ez)


# ── Mouth with shape keys ──────────────────────────────────────────────────────
NC, NR = 16, 5  # columns across the mouth, rows from upper lip to lower edge


def w_curve(x):
    """Cat 'ω' line: 0 under the nose, dips in each half, corners back up."""
    return -0.0065 * math.sin(math.pi * abs(x))


def mouth_shape(kind):
    """Returns (half width, U(x), L(x), fang length) in muzzle-plane meters, x in [-1, 1]."""
    th = 0.0019
    if kind == 'basis':
        return 0.030, lambda x: w_curve(x) + th, lambda x: w_curve(x) - th, 0.0
    if kind == 'smile':
        return 0.040, lambda x: w_curve(x) * 1.1 + 0.011 * x * x + th, lambda x: w_curve(x) * 1.1 + 0.011 * x * x - th, 0.0
    if kind == 'open':
        return 0.052, lambda x: w_curve(x) * 0.8 + 0.007 * x * x, lambda x: -0.052 * (1 - x * x) ** 0.8 - 0.002, 0.010
    if kind == 'oh':
        return 0.028, lambda x: 0.010 * math.sqrt(max(0.0, 1 - x * x)) - 0.006, lambda x: -0.032 * math.sqrt(max(0.0, 1 - x * x)) - 0.006, 0.0
    if kind == 'frown':
        return 0.030, lambda x: -0.004 - 0.010 * x * x + th, lambda x: -0.004 - 0.010 * x * x - th, 0.0
    if kind == 'angry':
        return 0.036, lambda x: -0.002 - 0.007 * x * x, lambda x: -0.002 - 0.007 * x * x - 0.014 * (1 - x * x), 0.007
    raise ValueError(kind)


def build_mouth(body):
    nose_p, nose_n = surface_hit(body, (0, -1.0, HEAD.z - 0.025), (0, 1, 0))
    m0, n = surface_hit(body, (0, -1.0, HEAD.z - 0.068), (0, 1, 0))
    ex = Vector((1, 0, 0))
    ey = (Vector((0, 0, 1)) - n * n.z).normalized()

    def project(x, y):
        o = m0 + ex * x + ey * y + n * 0.3
        p, nn = surface_hit(body, o, -n)
        return p + nn * 0.0016

    def points(kind):
        W, U, L, fang = mouth_shape(kind)
        pts = []
        for j in range(NR + 1):
            t = j / NR
            for i in range(NC + 1):
                xh = -1 + 2 * i / NC
                y = U(xh) + (L(xh) - U(xh)) * t
                pts.append(project(xh * W, y))
        # fangs: two small triangles hanging from the upper lip
        for fx in (-0.42, 0.42):
            yb = U(fx)
            for bx in (fx - 0.10, fx + 0.10):
                pts.append(project(bx * W, yb) + n * 0.0006)
            pts.append(project(fx * W, yb - fang) + n * 0.0008)
        return pts

    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in points('basis')]
    for j in range(NR):
        for i in range(NC):
            a = j * (NC + 1) + i
            bm.faces.new((vs[a], vs[a + 1], vs[a + NC + 2], vs[a + NC + 1]))
    base = (NR + 1) * (NC + 1)
    for f in range(2):
        bm.faces.new((vs[base + f * 3], vs[base + f * 3 + 1], vs[base + f * 3 + 2]))
    mouth = mesh_from_bmesh('mouth', bm)
    shade_smooth(mouth)
    attr = mouth.data.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    for loop in mouth.data.loops:
        vi = loop.vertex_index
        if vi >= base:
            col = (0.99, 0.99, 0.97)
        else:
            j = vi // (NC + 1)
            col = TONGUE if j >= NR - 1 else MOUTH if j > 0 else (0.22, 0.10, 0.12)
        attr.data[loop.index].color = (*col, 1)
    mouth.data.color_attributes.active_color = attr
    assign(mouth, material('mouth', rough=0.5))
    mouth.shape_key_add(name='Basis', from_mix=False)
    for kind in ('smile', 'open', 'oh', 'frown', 'angry'):
        key = mouth.shape_key_add(name=kind, from_mix=False)
        key.value = 0.0  # Blender 5 creates new keys at 1.0
        for k, p in enumerate(points(kind)):
            key.data[k].co = p

    nose = add_uv_sphere('nose', 1.0, 16, 10)
    orient(nose, nose_p + nose_n * 0.005, nose_n)
    nose.scale = (0.027, 0.014, 0.017)
    bpy.context.view_layer.update()

    def nose_col(co, nor):
        local = nose.matrix_world.inverted() @ co
        return (1.0, 0.82, 0.85) if local.z > 0.55 and local.y < -0.3 else NOSE

    paint(nose, nose_col)
    assign(nose, material('gloss', rough=0.35))
    shade_smooth(nose)
    return mouth, nose


def build_whiskers(body):
    parts = []
    for s in (1, -1):
        for k, dz in enumerate((0.014, -0.002, -0.018)):
            p, n = surface_hit(body, (s * 0.07, -1.0, HEAD.z - 0.045 + dz * 0.5), (0, 1, 0))
            bm = bmesh.new()
            start = p + n * 0.002
            end = start + Vector((s * 0.17, -0.03, dz * 2.4 + 0.012))
            mid = (start + end) / 2 + Vector((0, 0, 0.008))
            cone_between(bm, start, mid, 0.0018, 0.0012, 4)
            cone_between(bm, mid, end, 0.0012, 0.0004, 4)
            w = mesh_from_bmesh(f'whisker.{k}.{"L" if s > 0 else "R"}', bm)
            flat_color(w, (0.98, 0.98, 0.98))
            assign(w, material('gloss', rough=0.4))
            parts.append(w)
    return parts


# ── Ears and fur tufts ─────────────────────────────────────────────────────────
def build_ear(s):
    bm = bmesh.new()
    base_w, depth, h = 0.095, 0.05, 0.175
    ring = [Vector((math.cos(a) * base_w, math.sin(a) * depth, 0)) for a in [i * 2 * math.pi / 16 for i in range(16)]]
    verts = [bm.verts.new(c) for c in ring]
    tip = bm.verts.new(Vector((0, 0.012, h)))
    for i in range(len(verts)):
        bm.faces.new((verts[i], verts[(i + 1) % len(verts)], tip))
    bm.faces.new(list(reversed(verts)))
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    ear = mesh_from_bmesh(f'ear.{"L" if s > 0 else "R"}', bm)
    sub = ear.modifiers.new('sub', 'SUBSURF')
    sub.levels = 1
    apply_modifiers(ear)
    shade_smooth(ear)
    flat_color(ear, BLACK)

    ibm = bmesh.new()
    ring2 = [Vector((math.cos(a) * 0.064, -0.03 + math.sin(a) * 0.012, 0.014)) for a in [i * 2 * math.pi / 14 for i in range(14)]]
    v2 = [ibm.verts.new(c) for c in ring2]
    t2 = ibm.verts.new(Vector((0, -0.014, h * 0.8)))
    for i in range(len(v2)):
        ibm.faces.new((v2[i], v2[(i + 1) % len(v2)], t2))
    # white fluff tufts inside the ear
    for k, (x, lean) in enumerate(((-0.025, 0.25), (0.0, 0.0), (0.025, -0.25))):
        cone_between(ibm, (x, -0.036, 0.012), (x + lean * 0.05, -0.05, 0.075 + 0.012 * (k == 1)), 0.012, 0.001, 6)
    inner = mesh_from_bmesh('earinner', ibm)
    shade_smooth(inner)

    def inner_col(co, nor):
        return (0.97, 0.96, 0.95) if co.y < -0.033 and co.z < 0.09 and abs(co.x) < 0.04 and co.y < -0.035 else PINK

    paint(inner, inner_col)
    for o in (ear, inner):
        assign(o, material('fur', rough=0.9))
    ear = join([ear, inner], f'ear.{"L" if s > 0 else "R"}')
    ear.location = HEAD + Vector((s * 0.140, 0.035, 0.150))
    ear.rotation_euler = (math.radians(-8), 0, math.radians(-26 * s))
    bpy.context.view_layer.update()
    return ear


def build_tufts(body):
    """Cheek and chest fluff: short, wide puffs that soften the silhouette."""
    bm = bmesh.new()
    for s_ in (1, -1):
        for dy, dz, droop in ((-0.06, -0.075, 0.010), (-0.02, -0.095, 0.022), (0.025, -0.07, 0.008)):
            p, n = surface_out(body, HEAD + Vector((0, dy, dz)), Vector((s_, 0, -0.15)))
            tip = p + n * 0.032 + Vector((s_ * 0.012, 0, -droop))
            cone_between(bm, p - n * 0.015, tip, 0.030, 0.006, 8)
    for x, z in ((-0.045, 0.34), (0.0, 0.325), (0.045, 0.34)):
        p, n = surface_out(body, (x, CHEST.y, z), (0, -1, -0.1))
        tip = p + n * 0.026 + Vector((0, 0, -0.022))
        cone_between(bm, p - n * 0.015, tip, 0.034, 0.007, 8)
    tufts = mesh_from_bmesh('tufts', bm)
    sub = tufts.modifiers.new('sub', 'SUBSURF')
    sub.levels = 1
    apply_modifiers(tufts)
    shade_smooth(tufts)
    paint(tufts, lambda co, n: fur_color(co))
    assign(tufts, material('fur', rough=0.9))
    return tufts


def build_pads():
    """Pink toe beans under every paw, parented to the paw/foot bones by the rig."""
    pads = []
    for s in (1, -1):
        for front in (True, False):
            px = FX if front else HX
            py = -0.172 if front else 0.178
            bm = bmesh.new()
            bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=1.0,
                                      matrix=Matrix.Translation((s * px, py + 0.012, 0.004)) @ Matrix.Diagonal((0.030, 0.026, 0.006, 1)))
            for dx, dy in ((-0.026, -0.022), (-0.009, -0.038), (0.009, -0.038), (0.026, -0.022)):
                bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=1.0,
                                          matrix=Matrix.Translation((s * px + dx, py + dy + 0.012, 0.006)) @ Matrix.Diagonal((0.011, 0.012, 0.005, 1)))
            o = mesh_from_bmesh(f'pad.{"L" if s > 0 else "R"}.{"front" if front else "hind"}', bm)
            shade_smooth(o)
            flat_color(o, PAD)
            assign(o, material('pad', rough=0.6))
            pads.append(o)
    return pads


# ── Accessories ────────────────────────────────────────────────────────────────
def solidify(obj, t):
    m = obj.modifiers.new('solid', 'SOLIDIFY')
    m.thickness = t
    m.offset = 1
    apply_modifiers(obj)


def rounded_box(name, size, bevel=0.01):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    obj = mesh_from_bmesh(name, bm)
    b = obj.modifiers.new('bevel', 'BEVEL')
    b.width = bevel
    b.segments = 3
    apply_modifiers(obj)
    shade_smooth(obj)
    return obj


def paw_emblem(name, scale=1.0, color=METAL_DARK, mat=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=10, radius=1.0,
                              matrix=Matrix.Translation((0, 0, -0.004 * scale)) @ Matrix.Diagonal((0.016 * scale, 0.004, 0.012 * scale, 1)))
    for dx, dz in ((-0.017, 0.010), (-0.006, 0.018), (0.006, 0.018), (0.017, 0.010)):
        bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=8, radius=1.0,
                                  matrix=Matrix.Translation((dx * scale, 0, dz * scale)) @ Matrix.Diagonal((0.0055 * scale, 0.004, 0.0065 * scale, 1)))
    emb = mesh_from_bmesh(name, bm)
    shade_smooth(emb)
    flat_color(emb, color)
    assign(emb, mat or material('metal', METAL, rough=0.3, metal=0.9))
    return emb


def metal_plate(name, size, location, normal, emblem_scale):
    plate = rounded_box(name, size, bevel=min(size) * 0.9)
    orient(plate, location, normal)
    flat_color(plate, METAL)
    assign(plate, material('metal', METAL, rough=0.3, metal=0.9))
    emb = paw_emblem(name + '_emblem', emblem_scale)
    orient(emb, location + normal * (size[1] * 0.7), normal)
    bolts = []
    for sx in (-1, 1):
        b = add_uv_sphere(name + f'_bolt{sx}', 0.0045, 8, 6)
        m = plate.matrix_world.to_3x3().normalized()
        b.location = location + m @ Vector((sx * size[0] * 0.40, 0, 0)) + normal * size[1] * 0.6
        flat_color(b, METAL_DARK)
        assign(b, material('metal', METAL, rough=0.3, metal=0.9))
        bolts.append(b)
    return [plate, emb] + bolts


def build_headband(body):
    c = HEAD + Vector((0, 0.0, 0.118))
    axis = Vector((0, 0.30, 1)).normalized()  # lower on the forehead, higher at the back
    bm = ring_on_surface(body, c, axis, (-0.034, -0.012, 0.012, 0.034), outward=0.004, steps=64)
    band = mesh_from_bmesh('headband', bm)
    solidify(band, 0.010)
    shade_smooth(band)
    flat_color(band, CLOTH)
    assign(band, material('cloth', rough=0.85))
    fwd = Vector((0, -1, 0)) - axis * Vector((0, -1, 0)).dot(axis)
    fwd.normalize()
    p, n = surface_hit(body, c + fwd * 0.8, -fwd)
    plate = metal_plate('plate', (0.108, 0.008, 0.046), p + n * 0.016, n, 1.15)
    q, m = surface_out(body, c, -fwd)
    knot_pos = q + m * 0.022
    knot = ellipsoid('knot', knot_pos, (0.036, 0.026, 0.030), forward=m)
    flat_color(knot, CLOTH)
    assign(knot, material('cloth', rough=0.85))
    shade_smooth(knot)
    ribbons = []
    for s in (1, -1):
        bm = bmesh.new()
        L, W = 0.30, 0.068
        cols, rows = 2, 14
        grid = []
        for r in range(rows + 1):
            t = r / rows
            row = []
            for cc in range(cols + 1):
                w = (cc / cols - 0.5) * W * (1 - 0.2 * t)
                wave = 0.012 * math.sin(t * math.pi * 2.0)  # a little cloth wave
                row.append(bm.verts.new(Vector((w, wave, -t * L))))
            grid.append(row)
        for r in range(rows):
            for cc in range(cols):
                bm.faces.new((grid[r][cc], grid[r][cc + 1], grid[r + 1][cc + 1], grid[r + 1][cc]))
        rib = mesh_from_bmesh(f'ribbon.{"L" if s > 0 else "R"}', bm)
        solidify(rib, 0.004)
        shade_smooth(rib)
        rib.matrix_world = Matrix.Translation(knot_pos) @ Matrix.Rotation(math.radians(32), 4, 'X') @ Matrix.Rotation(math.radians(22 * s), 4, 'Y') @ Matrix.Rotation(math.radians(75 * s), 4, 'Z')
        flat_color(rib, CLOTH)
        assign(rib, material('cloth', rough=0.85))
        ribbons.append(rib)
    return dict(parts=[band, knot] + plate, ribbons=ribbons, knot_pos=knot_pos)


def build_scarf(body):
    """Wide neck scarf with a metal plate (reference 13 'Coleira')."""
    axis = Vector((0, -0.45, 1)).normalized()
    bm = ring_on_surface(body, NECK + Vector((0, 0.03, -0.045)), axis, (-0.030, -0.010, 0.010, 0.030), outward=0.010, steps=56, max_r=0.17)
    scarf = mesh_from_bmesh('scarf', bm)
    solidify(scarf, 0.012)
    shade_smooth(scarf)
    flat_color(scarf, CLOTH)
    assign(scarf, material('cloth', rough=0.85))
    d = Vector((0, -1, -0.45)).normalized()
    p, n = surface_out(body, NECK + Vector((0, 0.03, -0.045)), d)
    plate = metal_plate('scarfplate', (0.075, 0.007, 0.034), p + n * 0.024, n, 0.85)
    return [scarf] + plate


def build_wraps(body):
    """Black wraps on all four legs, two layered bands each (front: wrists, hind: hocks)."""
    wraps = []
    for s in (1, -1):
        S = 'L' if s > 0 else 'R'
        for front in (True, False):
            if front:
                center = (s * FX, -0.150, WRIST_Z)
                axis = (0, 0.12, 1)
            else:
                center = (s * HX, 0.205, HOCK_BAND_Z)
                axis = (0, -0.4, 1)
            parts = []
            for off in (-0.02, 0.012):
                bm = ring_on_surface(body, Vector(center) + Vector(axis).normalized() * off, axis, (-0.013, 0.0, 0.013),
                                     outward=0.003, steps=28, max_r=0.1)
                b = mesh_from_bmesh('wrap', bm)
                solidify(b, 0.005)
                shade_smooth(b)
                parts.append(b)
            w = join(parts, f'wrap.{S}.{"front" if front else "hind"}')
            flat_color(w, CLOTH)
            assign(w, material('cloth', rough=0.85))
            wraps.append(w)
    return wraps


def build_satchel(body):
    # bandolier strap around the torso, from the right shoulder across the chest to the left hip
    axis = Vector((0.45, 1.0, -0.10)).normalized()
    bm = ring_on_surface(body, CHEST + Vector((0, 0.05, 0.02)), axis, (-0.016, 0.0, 0.016), outward=0.006, steps=64, max_r=0.26)
    strap = mesh_from_bmesh('strap', bm)
    solidify(strap, 0.007)
    shade_smooth(strap)
    flat_color(strap, LEATHER_DARK)
    assign(strap, material('leather', rough=0.7))
    # the bag rides on the left flank, toward the back
    p, n = surface_hit(body, (0.8, 0.08, 0.38), (-1, 0, 0))
    center = p + n * 0.055
    bag = rounded_box('bag', (0.075, 0.16, 0.125), bevel=0.03)
    orient(bag, center, Vector((0, -1, 0)))
    flat_color(bag, LEATHER)
    assign(bag, material('leather', rough=0.7))
    flap = rounded_box('bagflap', (0.082, 0.166, 0.075), bevel=0.02)
    orient(flap, center + Vector((0.004, 0, 0.032)), Vector((0, -1, 0)))
    flat_color(flap, LEATHER_DARK)
    assign(flap, material('leather', rough=0.7))
    parts = [strap, bag, flap]
    for dy in (-0.045, 0.045):
        st = rounded_box('bagstrap', (0.086, 0.016, 0.06), bevel=0.005)
        orient(st, center + Vector((0.006, dy, -0.005)), Vector((0, -1, 0)))
        flat_color(st, LEATHER_DARK)
        assign(st, material('leather', rough=0.7))
        bk = rounded_box('buckle', (0.006, 0.022, 0.016), bevel=0.003)
        orient(bk, center + Vector((0.046, dy, -0.012)), Vector((0, -1, 0)))
        flat_color(bk, (0.86, 0.72, 0.36))
        assign(bk, material('metal', METAL, rough=0.3, metal=0.9))
        parts += [st, bk]
    emb = paw_emblem('bagemblem', 1.1, color=(0.62, 0.40, 0.22), mat=material('leather', rough=0.7))
    orient(emb, center + Vector((0.046, 0, 0.035)), Vector((1, 0, 0)))
    parts.append(emb)
    return parts


# ── Preview renders ────────────────────────────────────────────────────────────
def setup_render():
    sc = bpy.context.scene
    if ENGINE == 'cycles':
        sc.render.engine = 'CYCLES'
        sc.cycles.device = 'CPU'
        sc.cycles.samples = 48
        sc.cycles.use_denoising = True
    else:
        sc.render.engine = 'BLENDER_WORKBENCH'
        sh = sc.display.shading
        sh.light = 'STUDIO'
        sh.color_type = 'VERTEX'
        sh.show_cavity = True
        sh.show_shadows = True
        sh.show_object_outline = True
    sc.render.resolution_x = 720
    sc.render.resolution_y = 720
    world = bpy.data.worlds.new('w')
    sc.world = world
    bg = world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (0.93, 0.86, 0.74, 1)
    bg.inputs['Strength'].default_value = 0.6
    sc.view_settings.view_transform = 'Standard'
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 2.2
    sun.color = (1.0, 0.92, 0.80)
    sun.angle = math.radians(8)
    s = link(bpy.data.objects.new('sun', sun))
    s.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    fill = bpy.data.lights.new('fill', 'AREA')
    fill.energy = 120
    fill.size = 2
    fill.color = (0.75, 0.85, 1.0)
    f = link(bpy.data.objects.new('fill', fill))
    f.location = (-1.6, -1.4, 1.2)
    f.rotation_euler = (math.radians(60), 0, math.radians(-130))
    rim = bpy.data.lights.new('rim', 'AREA')
    rim.energy = 160
    rim.size = 1
    rim.color = (1.0, 0.85, 0.65)
    r = link(bpy.data.objects.new('rim', rim))
    r.location = (0.8, 1.6, 1.4)
    r.rotation_euler = (math.radians(-55), 0, math.radians(150))
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=3)
    g = mesh_from_bmesh('ground', bm)
    assign(g, material('ground', (0.80, 0.70, 0.55), vertex=False))
    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 60
    cam = link(bpy.data.objects.new('cam', cam_data))
    sc.camera = cam
    return cam


def render_views(cam, prefix, target=(0, -0.02, 0.42), dist=2.3, views=None, height=0.35):
    os.makedirs(OUT_RENDERS, exist_ok=True)
    views = views or {'front': -90, 'three_quarter': -55, 'side': 0, 'back': 90}
    for name, az in views.items():
        a = math.radians(az)
        pos = Vector(target) + Vector((math.cos(a) * dist, math.sin(a) * dist, height))
        cam.location = pos
        cam.rotation_euler = (Vector(target) - pos).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.scene.render.filepath = os.path.join(OUT_RENDERS, f'{prefix}_{name}.png')
        bpy.ops.render.render(write_still=True)


def preview_expressions(cam, parts):
    """Face renders for each expression, by mixing shape keys (lids + mouth)."""
    lids = [e['lid'] for e in parts['eyes']]
    mouth = parts['mouth']
    combos = {
        'neutral': ({}, {}),
        'feliz': ({'happy': 0.85}, {'open': 1.0}),
        'surpreso': ({}, {'oh': 1.0}),
        'bravo': ({'angry': 1.0}, {'angry': 1.0}),
        'triste': ({'sad': 1.0}, {'frown': 1.0}),
        'curioso': ({}, {'smile': 0.5}),
        'engracado': ({'happy': 1.0}, {'smile': 1.0}),
        'sonolento': ({'sleepy': 1.0}, {}),
    }
    for name, (lk, mk) in combos.items():
        for lid in lids:
            for kb in lid.data.shape_keys.key_blocks[1:]:
                kb.value = lk.get(kb.name, 0.0)
        if name == 'engracado':  # wink: only the right eye closes
            for kb in lids[0].data.shape_keys.key_blocks[1:]:
                kb.value = 0.0
        for kb in mouth.data.shape_keys.key_blocks[1:]:
            kb.value = mk.get(kb.name, 0.0)
        render_views(cam, f'expr_{name}', target=tuple(HEAD + Vector((0, 0, -0.01))), dist=1.05, views={'f': -90}, height=0.08)
    for o in lids + [mouth]:
        for kb in o.data.shape_keys.key_blocks[1:]:
            kb.value = 0.0


# ── Build ──────────────────────────────────────────────────────────────────────
def build_model():
    body = build_body()
    paint(body, fur_color)
    assign(body, material('fur', rough=0.9))
    eyes = [build_eye(body, s) for s in (1, -1)]
    mouth, nose = build_mouth(body)
    parts = dict(
        body=body,
        eyes=eyes,
        mouth=mouth,
        nose=nose,
        whiskers=build_whiskers(body),
        ears=[build_ear(s) for s in (1, -1)],
        pads=build_pads(),
        headband=build_headband(body),
        scarf=build_scarf(body),
        wraps=build_wraps(body),
        satchel=build_satchel(body),
    )
    return parts


def main():
    reset_scene()
    parts = build_model()
    print('BODY_TRIS', sum(len(p.vertices) - 2 for p in parts['body'].data.polygons))
    if STAGE == 'model':
        cam = setup_render()
        if VIEWS in ('all', 'body'):
            render_views(cam, 'shinichi_model')
        if VIEWS in ('all', 'face'):
            render_views(cam, 'shinichi_face', target=tuple(HEAD), dist=1.1, views={'face': -90, 'face34': -60}, height=0.1)
        if VIEWS in ('all', 'expr'):
            preview_expressions(cam, parts)
        return
    import build_rig
    build_rig.run(parts, OUT_GLB, OUT_RENDERS, setup_render, render_views)


if __name__ == '__main__':  # importable by build_villager.py for its helpers
    main()
