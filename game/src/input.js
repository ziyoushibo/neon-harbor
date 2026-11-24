// Neon Harbor — keyboard + mouse input. Tracks held keys and edge presses.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    justPressed: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!input.keys.has(e.code)) input.justPressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouse.down = true;
    input.mouse.clicked = true;
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
  });
  window.addEventListener('mouseup', () => { input.mouse.down = false; });

  input.isDown = (code) => input.keys.has(code);
  input.wasPressed = (code) => input.justPressed.has(code);
  input.axis = () => {
    let x = 0, y = 0;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) y -= 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) y += 1;
    return { x, y };
  };
  input.endFrame = () => { input.justPressed.clear(); input.mouse.clicked = false; };
  return input;
}
