# Sprites Cartoon Animator expects per view

Source: the "SWF Information -> Error Log" Cartoon Animator 4 showed after importing a FRONT-ONLY SWF. For every other view it
printed "Sprite name error" (the sprites it looked for and did not find) and "Pivot name error" (the matching pivots).
That list is its own spec of what each view should contain. It is also why a front-only file always shows the log:
the other views are simply absent. This is harmless, because Cartoon Animator replicates the sprites onto the other angles.

| View | Parts expected |
|------|----------------|
| 0, 45, 315 | all 26 |
| 90  | 16 body parts + Right_brow, Right_eye, Nose, Mouth, Right_ear, Front_hair, Back_hair (23) |
| 270 | 16 body parts + Left_brow, Left_eye, Nose, Mouth, Left_ear, Front_hair, Back_hair (23) |
| 135, 225, 180, top, bottom | 16 body parts + Back_hair (17) |

16 body parts = Face, Neck, Upper_torso, Lower_torso, Left/Right_arm, forearm, hand, thigh, shank, foot.
Every expected part also has a `<part>_<view>_pivot` marker (hands and feet additionally have `*_nud_*` markers).
Encoded in `src/rig/spec.js`; the exporter writes exactly these parts per view and the editor only offers these slots.
