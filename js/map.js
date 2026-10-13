// Grid map: 0 empty, 1 solid wall, 2 soft block, 3 spawn
const COLS = 15;
const ROWS = 13;
const TILE = 40;

function createMap() {
  const grid = [];
  for (let y = 0; y < ROWS; y++) {
    grid[y] = [];
    for (let x = 0; x < COLS; x++) {
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
        grid[y][x] = 1; // border
      } else if (x % 2 === 0 && y % 2 === 0) {
        grid[y][x] = 1; // pillars
      } else {
        // soft blocks with safe corners
        const corner =
          (x <= 2 && y <= 2) || (x >= COLS - 3 && y <= 2) ||
          (x <= 2 && y >= ROWS - 3) || (x >= COLS - 3 && y >= ROWS - 3);
        grid[y][x] = corner ? 0 : (Math.random() < 0.72 ? 2 : 0);
      }
    }
  }
  return grid;
}

const SPAWNS = [
  { x: 1, y: 1 },
  { x: COLS - 2, y: 1 },
  { x: 1, y: ROWS - 2 },
  { x: COLS - 2, y: ROWS - 2 }
];

function tileAt(grid, tx, ty) {
  if (ty < 0 || ty >= ROWS || tx < 0 || tx >= COLS) return 1;
  return grid[ty][tx];
}

function isSolid(grid, tx, ty) {
  const t = tileAt(grid, tx, ty);
  return t === 1 || t === 2;
}
