// Block Arena – polished 2D Bomberman-style
// Grid physics, smooth animation, skill-based

const COLS = 15;
const ROWS = 11;
const TILE = 40;

const T = { EMPTY: 0, WALL: 1, SOFT: 2, BOMB: 3, FIRE: 4, POWER: 5 };

const COLORS = {
  floor: '#1e293b',
  floorAlt: '#243047',
  wall: '#475569',
  wallEdge: '#64748b',
  soft: '#a16207',
  softTop: '#ca8a04',
  fire: ['#fef08a', '#fb923c', '#ef4444', '#dc2626'],
  power: '#22d3ee'
};

const PLAYER_COLORS = ['#38bdf8', '#f472b6', '#4ade80', '#fbbf24', '#a78bfa'];

class Game {
  constructor() {
    this.canvas = document.getElementById('c');
    this.ctx = this.canvas.getContext('2d');
    this.running = false;
    this.grid = [];
    this.players = [];
    this.bombs = [];
    this.fires = [];
    this.powers = [];
    this.particles = [];
    this.localId = null;
    this.tick = 0;
    this.winner = null;
    this.input = { up: false, down: false, left: false, right: false, bomb: false };
    this.keys = {};
    this.aiTimer = 0;
    this.onEnd = null;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = w;
    this.canvas.height = h;
    // Fit grid centered
    const gw = COLS * TILE;
    const gh = ROWS * TILE;
    const scale = Math.min(w / (gw + 20), h / (gh + 20), 1.4);
    this.scale = scale;
    this.ox = (w - gw * scale) / 2;
    this.oy = (h - gh * scale) / 2;
  }

  start(playersData, isSolo) {
    this.isSolo = isSolo;
    this.localId = playersData.find(p => p.isLocal)?.id || playersData[0].id;
    this.grid = this._buildMap();
    this.bombs = [];
    this.fires = [];
    this.powers = [];
    this.particles = [];
    this.winner = null;
    this.tick = 0;

    // Spawn corners
    const spawns = [
      { x: 1, y: 1 },
      { x: COLS - 2, y: 1 },
      { x: 1, y: ROWS - 2 },
      { x: COLS - 2, y: ROWS - 2 },
      { x: Math.floor(COLS / 2), y: 1 }
    ];
    this.players = playersData.map((pd, i) => {
      const s = spawns[i % spawns.length];
      return {
        id: pd.id,
        name: pd.name || 'P' + (i + 1),
        x: s.x,
        y: s.y,
        px: s.x, // pixel for smooth move (in tiles)
        py: s.y,
        color: PLAYER_COLORS[i % PLAYER_COLORS.length],
        alive: true,
        bombsMax: 1,
        bombsLeft: 1,
        range: 2,
        speed: 3.2,
        isLocal: !!pd.isLocal,
        isAI: !!pd.isAI,
        dir: 0,
        anim: 0
      };
    });

    this.running = true;
    this._last = performance.now();
    this._loop();
  }

  _buildMap() {
    const g = [];
    for (let y = 0; y < ROWS; y++) {
      g[y] = [];
      for (let x = 0; x < COLS; x++) {
        if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
          g[y][x] = T.WALL;
        } else if (x % 2 === 0 && y % 2 === 0) {
          g[y][x] = T.WALL;
        } else {
          // Soft blocks, leave spawn corners clear
          const nearSpawn =
            (x <= 2 && y <= 2) ||
            (x >= COLS - 3 && y <= 2) ||
            (x <= 2 && y >= ROWS - 3) ||
            (x >= COLS - 3 && y >= ROWS - 3);
          g[y][x] = nearSpawn ? T.EMPTY : (Math.random() < 0.72 ? T.SOFT : T.EMPTY);
        }
      }
    }
    return g;
  }

  _loop = () => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this._last) / 1000, 0.05);
    this._last = now;
    this.tick += dt;
    this._update(dt);
    this._draw();
    requestAnimationFrame(this._loop);
  };

  _update(dt) {
    // Local input
    const local = this.players.find(p => p.id === this.localId);
    if (local && local.alive) {
      this._movePlayer(local, this.input, dt);
      if (this.input.bomb) {
        this._placeBomb(local);
        this.input.bomb = false;
      }
    }

    // AI
    if (this.isSolo) {
      this.aiTimer += dt;
      if (this.aiTimer > 0.12) {
        this.aiTimer = 0;
        this.players.forEach(p => {
          if (p.isAI && p.alive) this._ai(p, dt);
        });
      }
    }

    // Bombs
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.timer -= dt;
      b.pulse = Math.sin(this.tick * 10) * 0.15;
      if (b.timer <= 0) {
        this._explode(b);
        this.bombs.splice(i, 1);
      }
    }

    // Fire
    for (let i = this.fires.length - 1; i >= 0; i--) {
      this.fires[i].timer -= dt;
      if (this.fires[i].timer <= 0) this.fires.splice(i, 1);
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Fire damage
    this.players.forEach(p => {
      if (!p.alive) return;
      const tx = Math.round(p.px);
      const ty = Math.round(p.py);
      if (this.fires.some(f => f.x === tx && f.y === ty)) {
        p.alive = false;
        this._burst(p.px, p.py, p.color);
        Audio.hit();
      }
    });

    // Pick powerups
    this.players.forEach(p => {
      if (!p.alive) return;
      const tx = Math.round(p.px);
      const ty = Math.round(p.py);
      for (let i = this.powers.length - 1; i >= 0; i--) {
        const pw = this.powers[i];
        if (pw.x === tx && pw.y === ty) {
          if (pw.kind === 'bomb') p.bombsMax++;
          if (pw.kind === 'range') p.range++;
          if (pw.kind === 'speed') p.speed = Math.min(5.2, p.speed + 0.45);
          p.bombsLeft = Math.min(p.bombsLeft + (pw.kind === 'bomb' ? 1 : 0), p.bombsMax);
          this.powers.splice(i, 1);
          Audio.power();
          this._burst(tx, ty, COLORS.power);
        }
      }
    });

    // Win check
    const alive = this.players.filter(p => p.alive);
    if (alive.length <= 1 && this.players.length > 1) {
      this.winner = alive[0] || null;
      this.running = false;
      if (this.onEnd) this.onEnd(this.winner);
    }

    this._updateHUD();
  }

  _movePlayer(p, input, dt) {
    let dx = 0, dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (dx === 0 && dy === 0) return;

    // Prefer one axis if both (grid feel)
    if (dx !== 0 && dy !== 0) {
      if (Math.abs(p.px - Math.round(p.px)) > Math.abs(p.py - Math.round(p.py))) dy = 0;
      else dx = 0;
    }

    const speed = p.speed * dt;
    const nx = p.px + dx * speed;
    const ny = p.py + dy * speed;

    if (this._canWalk(nx, p.py, p)) p.px = nx;
    if (this._canWalk(p.px, ny, p)) p.py = ny;

    // Snap when close to center for clean grid feel
    if (dx === 0 && Math.abs(p.px - Math.round(p.px)) < 0.08) p.px = Math.round(p.px);
    if (dy === 0 && Math.abs(p.py - Math.round(p.py)) < 0.08) p.py = Math.round(p.py);

    p.x = Math.round(p.px);
    p.y = Math.round(p.py);
    p.anim += dt * 8;
    if (dx > 0) p.dir = 1;
    else if (dx < 0) p.dir = 3;
    else if (dy > 0) p.dir = 2;
    else if (dy < 0) p.dir = 0;
  }

  _canWalk(px, py, p) {
    // Check four corners of player hitbox (0.7 tile)
    const r = 0.38;
    const points = [
      [px - r, py - r], [px + r, py - r],
      [px - r, py + r], [px + r, py + r]
    ];
    for (const [x, y] of points) {
      const tx = Math.floor(x + 0.001);
      const ty = Math.floor(y + 0.001);
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
      const cell = this.grid[ty][tx];
      if (cell === T.WALL || cell === T.SOFT) return false;
      // Bomb solid except own bomb you just placed (allow leave)
      if (this.bombs.some(b => b.x === tx && b.y === ty && !(b.owner === p.id && b.timer > 2.3))) return false;
    }
    return true;
  }

  _placeBomb(p) {
    if (p.bombsLeft <= 0 || !p.alive) return;
    const x = Math.round(p.px);
    const y = Math.round(p.py);
    if (this.bombs.some(b => b.x === x && b.y === y)) return;
    this.bombs.push({
      x, y,
      timer: 2.6,
      range: p.range,
      owner: p.id,
      pulse: 0
    });
    p.bombsLeft--;
    Audio.bomb();
  }

  _explode(b) {
    const owner = this.players.find(p => p.id === b.owner);
    if (owner) owner.bombsLeft = Math.min(owner.bombsLeft + 1, owner.bombsMax);

    const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    Audio.explode();

    dirs.forEach(([dx, dy], idx) => {
      const maxR = idx === 0 ? 0 : b.range;
      for (let r = 0; r <= maxR; r++) {
        const x = b.x + dx * r;
        const y = b.y + dy * r;
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) break;
        if (this.grid[y][x] === T.WALL) break;

        this.fires.push({ x, y, timer: 0.45 });
        this._burst(x, y, '#fb923c');

        if (this.grid[y][x] === T.SOFT) {
          this.grid[y][x] = T.EMPTY;
          // Power chance
          if (Math.random() < 0.32) {
            const kinds = ['bomb', 'range', 'speed'];
            this.powers.push({ x, y, kind: kinds[Math.floor(Math.random() * 3)], bob: 0 });
          }
          break;
        }
        // Chain bombs
        const other = this.bombs.find(o => o.x === x && o.y === y && o !== b);
        if (other) other.timer = 0;
      }
    });
  }

  _burst(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4;
      this.particles.push({
        x: x + 0.5, y: y + 0.5,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.3,
        color
      });
    }
  }

  _ai(p, dt) {
    // Simple but decent: place bomb near soft / avoid fire / chase
    const input = { up: false, down: false, left: false, right: false, bomb: false };
    const danger = (x, y) => this.fires.some(f => f.x === x && f.y === y) ||
      this.bombs.some(b => {
        if (Math.abs(b.x - x) + Math.abs(b.y - y) > b.range) return false;
        return (b.x === x || b.y === y);
      });

    // Flee danger
    if (danger(Math.round(p.px), Math.round(p.py))) {
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of opts.sort(() => Math.random() - 0.5)) {
        const nx = Math.round(p.px) + dx;
        const ny = Math.round(p.py) + dy;
        if (this._canWalk(nx, ny, p) && !danger(nx, ny)) {
          if (dx > 0) input.right = true;
          if (dx < 0) input.left = true;
          if (dy > 0) input.down = true;
          if (dy < 0) input.up = true;
          break;
        }
      }
    } else {
      // Random roam + bomb soft blocks
      if (Math.random() < 0.04) input.bomb = true;
      const r = Math.random();
      if (r < 0.25) input.left = true;
      else if (r < 0.5) input.right = true;
      else if (r < 0.75) input.up = true;
      else input.down = true;
    }
    this._movePlayer(p, input, 0.12);
    if (input.bomb) this._placeBomb(p);
  }

  _updateHUD() {
    const left = document.getElementById('hud-left');
    const right = document.getElementById('hud-right');
    if (!left) return;
    left.innerHTML = this.players.map(p => {
      const icon = p.alive ? '●' : '✗';
      return `<span style="color:${p.color}">${icon} ${p.name}</span>`;
    }).join(' &nbsp; ');
    const local = this.players.find(p => p.id === this.localId);
    if (local && right) {
      right.textContent = `💣${local.bombsLeft}/${local.bombsMax}  🔥${local.range}  ⚡${local.speed.toFixed(1)}`;
    }
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = '#0c1222';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.scale, this.scale);

    // Tiles
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = this.grid[y][x];
        const px = x * TILE;
        const py = y * TILE;
        // Floor
        ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.floor : COLORS.floorAlt;
        ctx.fillRect(px, py, TILE, TILE);

        if (cell === T.WALL) {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = COLORS.wallEdge;
          ctx.fillRect(px + 2, py + 2, TILE - 4, 5);
        } else if (cell === T.SOFT) {
          ctx.fillStyle = COLORS.soft;
          ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = COLORS.softTop;
          ctx.fillRect(px + 3, py + 3, TILE - 6, 6);
          // Crate lines
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.strokeRect(px + 8, py + 8, TILE - 16, TILE - 16);
        }
      }
    }

    // Powers
    this.powers.forEach(pw => {
      const t = this.tick * 4;
      const bob = Math.sin(t + pw.x) * 3;
      ctx.fillStyle = COLORS.power;
      ctx.beginPath();
      ctx.arc(pw.x * TILE + TILE / 2, pw.y * TILE + TILE / 2 + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0c1222';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon = pw.kind === 'bomb' ? 'B' : pw.kind === 'range' ? 'R' : 'S';
      ctx.fillText(icon, pw.x * TILE + TILE / 2, pw.y * TILE + TILE / 2 + bob);
    });

    // Bombs
    this.bombs.forEach(b => {
      const s = 1 + b.pulse;
      const cx = b.x * TILE + TILE / 2;
      const cy = b.y * TILE + TILE / 2;
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.arc(cx, cy, 14 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#312e81';
      ctx.beginPath();
      ctx.arc(cx - 3, cy - 3, 5 * s, 0, Math.PI * 2);
      ctx.fill();
      // Fuse spark
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(cx + 8, cy - 12, 3, 6);
    });

    // Fire
    this.fires.forEach(f => {
      const flicker = 0.7 + Math.random() * 0.3;
      ctx.fillStyle = COLORS.fire[Math.floor(Math.random() * COLORS.fire.length)];
      ctx.globalAlpha = flicker;
      ctx.fillRect(f.x * TILE + 4, f.y * TILE + 4, TILE - 8, TILE - 8);
      ctx.globalAlpha = 1;
    });

    // Particles
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x * TILE - 2, p.y * TILE - 2, 4, 4);
      ctx.globalAlpha = 1;
    });

    // Players
    this.players.forEach(p => {
      if (!p.alive) return;
      const cx = p.px * TILE + TILE / 2;
      const cy = p.py * TILE + TILE / 2;
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 12, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 13, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#0c1222';
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 4, 2.5, 0, Math.PI * 2);
      ctx.arc(cx + 4, cy - 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Name
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name.slice(0, 8), cx, cy - 20);
    });

    ctx.restore();
  }

  setInput(key, val) {
    if (key in this.input) this.input[key] = val;
  }

  stop() {
    this.running = false;
  }
}

const game = new Game();
