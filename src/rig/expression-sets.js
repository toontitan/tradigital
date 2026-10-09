// Canonical frame names for the multi-frame parts. Cartoon Animator maps expression frames by these exact
// instance names, including the original template's misspellings (e.g. `Shrik`) - do not "fix" them silently.
// See docs/expression-sets.md.

export const EYE_FRAMES = ['Normal_01', 'Exert_Close_02', 'Close_03', 'Sad_04', 'Stretch_Eye_Edges_05', 'Scare_06', 'Scare_Close_07',
  'Angry_Exert_Close_08', 'Stretch_Angry_09', 'Angry_10', 'Smiley_11', 'Happy_12', 'Angry_Raise_Cheeks_13'];

export const BROW_FRAMES = ['Normal', 'Shrink', 'Happy', 'Raise_Brow_and_Shrink_Nose', 'Lower_Brow', 'Lower_Brow_and_Shrink_Nose',
  'Raise_Outer_Brow', 'Raise_Outer_Brow_and_Shrink_Nose', 'Raise_Outer_and_Raise_Brow', 'Scare', 'Raise_Outer_and_Lower_Brow', 'Angry',
  'Raise_Inner_Brow', 'Raise_Inner_Brow_and_shrink_Nose', 'Raise_Inner_and_Raise_Brow', 'Raise_Inner_and_Raise_Brow_and_Shrink_Nose', 'Sad',
  'Raise_Inner_and_Lower_Brow_and_Shrink_Nose'];

export const NOSE_FRAMES = ['Normal', 'Angry', 'Raise_Nose_Flank', 'Shrink', 'Raise_Right_Nose_Flank', 'Raise_Right_Shrik_Nose_Flank',
  'Raise_Left_Nose_Flank', 'Raise_Left_Shrink_Nose_Flank'];

export const MOUTH_FRAMES = ['Normal', 'Droop_Lower_Lip', 'Raise_Lip_Edges', 'Raise_Right_Lip_Edge', 'Raise_Left_Lip_Edge', 'Stretch_Lip_Edge',
  'Droop_Lip_Edge', 'Droop_Right_Lip_Edges', 'Droop_Left_Lip_Edges', 'Raise_chin', 'Flat_Lip', 'Stretch_Lip', 'Funnel_Lip', 'Sip_Lip',
  'Raise_Sip_Lip', 'Droop_Sip_Lip', 'Bite_Lip', 'Open_Mouth', 'Move_Jaw_Right', 'Move_Jaw_Left', 'Turn_Jaw_Down',
  // frames 22-30: phonemes for lip-sync (the second `Normal` starts them)
  'Normal', 'Ah_I', 'Oh', 'EE', 'U', 'WOO', 'FV', 'LNDTh', 'CDSKZ'];

export const HAND_FRAMES = ['Relaxed', 'Victory', 'Seven', 'OK', 'One', 'Fist', 'Pat', 'Reach', 'Open', 'Pick', 'Thumb'];

export const SETS = { eye: EYE_FRAMES, brow: BROW_FRAMES, nose: NOSE_FRAMES, mouth: MOUTH_FRAMES, hand: HAND_FRAMES };

export const SET_OF_PART = {
  Left_eye: 'eye', Right_eye: 'eye', Left_brow: 'brow', Right_brow: 'brow', Nose: 'nose', Mouth: 'mouth', Left_hand: 'hand', Right_hand: 'hand',
};

// Mouth openness/width per frame for the generic placeholder drawing (0 = closed line).
export const MOUTH_SHAPE = {
  Open_Mouth: [0.9, 1], Ah_I: [0.8, 1], Oh: [0.65, 0.55], EE: [0.3, 1], U: [0.5, 0.45], WOO: [0.45, 0.4], FV: [0.15, 0.9], LNDTh: [0.25, 0.9],
  CDSKZ: [0.2, 0.9], Turn_Jaw_Down: [0.6, 0.9], Funnel_Lip: [0.5, 0.5], Stretch_Lip: [0.12, 1.05],
};
export const CLOSED_EYES = new Set(['Exert_Close_02', 'Close_03', 'Scare_Close_07', 'Angry_Exert_Close_08']);
