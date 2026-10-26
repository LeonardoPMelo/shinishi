"""
Rig, animate and export Shinichi. Called by build_shinichi.py (stage "full").

Skeleton: body bones deform the fur mesh (automatic heat weights); ears carry the ear meshes;
ribbon bones skin the headband tails; face parts (eyes, nose, whiskers, band) ride the head bone.
Facial controls: shape keys on lid.L/R (blink angry sad happy sleepy) and mouth (smile open oh frown angry);
pupil.L/R are scaled by the game for dilation.

Clips are generated from simple gait/pose functions and baked as keyframes, so an animator can
later replace them with hand-keyed clips of the same names.
"""
import math
import os

import bpy
from mathutils import Matrix, Quaternion, Vector

from anatomy import FRONT, HIND, TAIL, side

FPS = 30
X = (1, 0, 0)
Y = (0, 1, 0)
Z = (0, 0, 1)



def bone_table():
    t = [
        ('root', (0, 0, 0), (0, 0, 0.12), None, False),
        ('hips', (0, 0.27, 0.36), (0, 0.08, 0.34), 'root', True),
        ('spine', (0, 0.08, 0.34), (0, -0.08, 0.35), 'hips', True),
        ('chest', (0, -0.08, 0.35), (0, -0.15, 0.42), 'spine', True),
        ('neck', (0, -0.15, 0.42), (0, -0.22, 0.55), 'chest', True),
        ('head', (0, -0.22, 0.55), (0, -0.26, 0.86), 'neck', True),
    ]
    for i in range(5):
        t.append((f'tail.{i + 1}', TAIL[i], TAIL[i + 1], 'hips' if i == 0 else f'tail.{i}', True))
    for s_, S in ((1, 'L'), (-1, 'R')):
        f = {k: tuple(side(v, s_)) for k, v in FRONT.items()}
        h = {k: tuple(side(v, s_)) for k, v in HIND.items()}
        t += [
            (f'upperarm.{S}', f['shoulder'], f['elbow'], 'chest', True),
            (f'forearm.{S}', f['elbow'], f['wrist'], f'upperarm.{S}', True),
            (f'paw.{S}', f['wrist'], f['toe'], f'forearm.{S}', True),
            (f'thigh.{S}', h['hip'], h['knee'], 'hips', True),
            (f'shin.{S}', h['knee'], h['hock'], f'thigh.{S}', True),
            (f'foot.{S}', h['hock'], h['toe'], f'shin.{S}', True),
        ]
    return t


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def activate(obj):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


def join(objs, name):
    activate(objs[0])
    for o in objs[1:]:
        o.select_set(True)
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


def build_armature(parts):
    data = bpy.data.armatures.new('ShinichiRig')
    arm = link(bpy.data.objects.new('Shinichi', data))
    activate(arm)
    bpy.ops.object.mode_set(mode='EDIT')
    for name, h, tl, parent, deform in bone_table():
        eb = data.edit_bones.new(name)
        eb.head, eb.tail = Vector(h), Vector(tl)
        eb.use_deform = deform
        if parent:
            eb.parent = data.edit_bones[parent]
    # ears: from each ear mesh's base, pointing along its own up axis
    for ear in parts['ears']:
        S = 'L' if ear.location.x > 0 else 'R'
        eb = data.edit_bones.new(f'ear.{S}')
        up = (ear.matrix_world.to_3x3().normalized() @ Vector((0, 0, 1))).normalized()
        eb.head = ear.matrix_world.translation
        eb.tail = eb.head + up * 0.12
        eb.parent = data.edit_bones['head']
        eb.use_deform = False
    # ribbons: two bones per tail along each ribbon strip
    for rib in parts['headband']['ribbons']:
        S = rib.name.split('.')[-1]
        down = (rib.matrix_world.to_3x3().normalized() @ Vector((0, 0, -1))).normalized()
        start = rib.matrix_world.translation
        prev = data.edit_bones['head']
        for k in range(3):
            eb = data.edit_bones.new(f'ribbon.{S}.{k + 1}')
            eb.head = start + down * 0.1 * k
            eb.tail = start + down * 0.1 * (k + 1)
            eb.parent = prev
            eb.use_deform = False
            prev = eb
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def bone_parent(obj, arm, bone):
    bpy.context.view_layer.update()  # matrix_world must reflect any scale/rotation set just before
    mw = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = mw


def skin(parts, arm):
    body = parts['body']
    activate(body)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    groups = {g.index: g.name for g in body.vertex_groups}
    used = set()
    for v in body.data.vertices:
        for g in v.groups:
            if g.weight > 0.05:
                used.add(groups[g.group])
    missing = [r[0] for r in bone_table() if r[4] and r[0] not in used]
    print('SKIN_GROUPS_USED', len(used), 'MISSING', missing)

    # ribbons: manual weights along their length, three bones each
    for rib in parts['headband']['ribbons']:
        S = rib.name.split('.')[-1]
        mw = rib.matrix_world.copy()
        groups = [rib.vertex_groups.new(name=f'ribbon.{S}.{k}') for k in (1, 2, 3)]
        for v in rib.data.vertices:
            t = min(1.0, max(0.0, -v.co.z / 0.3)) * 3  # 0..3 along the strip
            for k, g in enumerate(groups):
                w = max(0.0, 1 - abs(t - (k + 0.5)))
                if k == 0 and t < 0.5:
                    w = 1.0
                if k == 2 and t > 2.5:
                    w = 1.0
                if w > 0:
                    g.add([v.index], w, 'REPLACE')
        rib.parent = arm
        rib.parent_type = 'OBJECT'
        bpy.context.view_layer.update()
        rib.matrix_world = mw
        mod = rib.modifiers.new('rig', 'ARMATURE')
        mod.object = arm
    for S in ('L', 'R'):
        for k in (1, 2, 3):
            arm.data.bones[f'ribbon.{S}.{k}'].use_deform = True

    # rigid parts ride their bones
    hb = parts['headband']
    head_pieces = [e['eye'] for e in parts['eyes']] + [h for e in parts['eyes'] for h in e['highlights']]
    head_pieces += [parts['nose']] + parts['whiskers'] + hb['parts']
    headparts = join(head_pieces, 'headparts')
    bone_parent(headparts, arm, 'head')
    for e in parts['eyes']:
        bone_parent(e['pupil'], arm, 'head')
        bone_parent(e['lid'], arm, 'head')  # shape keys: blink angry sad happy sleepy
    bone_parent(parts['mouth'], arm, 'head')  # shape keys: smile open oh frown angry
    for ear in parts['ears']:
        bone_parent(ear, arm, f'ear.{"L" if ear.location.x > 0 else "R"}')
    bone_parent(join(parts['scarf'], 'scarf'), arm, 'neck')
    for w in parts['wraps']:
        S, kind = w.name.split('.')[1], w.name.split('.')[2]
        bone_parent(w, arm, f'forearm.{S}' if kind == 'front' else f'shin.{S}')
    for pad in parts['pads']:
        S, kind = pad.name.split('.')[1], pad.name.split('.')[2]
        bone_parent(pad, arm, f'paw.{S}' if kind == 'front' else f'foot.{S}')
    bone_parent(join(parts['satchel'], 'satchel'), arm, 'spine')


# ── Animation ──────────────────────────────────────────────────────────────────
class Poser:
    def __init__(self, arm):
        self.arm = arm
        self.rest = {b.name: b.matrix_local.to_3x3() for b in arm.data.bones}
        self.names = [b.name for b in arm.data.bones if b.name not in ('root',)]
        for pb in arm.pose.bones:
            pb.rotation_mode = 'QUATERNION'

    def q(self, bone, axis, angle):
        """Rotation about a world (rest-space) axis, expressed in the bone's local frame."""
        return Quaternion((self.rest[bone].inverted() @ Vector(axis)).normalized(), angle)

    def loc(self, bone, vec):
        return self.rest[bone].inverted() @ Vector(vec)

    def key(self, frame, pose):
        """pose: bone -> dict(rot=[(axis, angle), ...], loc=world vector)"""
        for name in self.names:
            pb = self.arm.pose.bones[name]
            spec = pose.get(name, {})
            q = Quaternion()
            for axis, ang in spec.get('rot', []):
                q = q @ self.q(name, axis, ang)
            pb.rotation_quaternion = q
            pb.location = self.loc(name, spec['loc']) if 'loc' in spec else Vector()
            pb.keyframe_insert('rotation_quaternion', frame=frame)
            pb.keyframe_insert('location', frame=frame)


def add(pose, bone, axis, angle):
    pose.setdefault(bone, {}).setdefault('rot', []).append((axis, angle))


def gait(t, phase, duty, amp):
    """Leg swing angle (negative = forward) and lift 0..1 for a looping gait."""
    u = (t + phase) % 1.0
    if u < duty:
        s = u / duty
        return -amp + 2 * amp * s, 0.0
    s = (u - duty) / (1 - duty)
    e = s * s * (3 - 2 * s)
    return amp - 2 * amp * e, math.sin(math.pi * s)


def leg(pose, side, front, swing, lift):
    if front:
        add(pose, f'upperarm.{side}', X, swing)
        add(pose, f'forearm.{side}', X, lift * 0.75)
        add(pose, f'paw.{side}', X, lift * 0.9)
    else:
        add(pose, f'thigh.{side}', X, swing)
        add(pose, f'shin.{side}', X, lift * 0.65)
        add(pose, f'foot.{side}', X, -lift * 0.75)


def tail_sway(pose, t, amp, curl=0.0, speed=1.0, lag=0.55):
    for i in range(1, 6):
        add(pose, f'tail.{i}', Y, amp * math.sin(2 * math.pi * t * speed - i * lag))
        if curl:
            add(pose, f'tail.{i}', X, curl * (i / 5))


def clip_idle(t):
    p = {}
    b = math.sin(2 * math.pi * t)
    add(p, 'chest', X, 0.015 * b)
    add(p, 'neck', X, -0.02 * b)
    add(p, 'head', Z, 0.10 * math.sin(2 * math.pi * t + 0.6))
    add(p, 'head', Y, 0.05 * math.sin(2 * math.pi * t))
    p['hips'] = {'loc': (0, 0, 0.004 * b)}
    tail_sway(p, t, 0.10, curl=0.0)
    return p


def clip_walk(t):
    p = {}
    for side, front, ph in (('L', False, 0.0), ('L', True, 0.25), ('R', False, 0.5), ('R', True, 0.75)):
        sw, lf = gait(t, ph, 0.62, 0.30 if front else 0.28)
        leg(p, side, front, sw, lf * (0.9 if front else 0.8))
    p['hips'] = {'loc': (0, 0, -0.008 * math.cos(4 * math.pi * t))}
    add(p, 'hips', Y, 0.03 * math.sin(2 * math.pi * t))
    add(p, 'chest', Y, -0.03 * math.sin(2 * math.pi * t))
    add(p, 'neck', X, 0.025 * math.cos(4 * math.pi * t))
    tail_sway(p, t, 0.12)
    return p


def clip_run(t):
    p = {}
    for side, front, ph in (('L', True, 0.0), ('R', True, 0.08), ('L', False, 0.5), ('R', False, 0.58)):
        sw, lf = gait(t, ph, 0.38, 0.62 if front else 0.58)
        leg(p, side, front, sw, lf)
    flex = math.sin(2 * math.pi * t)
    add(p, 'chest', X, 0.14 * flex)
    add(p, 'hips', X, -0.10 * flex)
    add(p, 'neck', X, -0.08 * flex)
    p['hips'] = dict(p.get('hips', {}), loc=(0, 0, 0.025 * math.sin(2 * math.pi * t + 1.2)))
    for i in range(2, 6):
        add(p, f'tail.{i}', X, -0.28)
    tail_sway(p, t, 0.06, speed=1.0)
    return p


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def crouch(p, k):
    for s in ('L', 'R'):
        add(p, f'thigh.{s}', X, -0.35 * k)
        add(p, f'shin.{s}', X, 0.75 * k)
        add(p, f'foot.{s}', X, -0.45 * k)
        add(p, f'upperarm.{s}', X, 0.30 * k)
        add(p, f'forearm.{s}', X, -0.55 * k)
        add(p, f'paw.{s}', X, 0.30 * k)


def clip_jump(t):
    p = {}
    k = smooth(t / 0.45) if t < 0.45 else 1 - smooth((t - 0.45) / 0.25)
    e = smooth((t - 0.45) / 0.55)
    crouch(p, k)
    for s in ('L', 'R'):
        add(p, f'upperarm.{s}', X, -0.95 * e)
        add(p, f'forearm.{s}', X, 0.15 * e)
        add(p, f'thigh.{s}', X, 0.85 * e)
        add(p, f'shin.{s}', X, -0.25 * e)
    add(p, 'neck', X, -0.18 * e + 0.08 * k)
    p['hips'] = dict(p.get('hips', {}), loc=(0, 0, -0.07 * k + 0.02 * e))
    for i in range(2, 6):
        add(p, f'tail.{i}', X, -0.15 * e + 0.1 * k)
    return p


def clip_fall(t):
    p = {}
    w = math.sin(2 * math.pi * t)
    for s in ('L', 'R'):
        add(p, f'upperarm.{s}', X, -0.55 + 0.05 * w)
        add(p, f'forearm.{s}', X, 0.25)
        add(p, f'thigh.{s}', X, 0.45 - 0.04 * w)
        add(p, f'shin.{s}', X, 0.15)
    add(p, 'neck', X, -0.10)
    for i in range(2, 6):
        add(p, f'tail.{i}', X, 0.12)
    tail_sway(p, t, 0.08, speed=2.0)
    return p


def clip_land(t):
    k = t / 0.25 if t < 0.25 else 1 - smooth((t - 0.25) / 0.75)
    p = {}
    crouch(p, k * 0.9)
    add(p, 'neck', X, 0.10 * k)
    p['hips'] = dict(p.get('hips', {}), loc=(0, 0, -0.075 * k))
    return p


def clip_sit(t):
    p = {}
    b = math.sin(2 * math.pi * t)
    add(p, 'hips', X, -0.62)
    p['hips']['loc'] = (0, 0.06, -0.165)
    for s in ('L', 'R'):
        add(p, f'upperarm.{s}', X, 0.58)
        add(p, f'paw.{s}', X, 0.05)
        add(p, f'thigh.{s}', X, -0.90)
        add(p, f'shin.{s}', X, 1.75)
        add(p, f'foot.{s}', X, -0.55)
    add(p, 'neck', X, 0.30 + 0.015 * b)
    add(p, 'head', X, 0.12)
    add(p, 'head', Z, 0.12 * math.sin(2 * math.pi * t))
    add(p, 'chest', X, 0.01 * b)
    add(p, 'tail.1', X, 1.15)
    for i in range(2, 6):
        add(p, f'tail.{i}', Z, 0.42)
    add(p, 'tail.5', Z, 0.25 * math.sin(2 * math.pi * t * 2))
    return p


def clip_meow(t):
    p = {}
    bump = math.sin(math.pi * smooth(t))
    add(p, 'neck', X, -0.22 * bump)
    add(p, 'head', X, -0.08 * bump)
    tail_sway(p, t, 0.08)
    return p


def clip_crouch(t):
    p = {}
    w = math.sin(2 * math.pi * t)
    crouch(p, 1.0)
    for S in ('L', 'R'):  # lower still: a cat stalking its prey
        add(p, f'thigh.{S}', X, -0.25)
        add(p, f'shin.{S}', X, 0.40)
        add(p, f'foot.{S}', X, -0.15)
        add(p, f'upperarm.{S}', X, 0.30)
        add(p, f'forearm.{S}', X, -0.45)
        add(p, f'paw.{S}', X, 0.15)
    p['hips'] = dict(p.get('hips', {}), loc=(0, 0.03, -0.13 + 0.004 * w))
    add(p, 'hips', Y, 0.05 * w)  # ready-to-pounce wiggle
    add(p, 'neck', X, 0.16)
    add(p, 'head', X, -0.12)
    add(p, 'tail.1', X, 0.55)
    for i in range(2, 6):
        add(p, f'tail.{i}', X, -0.18)
    tail_sway(p, t, 0.05, speed=2.0)
    return p


def clip_attack(t):
    """Shuriken throw: wind up, swipe the right paw forward, recover."""
    p = {}
    wind = smooth(t / 0.35) * (1 - smooth((t - 0.35) / 0.15))
    strike = smooth((t - 0.35) / 0.18) * (1 - smooth((t - 0.7) / 0.3))
    add(p, 'upperarm.R', X, 0.45 * wind - 1.5 * strike)
    add(p, 'forearm.R', X, -0.5 * wind - 0.2 * strike)
    add(p, 'paw.R', X, 0.4 * wind - 0.3 * strike)
    add(p, 'chest', X, 0.10 * wind - 0.12 * strike)
    add(p, 'chest', Z, 0.10 * wind - 0.15 * strike)
    add(p, 'neck', X, -0.08 * strike)
    p['hips'] = dict(p.get('hips', {}), loc=(0, 0.03 * wind - 0.03 * strike, -0.02 * wind))
    for i in range(2, 6):
        add(p, f'tail.{i}', Y, 0.12 * wind - 0.12 * strike)
    return p


def clip_victory(t):
    """Standing on the hind legs, right paw raised high (sheet 13, 'Comemorando')."""
    p = {}
    bounce = abs(math.sin(2 * math.pi * t))
    up = 1.25
    add(p, 'hips', X, -up)
    p['hips']['loc'] = (0, 0.02, -0.07 + 0.015 * bounce)
    for S in ('L', 'R'):
        add(p, f'thigh.{S}', X, up - 0.05)
        add(p, f'shin.{S}', X, 0.25)
        add(p, f'foot.{S}', X, -0.20)
    add(p, 'upperarm.R', X, -2.05 + 0.15 * math.sin(4 * math.pi * t))
    add(p, 'upperarm.R', Y, 0.60)
    add(p, 'forearm.R', X, -0.35)
    add(p, 'upperarm.L', X, 0.45)
    add(p, 'forearm.L', X, -0.9)
    add(p, 'neck', X, 0.95)
    add(p, 'head', X, 0.25)
    add(p, 'head', Z, 0.10 * math.sin(2 * math.pi * t))
    add(p, 'tail.1', X, 1.1)
    for i in range(2, 6):
        add(p, f'tail.{i}', X, -0.25)
    tail_sway(p, t, 0.15, speed=2.0)
    return p


CLIPS = [
    ('idle', clip_idle, 90, True),
    ('walk', clip_walk, 30, True),
    ('run', clip_run, 18, True),
    ('jump', clip_jump, 12, False),
    ('fall', clip_fall, 20, True),
    ('land', clip_land, 10, False),
    ('sit', clip_sit, 90, True),
    ('meow', clip_meow, 24, False),
    ('crouch', clip_crouch, 40, True),
    ('attack', clip_attack, 18, False),
    ('victory', clip_victory, 40, True),
]


def animate(arm):
    scene = bpy.context.scene
    scene.render.fps = FPS
    poser = Poser(arm)
    ad = arm.animation_data_create()
    actions = {}
    for name, fn, frames, loop in CLIPS:
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        ad.action = act
        for f in range(frames + 1):
            t = f / frames
            poser.key(f, fn(t % 1.0 if loop else t))
        actions[name] = act
        track = ad.nla_tracks.new()
        track.name = name
        track.strips.new(name, 0, act)
        track.mute = True
    ad.action = None
    return actions


def set_pose(arm, action, frame):
    ad = arm.animation_data
    for tr in ad.nla_tracks:
        tr.mute = True
    ad.action = action
    bpy.context.scene.frame_set(frame)


def clear_pose(arm):
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()


def export(out):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    kwargs = dict(filepath=out, export_format='GLB', export_animations=True, export_skins=True, export_yup=True,
                  export_apply=False, export_cameras=False, export_lights=False, export_force_sampling=True,
                  export_animation_mode='ACTIONS')
    try:
        bpy.ops.export_scene.gltf(**kwargs, export_vertex_color='ACTIVE')
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)
    print('EXPORTED', out, os.path.getsize(out))


def run(parts, out_glb, out_renders, setup_render, render_views):
    arm = build_armature(parts)
    skin(parts, arm)
    actions = animate(arm)
    clear_pose(arm)
    export(out_glb)

    cam = setup_render()
    side = {'side': 0, 'three_quarter': -50}
    shots = [('idle', 0), ('walk', 0), ('walk', 15), ('run', 4), ('run', 13), ('jump', 5), ('jump', 11),
             ('fall', 0), ('land', 3), ('sit', 0), ('crouch', 0), ('attack', 5), ('attack', 9), ('victory', 0)]
    for name, frame in shots:
        set_pose(arm, actions[name], frame)
        if name == 'victory':
            render_views(cam, f'pose_{name}{frame:02d}', target=(0, -0.05, 0.62), dist=3.0, views={'front': -90, 'tq_right': -125})
        else:
            render_views(cam, f'pose_{name}{frame:02d}', views={'side': 0})
    clear_pose(arm)
    render_views(cam, 'shinichi_turn')
