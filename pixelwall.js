/* pixelWall.js – temp in-memory demo */
const COLS = 100, ROWS = 60, SIZE = 6;           // tweak anytime
const wall = Array.from({ length: ROWS }, () => Array(COLS).fill("#000"));

export function addName(name) {
  // find first black pixel
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (wall[r][c] === "#000") {
        wall[r][c] = r < ROWS / 2 ? "blue" : "yellow";   // crude flag split
        animate(name, r, c);
        return;
      }
    }
  }
}

function animate(name, row, col) {
  const can = document.getElementById("wallCanvas");
  const ctx  = can.getContext("2d");
  // 1-sec full-screen pop
  const flash = document.createElement("div");
  flash.textContent = name;
  flash.style = `position:fixed;inset:0;display:flex;justify-content:center;
                 align-items:center;font-size:5vw;background:#111;z-index:999`;
  document.body.appendChild(flash);
  setTimeout(() => {
    document.body.removeChild(flash);
    ctx.fillStyle = wall[row][col];
    ctx.fillRect(col * SIZE, row * SIZE, SIZE, SIZE);
  }, 1000);
}
