/* pixelwall.js — zoomable Ukraine-shape pixels                               */
/* ------------------------------------------------------------------------- */
const COLS = 200, ROWS = 120, SIZE = 6;        // grid 200×120 = 24 000 pixels
const wall  = Array.from({ length: ROWS }, () => Array(COLS).fill("#000"));
const names = Array.from({ length: ROWS }, () => Array(COLS).fill(""));

function flagWidth ()  { return COLS * SIZE * scale; }
function flagHeight()  { return ROWS * SIZE * scale; }

/* Ukraine silhouette path (placeholder hexagon; swap for real SVG later) */
const ukrainePath = new Path2D(
  "M26.7 4.2 30.5 5.9 33.3 9.5 35.6 13.7 35.1 17.9 32.7 21.4 27.2 23.6 25.9 28.3 22.4 31.9 17.8 33.5 11.5 33.0 8.4 30.4 5.6 26.2 3.2 21.5 3.7 17.2 6.1 13.7 7.4 9.5 11.0 6.3 15.6 4.6Z"
);

/* Pan-zoom globals */
let scale = 1;
let offsetX = 0, offsetY = 0;


export function addName(name) {
  // find first black pixel
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (wall[r][c] === "#000") {
        wall[r][c] = r < ROWS / 2 ? "blue" : "yellow";   // crude flag split
        animateswirl(name, r, c);
        names[r][c] = name; //store for zoom display
        drawWall();  //redraw whole wall
        return;
      }
    }
  }
}

function animateswirl(name, row, col) {
  const canvas = document.getElementById("wallCanvas");
  const ctx    = canvas.getContext("2d");
  const float  = document.createElement("div");
  float.textContent = name;
  float.style = `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
                 font-size:4vw;font-weight:700;color:#ffd700;pointer-events:none;
                 z-index:999;white-space:nowrap;`;
  document.body.appendChild(float);

  const rect = canvas.getBoundingClientRect();
  const targetX = rect.left + col * SIZE + SIZE / 2;
  const targetY = rect.top  + row * SIZE + SIZE / 2;

  const steps = 60;
  let i = 0;
  (function step() {
    const t      = i / steps;
    const angle  = 6 * Math.PI * t;
    const radius = 250 * (1 - t);
    const x      = targetX + radius * Math.cos(angle);
    const y      = targetY + radius * Math.sin(angle);
    float.style.left = x + "px";
    float.style.top  = y + "px";
    float.style.transform =
      `translate(-50%,-50%) scale(${1 - 0.8 * t}) rotate(${angle}rad)`;
    if (++i <= steps) requestAnimationFrame(step);
    else {                                  // land
      ctx.fillStyle = wall[row][col];
      ctx.fillRect(col * SIZE, row * SIZE, SIZE, SIZE);
      document.body.removeChild(float);
      drawWall();                           // re-draw full scene
    }
  })();
}

/* ========== Pan–Zoom Rendering ========= */
const canvas = document.getElementById("wallCanvas");
const ctx    = canvas.getContext("2d");

/* Mouse wheel zoom */
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx=(e.clientX - rect.left - offsetX) / scale;
  const my=(e.clientY - rect.top - offsetY) / scale;

  /* zoom factor & clamp */
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  /* clamp scale so it never goes below 0.5× or above 40× */
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 40;
  const newScale   = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale * zoomFactor));
  const appliedZ   = newScale / scale;   // actual factor after clamping
  scale = newScale;

  offsetX -= mx * (appliedZ - 1) * scale;
  offsetY -= my * (appliedZ - 1) * scale;

  /* --- keep within bounds --- */
const minX = Math.min(0, canvas.width  - flagWidth());
const minY = Math.min(0, canvas.height - flagHeight());
offsetX = Math.min(0, Math.max(minX, offsetX));
offsetY = Math.min(0, Math.max(minY, offsetY));

  drawWall();
});

/* Drag to pan */
let dragging=false, sx=0, sy=0;
canvas.addEventListener("pointerdown", e=>{ dragging=true; sx=e.clientX; sy=e.clientY;});
window.addEventListener("pointermove", e=>{
  if(!dragging) return;
  offsetX += e.clientX - sx; offsetY += e.clientY - sy;
  sx = e.clientX; sy = e.clientY; drawWall();
});
window.addEventListener("pointerup",   ()=> dragging=false);

/* Main painter */
function drawWall(){
  ctx.save();
  ctx.setTransform(scale,0,0,scale,offsetX,offsetY);
  ctx.clearRect(-offsetX/scale,-offsetY/scale,canvas.width/scale,canvas.height/scale);
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const color = wall[r][c]; if(color==="#000") continue;
      const x=c*SIZE, y=r*SIZE;
      ctx.save();
      ctx.translate(x,y);
      ctx.scale(SIZE/30,SIZE/30);
      ctx.fillStyle=color;
      ctx.fill(ukrainePath);
      ctx.restore();
      if(scale*SIZE>40 && names[r][c]){      // show name when zoomed
        ctx.fillStyle="#fff"; ctx.font="bold 12px Arial";
        ctx.fillText(names[r][c], x+4, y+SIZE/2+4);
      }
    }
  }
  ctx.restore();
}

/* first render */
const minX = Math.min(0, canvas.width  - flagWidth());
const minY = Math.min(0, canvas.height - flagHeight());
offsetX = Math.min(0, Math.max(minX, offsetX));
offsetY = Math.min(0, Math.max(minY, offsetY));
drawWall();


