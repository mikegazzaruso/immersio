import { InputActions, DEADZONE_STICK, DEADZONE_SNAP } from './InputActions.js';

export class InputManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.state = {
      [InputActions.MOVE_X]: 0,
      [InputActions.MOVE_Y]: 0,
      [InputActions.TURN_X]: 0,
      [InputActions.TRIGGER_LEFT]: 0,
      [InputActions.TRIGGER_RIGHT]: 0,
      [InputActions.GRIP_LEFT]: 0,
      [InputActions.GRIP_RIGHT]: 0,
    };
    this._prevTriggerLeft = false;
    this._prevTriggerRight = false;
    this._prevGripLeft = false;
    this._prevGripRight = false;
    this._prevBRight = false;
    this._prevARight = false;
  }

  update(xrSession) {
    if (!xrSession) return;

    const sources = xrSession.inputSources;
    if (!sources) return;

    let leftAxes = null;
    let rightAxes = null;
    let leftButtons = null;
    let rightButtons = null;

    for (const source of sources) {
      if (!source.gamepad) continue;
      if (source.handedness === 'left') {
        leftAxes = source.gamepad.axes;
        leftButtons = source.gamepad.buttons;
      } else if (source.handedness === 'right') {
        rightAxes = source.gamepad.axes;
        rightButtons = source.gamepad.buttons;
      }
    }

    // Left stick: movement (axes 2,3 for Quest Touch)
    if (leftAxes && leftAxes.length >= 4) {
      const x = Math.abs(leftAxes[2]) > DEADZONE_STICK ? leftAxes[2] : 0;
      const y = Math.abs(leftAxes[3]) > DEADZONE_STICK ? leftAxes[3] : 0;
      this.state[InputActions.MOVE_X] = x;
      this.state[InputActions.MOVE_Y] = y;
    } else {
      this.state[InputActions.MOVE_X] = 0;
      this.state[InputActions.MOVE_Y] = 0;
    }

    // Right stick: snap turn (axis 2)
    if (rightAxes && rightAxes.length >= 4) {
      this.state[InputActions.TURN_X] = Math.abs(rightAxes[2]) > DEADZONE_SNAP ? rightAxes[2] : 0;
    } else {
      this.state[InputActions.TURN_X] = 0;
    }

    // Buttons
    const trigLeft = leftButtons && leftButtons[0] ? leftButtons[0].value : 0;
    const trigRight = rightButtons && rightButtons[0] ? rightButtons[0].value : 0;
    const gripLeft = leftButtons && leftButtons[1] ? leftButtons[1].value : 0;
    const gripRight = rightButtons && rightButtons[1] ? rightButtons[1].value : 0;

    this.state[InputActions.TRIGGER_LEFT] = trigLeft;
    this.state[InputActions.TRIGGER_RIGHT] = trigRight;
    this.state[InputActions.GRIP_LEFT] = gripLeft;
    this.state[InputActions.GRIP_RIGHT] = gripRight;

    // Edge detection for trigger/grip down/up events
    const trigLeftDown = trigLeft > 0.5;
    const trigRightDown = trigRight > 0.5;
    const gripLeftDown = gripLeft > 0.5;
    const gripRightDown = gripRight > 0.5;

    if (trigLeftDown && !this._prevTriggerLeft) this.eventBus.emit(InputActions.TRIGGER_LEFT_DOWN);
    if (!trigLeftDown && this._prevTriggerLeft) this.eventBus.emit(InputActions.TRIGGER_LEFT_UP);
    if (trigRightDown && !this._prevTriggerRight) this.eventBus.emit(InputActions.TRIGGER_RIGHT_DOWN);
    if (!trigRightDown && this._prevTriggerRight) this.eventBus.emit(InputActions.TRIGGER_RIGHT_UP);
    if (gripLeftDown && !this._prevGripLeft) this.eventBus.emit(InputActions.GRIP_LEFT_DOWN);
    if (!gripLeftDown && this._prevGripLeft) this.eventBus.emit(InputActions.GRIP_LEFT_UP);
    if (gripRightDown && !this._prevGripRight) this.eventBus.emit(InputActions.GRIP_RIGHT_DOWN);
    if (!gripRightDown && this._prevGripRight) this.eventBus.emit(InputActions.GRIP_RIGHT_UP);

    this._prevTriggerLeft = trigLeftDown;
    this._prevTriggerRight = trigRightDown;
    this._prevGripLeft = gripLeftDown;
    this._prevGripRight = gripRightDown;

    // A button on right controller (buttons[4])
    const aRight = rightButtons && rightButtons.length > 4 && rightButtons[4] ? rightButtons[4].pressed : false;
    if (aRight && !this._prevARight) this.eventBus.emit(InputActions.A_RIGHT_DOWN);
    if (!aRight && this._prevARight) this.eventBus.emit(InputActions.A_RIGHT_UP);
    this._prevARight = aRight;

    // B button on right controller (buttons[5])
    const bRight = rightButtons && rightButtons.length > 5 && rightButtons[5] ? rightButtons[5].pressed : false;
    if (bRight && !this._prevBRight) this.eventBus.emit(InputActions.B_RIGHT_DOWN);
    if (!bRight && this._prevBRight) this.eventBus.emit(InputActions.B_RIGHT_UP);
    this._prevBRight = bRight;
  }

  get(action) {
    return this.state[action] || 0;
  }
}
