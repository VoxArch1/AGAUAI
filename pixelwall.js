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
