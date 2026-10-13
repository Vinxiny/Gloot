(function () {
  const $ = id => document.getElementById(id);
  const show = el => {
    ['loading', 'menu', 'lobby', 'game-wrap'].forEach(id => {
      const n = $(id);
      if (n) n.classList.add('hidden');
    });
    if (el) el.classList.remove('hidden');
  };

  // Loading
  let p = 0;
  const bar = $('load-fill');
  const iv = setInterval(() => {
    p += 12;
    if (bar) bar.style.width = Math.min(p, 100) + '%';
    if (p >= 100) {
      clearInterval(iv);
      show($('menu'));
    }
  }, 40);

  function chips() {
    const box = $('player-chips');
    if (!box) return;
    box.innerHTML = '';
    Net.players.forEach(p => {
      const d = document.createElement('div');
      d.className = 'chip' + (p.ready ? ' ready' : '') + (p.id === Net.localId ? ' me' : '');
      d.textContent = p.name + (p.ready ? ' ✓' : '');
      box.appendChild(d);
    });
  }
  Net.onUpdate = chips;

  $('btn-solo').onclick = () => {
    Audio.click();
    Net.solo();
    // Add AI opponents
    const data = [
      { id: Net.localId, name: $('name-input')?.value || 'You', isLocal: true },
      { id: 'ai1', name: 'Bot Rex', isAI: true },
      { id: 'ai2', name: 'Bot Kai', isAI: true },
      { id: 'ai3', name: 'Bot Nova', isAI: true }
    ];
    show($('game-wrap'));
    $('result').classList.add('hidden');
    game.onEnd = (winner) => {
      $('result').classList.remove('hidden');
      const title = $('result-title');
      if (winner && winner.id === Net.localId) {
        title.textContent = 'YOU WIN!';
        title.className = 'win';
        Audio.win();
      } else {
        title.textContent = winner ? winner.name + ' WINS' : 'DRAW';
        title.className = 'lose';
      }
      $('result-sub').textContent = 'Skill wins. Play again?';
    };
    game.start(data, true);
  };

  $('btn-host').onclick = async () => {
    Audio.click();
    const code = await Net.host();
    $('room-code').textContent = code;
    $('lobby-status').textContent = 'Share this code — friends type it to join';
    $('join-box').classList.add('hidden');
    $('btn-start').classList.remove('hidden');
    show($('lobby'));
    chips();
  };

  $('btn-join').onclick = () => {
    Audio.click();
    $('room-code').textContent = 'JOIN';
    $('lobby-status').textContent = 'Enter the host code below';
    $('join-box').classList.remove('hidden');
    $('btn-start').classList.add('hidden');
    show($('lobby'));
  };

  $('btn-do-join').onclick = async () => {
    const code = ($('join-code').value || '').trim();
    if (code.length < 4) return;
    $('lobby-status').textContent = 'Connecting...';
    const ok = await Net.join(code);
    if (ok) {
      $('room-code').textContent = code.toUpperCase();
      $('lobby-status').textContent = 'Connected! Enter name & Ready';
      chips();
      Audio.win();
    } else {
      $('lobby-status').textContent = 'Failed — check code & connection';
    }
  };

  $('btn-ready').onclick = () => {
    Audio.click();
    const name = ($('name-input').value || 'Player').slice(0, 10);
    Net.setReady(name);
    chips();
  };

  $('btn-start').onclick = () => {
    if (!Net.isHost) return;
    Audio.click();
    const list = Net.players.map(p => ({
      id: p.id,
      name: p.name,
      isLocal: p.id === Net.localId
    }));
    // Pad with AI if alone
    while (list.length < 2) {
      list.push({ id: 'ai' + list.length, name: 'Bot', isAI: true });
    }
    Net.startMatch(list);
    begin(list);
  };

  Net.onStart = (players) => begin(players);

  function begin(list) {
    list = list.map(p => ({
      ...p,
      isLocal: p.id === Net.localId,
      isAI: !!p.isAI
    }));
    show($('game-wrap'));
    $('result').classList.add('hidden');
    game.onEnd = (winner) => {
      $('result').classList.remove('hidden');
      const title = $('result-title');
      if (winner && winner.id === Net.localId) {
        title.textContent = 'YOU WIN!';
        title.className = 'win';
        Audio.win();
      } else {
        title.textContent = winner ? winner.name + ' WINS' : 'DRAW';
        title.className = 'lose';
      }
      $('result-sub').textContent = '';
    };
    game.start(list, list.some(p => p.isAI));
  }

  $('btn-again').onclick = () => {
    Audio.click();
    show($('menu'));
    game.stop();
  };
  $('btn-menu').onclick = () => {
    show($('menu'));
    game.stop();
  };

  // Keyboard
  const map = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'bomb', KeyE: 'bomb'
  };
  window.addEventListener('keydown', e => {
    const k = map[e.code];
    if (k) { e.preventDefault(); game.setInput(k, true); }
  });
  window.addEventListener('keyup', e => {
    const k = map[e.code];
    if (k) game.setInput(k, false);
  });

  // Mobile dpad
  document.querySelectorAll('#dpad button').forEach(btn => {
    const dir = btn.dataset.dir;
    const on = e => { e.preventDefault(); game.setInput(dir, true); };
    const off = e => { e.preventDefault(); game.setInput(dir, false); };
    btn.addEventListener('touchstart', on, { passive: false });
    btn.addEventListener('touchend', off, { passive: false });
    btn.addEventListener('mousedown', on);
    btn.addEventListener('mouseup', off);
  });
  const bombBtn = $('btn-bomb');
  if (bombBtn) {
    bombBtn.addEventListener('touchstart', e => { e.preventDefault(); game.setInput('bomb', true); }, { passive: false });
    bombBtn.addEventListener('click', () => game.setInput('bomb', true));
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
