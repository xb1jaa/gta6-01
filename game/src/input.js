// Keyboard and pointer input. Held keys are read every frame; one-shot presses
// (enter car, jump, pause, weapon switch, mute) are queued as flags and taken once
// by the loop, so a press between two frames is never lost or counted twice.

export const ACTION_ENTER = 1;
export const ACTION_JUMP = 2;
export const ACTION_PAUSE = 4;
export const ACTION_WEAPON1 = 8;
export const ACTION_WEAPON2 = 16;
export const ACTION_MUTE = 32;
export const ACTION_CONFIRM = 64;
export const ACTION_SHOOT = 128;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false, jump: false };
  let actions = 0;
  let mouseDown = false;
  let dragDX = 0;
  let dragDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    const name = KEYMAP[event.code];
    if (name) {
      if (name === 'jump') {
        if (!event.repeat) actions |= ACTION_JUMP;
      } else held[name] = true;
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'KeyE') actions |= ACTION_ENTER;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'Digit1') actions |= ACTION_WEAPON1;
    else if (event.code === 'Digit2') actions |= ACTION_WEAPON2;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'Enter') actions |= ACTION_CONFIRM;
  });
  window.addEventListener('keyup', (event) => {
    const name = KEYMAP[event.code];
    if (name && name !== 'jump') held[name] = false;
  });
  window.addEventListener('blur', () => {
    for (const key of Object.keys(held)) held[key] = false;
    mouseDown = false;
    dragging = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    // A click is a shot even if it is released before the next frame.
    actions |= ACTION_SHOOT;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
    dragging = false;
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    dragDX += event.clientX - lastX;
    dragDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });

  return {
    held,
    isMouseDown() { return mouseDown; },
    /** Pixels the pointer was dragged since the last call. */
    takeDrag() {
      const d = { x: dragDX, y: dragDY };
      dragDX = 0;
      dragDY = 0;
      return d;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
