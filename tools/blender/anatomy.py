"""
Shinichi's anatomy, shared by the model (build_shinichi.py) and the rig (build_rig.py).
Blender space: Z up, the cat faces -Y, paws rest on z = 0. Meters.

Proportions follow character sheet 13: a big round head (~40% of the height),
a compact fluffy body and short, sturdy legs with big round paws.
"""
from mathutils import Vector

HEAD = Vector((0, -0.25, 0.68))
NECK = Vector((0, -0.17, 0.47))
CHEST = Vector((0, -0.07, 0.33))
HIPS = Vector((0, 0.13, 0.32))

FX = 0.100  # front legs, x offset
HX = 0.110  # hind legs, x offset

# leg joints (x is multiplied by the side: +1 = left (+X), -1 = right)
FRONT = dict(shoulder=(FX, -0.10, 0.30), elbow=(FX, -0.13, 0.20), wrist=(FX, -0.15, 0.075), toe=(FX, -0.20, 0.03))
HIND = dict(hip=(HX, 0.16, 0.30), knee=(HX, 0.13, 0.16), hock=(HX, 0.22, 0.085), toe=(HX, 0.17, 0.03))
WRIST_Z = 0.095
HOCK_BAND_Z = 0.11

TAIL = [(0, 0.27, 0.36), (0, 0.38, 0.40), (0, 0.46, 0.50), (0, 0.50, 0.64), (0, 0.48, 0.78), (0, 0.42, 0.88)]
TAIL_R = [0.046, 0.043, 0.041, 0.039, 0.038, 0.035]


def side(v, s):
    return Vector((v[0] * s, v[1], v[2]))
