# G2 template structure (derived from Billy dev kit)

Source: `Billy (Dev).fla` / `Billy Red Shirt.swf` (Flash CS6 export, SWF v15, AS3, 24 fps, 1 frame,
stage 52000 x 38000 twips = 2600 x 1900 px). Inspect any SWF with `npm run dump -- file.swf out.json`.

## Root timeline
One frame. Every part at every view is a separate named instance placed on the root (568 placements:
26 parts x 10 views = 260 part instances + ~300 pivot instances). SymbolClass exports one class, `joint`.

### Views (10)
`0 45 90 135 180 225 270 315 top bottom`  (suffix on instance names: `Left_forearm_270`, `Face_top`)

### Parts (26)
Head: Face, Mouth, Nose, Left_eye, Right_eye, Left_brow, Right_brow, Left_ear, Right_ear, Front_hair, Back_hair, Neck
Body: Upper_torso, Lower_torso, Left_arm, Left_forearm, Left_hand, Right_arm, Right_forearm, Right_hand
Legs: Left_thigh, Left_shank, Left_foot, Right_thigh, Right_shank, Right_foot

### Pivots
For each part+view there is a lowercase instance `<part>_<view>_pivot` using the `joint` symbol
(sprite wrapping a marker). Its placement `tx,ty` (twips) is the joint position. Extra `*_nud_*` pivots:
`head_nud`, `left_hand_nud`, `right_hand_nud`, `left_foot_nud`, `right_foot_nud`.
A "Pivots (Do Not Edit)" folder holds them in the FLA.

## Part symbol shapes
* Single-frame parts: Left/Right_arm, forearm, foot, shank, thigh, Lower/Upper_torso, Neck, ears, hair, Face.
  Sprite -> (nested shape or sprite). Left/Right variants reuse one symbol (mirrored with scaleX = -1).
* Multi-frame "expression" parts (frames carry named poses/expressions):
  Hand 11 (Relaxed, Victory, Seven, OK, One, Fist, Pat, Reach, Open, Pick, Thumb),
  Eye 13, Brow 18, Nose 8, Mouth 30.

## Open questions
* Exact pivot semantics (instance origin vs. registration inside shape) - verify by round-trip + import test.
* Whether frame labels inside expression sprites are required by Cartoon Animator or only instance names.
* Which Cartoon Animator versions need what: user tests on 4.5; target compatibility 2.x-4.x.
