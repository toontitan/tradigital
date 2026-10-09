# Expression sets (multi-frame parts)

Derived from Billy (`Billy Red Shirt.swf`), K1 and Mojo. Instance names are the interface Cartoon Animator maps by,
so a generated set must reproduce them exactly. Extra frames beyond the mapped ones import as unmapped sprites.

| Part (each side)      | Frames | Notes |
|-----------------------|--------|-------|
| Left/Right_eye        | 13     | nested, see below |
| Left/Right_brow       | 18     | |
| Nose                  | 8      | Dierdre uses a single `Normal` frame |
| Mouth                 | 30     | frames 1-21 expressions, 22-30 phonemes (second `Normal` starts them) |
| Left/Right_hand       | 11     | poses |

## Nesting (eye)
Each frame of an eye sprite is a named wrapper sprite containing three named children:

```
Left_eye_0              (sprite, 13 frames)
  f1  Normal_01         (wrapper, 1 frame)
        Image   depth 1   eye shape (white of the eye)
        Mask    depth 3   clipDepth 8 -> real clipping mask, clips what is above it up to depth 8
        Pupil   depth 5   sprite wrapping the pupil shape, clipped by Mask so it stays inside the eye
  f2  Exert_Close_02    (wrapper -> a single closed-lid shape)
```
Mouth frames are named wrapper sprites around one shape each (teeth / tongue are extra fills in the same shape).

## Names
eyes (13): Normal_01, Exert_Close_02, Close_03, Sad_04, Stretch_Eye_Edges_05, Scare_06, Scare_Close_07,
Angry_Exert_Close_08, Stretch_Angry_09, Angry_10, Smiley_11, Happy_12, Angry_Raise_Cheeks_13

brows (18): Normal, Shrink, Happy, Raise_Brow_and_Shrink_Nose, Lower_Brow, Lower_Brow_and_Shrink_Nose, Raise_Outer_Brow,
Raise_Outer_Brow_and_Shrink_Nose, Raise_Outer_and_Raise_Brow, Scare, Raise_Outer_and_Lower_Brow, Angry, Raise_Inner_Brow,
Raise_Inner_Brow_and_shrink_Nose, Raise_Inner_and_Raise_Brow, Raise_Inner_and_Raise_Brow_and_Shrink_Nose, Sad,
Raise_Inner_and_Lower_Brow_and_Shrink_Nose

nose (8): Normal, Angry, Raise_Nose_Flank, Shrink, Raise_Right_Nose_Flank, Raise_Right_Shrik_Nose_Flank,
Raise_Left_Nose_Flank, Raise_Left_Shrink_Nose_Flank   (sic: `Shrik`)

mouth (30): Normal, Droop_Lower_Lip, Raise_Lip_Edges, Raise_Right_Lip_Edge, Raise_Left_Lip_Edge, Stretch_Lip_Edge,
Droop_Lip_Edge, Droop_Right_Lip_Edges, Droop_Left_Lip_Edges, Raise_chin, Flat_Lip, Stretch_Lip, Funnel_Lip, Sip_Lip,
Raise_Sip_Lip, Droop_Sip_Lip, Bite_Lip, Open_Mouth, Move_Jaw_Right, Move_Jaw_Left, Turn_Jaw_Down,
Normal, Ah_I, Oh, EE, U, WOO, FV, LNDTh, CDSKZ

hands (11): Relaxed, Victory, Seven, OK, One, Fist, Pat, Reach, Open, Pick, Thumb

## Mojo (for comparison): eyes and mouth differ
Mojo's eye frames have no wrapper name and no `Mask`: frame 1 is a raw eye shape plus a named `Pupil` sprite.
Mojo's mouth frames are raw shapes with no names. Nose, brows and hands are named like Billy's.
In the Cartoon Animator calibration video the Mojo nose, brows and hands showed up and the eyes and mouth did not.
Open question: whether the missing wrapper names, the missing Mask, or both cause that (test: import Mojo.swf itself).
