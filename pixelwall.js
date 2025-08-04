/* pixelWall.js – temp in-memory demo */
const COLS = 100, ROWS = 60, SIZE = 6;           // tweak anytime
const wall = Array.from({ length: ROWS }, () => Array(COLS).fill("#000"));

export function addName(name) {
  // find first black pixel
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (wall[r][c] === "#000") {
        wall[r][c] = r < ROWS / 2 ? "blue" : "yellow";   // crude flag split
        animateswirl(name, r, c);
        return;
      }
    }
  }
}

function animateswirl(name, row, col) {
  const SIZE   = 6;                                    // must match wall pixel size
  const canvas = document.getElementById("wallCanvas");
  const ctx    = canvas.getContext("2d");

  /* 1️⃣  create a floating name element in the middle of the screen */
  const float = document.createElement("div");
  float.textContent = name;
  float.style = `
    position:fixed;left:50%;top:50%;translate:-50% -50%;
    font-size:4vw;font-weight:700;color:#ffd700;
    pointer-events:none;z-index:999;white-space:nowrap;
    animation: swirl 1s ease-out forwards;
  `;
  document.body.appendChild(float);

  /* 2️⃣  calculate where that pixel is on the page */
  const wallRect = canvas.getBoundingClientRect();
  const targetX  = wallRect.left + col * SIZE + SIZE / 2;
  const targetY  = wallRect.top  + row * SIZE + SIZE / 2;

  /* 3️⃣  move the element along a spiral path toward its pixel */
  const steps = 60;                       // 1 s at 60 fps
  let   i     = 0;
  (function step() {
    const t = i / steps;                  // 0 → 1
    const angle = 8 * Math.PI * t;        // 4 turns
    const radius = 200 * (1 - t);         // start wide, end 0
    const x = targetX + radius * Math.cos(angle);
    const y = targetY + radius * Math.sin(angle);
    float.style.left = x + "px";
    float.style.top  = y + "px";
    float.style.transform = `translate(-50%,-50%) scale(${1 - 0.9*t})`;
    if (++i <= steps) requestAnimationFrame(step);
    else {
      /* 4️⃣  paint the pixel and remove the floating element */
      ctx.fillStyle = wall[row][col];
      ctx.fillRect(col * SIZE, row * SIZE, SIZE, SIZE);
      document.body.removeChild(float);
    }
  })();
}
