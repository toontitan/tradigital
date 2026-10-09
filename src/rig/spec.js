// Which parts Cartoon Animator EXPECTS in each view. Taken from the "Sprite name error" lists in CTA's own SWF import log
// (it names every sprite it looked for and did not find). Parts outside this set are not needed in that view.
// The front view is not listed in the log because it was present; it takes the full set.

const BODY = ['Face', 'Neck', 'Upper_torso', 'Lower_torso', 'Left_arm', 'Right_arm', 'Left_forearm', 'Right_forearm', 'Left_hand', 'Right_hand',
  'Left_thigh', 'Right_thigh', 'Left_shank', 'Right_shank', 'Left_foot', 'Right_foot'];
const ALL = [...BODY, 'Left_brow', 'Right_brow', 'Left_eye', 'Right_eye', 'Nose', 'Mouth', 'Left_ear', 'Right_ear', 'Front_hair', 'Back_hair'];

export const EXPECTED_PARTS = {
  0: ALL,
  45: ALL,
  315: ALL,
  90: [...BODY, 'Right_brow', 'Right_eye', 'Nose', 'Mouth', 'Right_ear', 'Front_hair', 'Back_hair'],
  270: [...BODY, 'Left_brow', 'Left_eye', 'Nose', 'Mouth', 'Left_ear', 'Front_hair', 'Back_hair'],
  135: [...BODY, 'Back_hair'],
  225: [...BODY, 'Back_hair'],
  180: [...BODY, 'Back_hair'],
  top: [...BODY, 'Back_hair'],
  bottom: [...BODY, 'Back_hair'],
};

export const expectedParts = (view) => EXPECTED_PARTS[view];
export const isExpected = (part, view) => EXPECTED_PARTS[view]?.includes(part) ?? false;
