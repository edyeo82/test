(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const startButton = document.getElementById('startButton');
  const fullscreenButton = document.getElementById('fullscreenButton');
  const padStatus = document.getElementById('padStatus');
  const tips = document.getElementById('tips');

  const W = canvas.width, H = canvas.height, TILE = 32, MW = 58, MH = 58;
  const WALL = 0, FLOOR = 1, CRATE = 2, EXIT = 3, SPIKE = 4, GEM = 5, POTION = 6;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  let keys = new Set(), mouse = { x: W / 2, y: H / 2, down: false };
  let prevButtons = [], last = 0;
  const game = {
    state: 'menu', level: 1, map: [], rooms: [], enemies: [], shots: [], bits: [], float: [],
    player: null, cam: { x: 0, y: 0 }, gems: 0, kills: 0,
    best: Number(localStorage.getItem('bdcHighGems') || 0), exitOpen: false, msg: 'Find the Gatekeeper.', msgT: 4
  };

  function tileAt(x, y) { return game.map[Math.floor(y / TILE)]?.[Math.floor(x / TILE)] ?? WALL; }
  function setTile(x, y, t) { if (game.map[y]) game.map[y][x] = t; }
  function solidAt(x, y) { const t = tileAt(x, y); return t === WALL || t === CRATE; }
  function canMove(x, y, r = 11) { return !solidAt(x-r,y-r) && !solidAt(x+r,y-r) && !solidAt(x-r,y+r) && !solidAt(x+r,y+r); }
  function moveEnt(e, dx, dy) { if (canMove(e.x + dx, e.y, e.r || 11)) e.x += dx; if (canMove(e.x, e.y + dy, e.r || 11)) e.y += dy; }

  function carveRoom(r) { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) setTile(x, y, FLOOR); }
  function carveLine(a, b) {
    let x = a.cx, y = a.cy;
    while (x !== b.cx) { setTile(x, y, FLOOR); x += Math.sign(b.cx - x); }
    while (y !== b.cy) { setTile(x, y, FLOOR); y += Math.sign(b.cy - y); }
  }
  function roomOk(r) { return game.rooms.every(o => r.x + r.w + 1 < o.x || o.x + o.w + 1 < r.x || r.y + r.h + 1 < o.y || o.y + o.h + 1 < r.y); }
  function freeTiles() {
    const out = [];
    for (let y = 2; y < MH - 2; y++) for (let x = 2; x < MW - 2; x++) if (game.map[y][x] === FLOOR) out.push({ x, y });
    return out;
  }
  function spawnFloat(text, x, y, color = '#fff') { game.float.push({ text, x, y, color, life: 0.9 }); }
  function burst(x, y, color, n = 8) { for (let i = 0; i < n; i++) game.bits.push({ x, y, vx: (Math.random()-.5)*170, vy:(Math.random()-.5)*170, life:rnd(25,55)/100, color }); }

  function newGame() {
    game.map = Array.from({ length: MH }, () => Array(MW).fill(WALL));
    game.rooms = []; game.enemies = []; game.shots = []; game.bits = []; game.float = [];
    game.gems = 0; game.kills = 0; game.exitOpen = false; game.msg = 'Find the Gatekeeper.'; game.msgT = 4;
    for (let i = 0; i < 90; i++) {
      const r = { x:rnd(2, MW-12), y:rnd(2, MH-12), w:rnd(5,10), h:rnd(5,9) };
      r.cx = Math.floor(r.x + r.w/2); r.cy = Math.floor(r.y + r.h/2);
      if (roomOk(r)) { game.rooms.push(r); carveRoom(r); if (game.rooms.length > 1) carveLine(game.rooms.at(-2), r); }
      if (game.rooms.length >= 14) break;
    }
    const first = game.rooms[0], lastRoom = game.rooms.at(-1);
    game.player = { x:first.cx*TILE+16, y:first.cy*TILE+16, r:12, hp:100, maxHp:100, dir:0, inv:0, dash:0, atk:0, cd:0, speed:145 };
    setTile(lastRoom.cx, lastRoom.cy, EXIT);
    const tiles = freeTiles().filter(t => Math.hypot(t.x-first.cx,t.y-first.cy)>8);
    const place = (kind, count) => { for (let i=0;i<count && tiles.length;i++) { const n=rnd(0,tiles.length-1), t=tiles.splice(n,1)[0]; setTile(t.x,t.y,kind); } };
    place(CRATE, 42); place(GEM, 34); place(POTION, 10); place(SPIKE, 18);
    for (let i = 1; i < game.rooms.length - 1; i++) {
      const r = game.rooms[i], count = rnd(1,3);
      for (let j=0;j<count;j++) spawnEnemy(r.cx*TILE+rnd(-70,70), r.cy*TILE+rnd(-55,55), ['slime','skeleton','brute'][rnd(0,2)]);
    }
    spawnEnemy(lastRoom.cx*TILE+60, lastRoom.cy*TILE+30, 'boss');
    game.state = 'play'; hideOverlay();
  }

  function spawnEnemy(x, y, type) {
    const cfg = {
      slime: { hp:24, speed:62, r:12, color:'#63e66b', atk:14 },
      skeleton: { hp:30, speed:48, r:12, color:'#d5dce7', atk:10, shoot:1.8 },
      brute: { hp:58, speed:42, r:16, color:'#d783ff', atk:22 },
      boss: { hp:210, speed:35, r:26, color:'#ffb84d', atk:30, shoot:1.2 }
    }[type];
    game.enemies.push({ x, y, type, ...cfg, maxHp:cfg.hp, hurt:0, cd:0 });
  }

  function showOverlay(title, text, button='Start dungeon') {
    overlay.classList.add('show');
    overlay.querySelector('h2').textContent = title;
    overlay.querySelector('p').textContent = text;
    startButton.textContent = button;
  }
  function hideOverlay() { overlay.classList.remove('show'); }

  function pressedPad(i) { return (navigator.getGamepads?.()[0]?.buttons[i]?.pressed) || false; }
  function justPressed(i) { const now = pressedPad(i); const old = prevButtons[i]; prevButtons[i] = now; return now && !old; }
  function input() {
    let x = (keys.has('ArrowRight')||keys.has('KeyD')) - (keys.has('ArrowLeft')||keys.has('KeyA'));
    let y = (keys.has('ArrowDown')||keys.has('KeyS')) - (keys.has('ArrowUp')||keys.has('KeyW'));
    let attack = keys.has('Space') || mouse.down, dash = keys.has('ShiftLeft') || keys.has('ShiftRight'), pause = keys.has('Escape') || keys.has('KeyP');
    const pad = [...(navigator.getGamepads?.() || [])].find(Boolean);
    if (pad) {
      padStatus.textContent = `Joypad: ${pad.id.split('(')[0].trim()}`;
      const ax = Math.abs(pad.axes[0]) > 0.18 ? pad.axes[0] : 0, ay = Math.abs(pad.axes[1]) > 0.18 ? pad.axes[1] : 0;
      x += ax + (pad.buttons[15]?.pressed?1:0) - (pad.buttons[14]?.pressed?1:0);
      y += ay + (pad.buttons[13]?.pressed?1:0) - (pad.buttons[12]?.pressed?1:0);
      attack ||= justPressed(0) || justPressed(2) || pad.buttons[7]?.pressed;
      dash ||= justPressed(1) || justPressed(5);
      pause ||= justPressed(9);
    } else padStatus.textContent = 'Joypad: press any controller button';
    return { x: clamp(x,-1,1), y: clamp(y,-1,1), attack, dash, pause };
  }

  function attack() {
    const p = game.player; if (p.cd > 0) return;
    p.atk = 0.16; p.cd = 0.35; burst(p.x + Math.cos(p.dir)*24, p.y + Math.sin(p.dir)*24, '#fff1a8', 5);
    for (const e of game.enemies) {
      if (dist(p, e) < 46 + e.r) { e.hp -= 26; e.hurt = .18; burst(e.x, e.y, '#ff6961', 8); spawnFloat('-26', e.x, e.y - 20, '#ffb3ad'); }
    }
    const tx = Math.floor((p.x + Math.cos(p.dir)*35) / TILE), ty = Math.floor((p.y + Math.sin(p.dir)*35) / TILE);
    if (game.map[ty]?.[tx] === CRATE) { setTile(tx,ty, Math.random()<.45?GEM:FLOOR); burst(tx*TILE+16, ty*TILE+16, '#a87946', 10); }
  }

  function hurt(dmg) {
    const p = game.player; if (p.inv > 0) return;
    p.hp = Math.max(0, p.hp - dmg); p.inv = .7; burst(p.x, p.y, '#ff7b72', 10); spawnFloat('-'+dmg, p.x, p.y-26, '#ff7b72');
    if (p.hp <= 0) { game.state='dead'; showOverlay('Dungeon lost', `You collected ${game.gems} gems. Press Start or click to try again.`, 'Restart'); }
  }

  function collectTile() {
    const p = game.player, tx = Math.floor(p.x/TILE), ty = Math.floor(p.y/TILE), t = game.map[ty]?.[tx];
    if (t === GEM) { setTile(tx,ty,FLOOR); game.gems++; game.best = Math.max(game.best, game.gems); localStorage.setItem('bdcHighGems', game.best); spawnFloat('+1 gem', p.x, p.y-20, '#7ee787'); }
    if (t === POTION) { setTile(tx,ty,FLOOR); p.hp = Math.min(p.maxHp, p.hp + 32); spawnFloat('+HP', p.x, p.y-20, '#58a6ff'); }
    if (t === SPIKE && p.inv <= 0) hurt(8);
    if (t === EXIT) {
      if (game.exitOpen) { game.state='win'; showOverlay('Dungeon cleared!', `Boss defeated. Gems: ${game.gems}. Best: ${game.best}.`, 'Play again'); }
      else { game.msg = 'The exit is sealed. Defeat the Gatekeeper.'; game.msgT = 2.5; }
    }
  }

  function update(dt) {
    if (game.state !== 'play') return;
    const p = game.player, inpt = input();
    if (inpt.pause) { game.state='pause'; showOverlay('Paused', 'Press Start, Esc, or the button below to resume.', 'Resume'); return; }
    if (inpt.x || inpt.y) p.dir = Math.atan2(inpt.y, inpt.x);
    if (inpt.dash && p.dash <= 0) { p.dash = .75; p.inv = Math.max(p.inv, .28); }
    const mag = Math.hypot(inpt.x, inpt.y) || 1, sp = p.speed * (p.dash > .55 ? 3 : 1);
    moveEnt(p, inpt.x/mag*sp*dt, inpt.y/mag*sp*dt);
    if (inpt.attack) attack();
    p.inv -= dt; p.dash -= dt; p.atk -= dt; p.cd -= dt; game.msgT -= dt;
    collectTile();

    for (const e of game.enemies) {
      e.hurt -= dt; e.cd -= dt;
      const dx = p.x-e.x, dy=p.y-e.y, d=Math.hypot(dx,dy)||1;
      if (d < 520 && e.type !== 'skeleton') moveEnt(e, dx/d*e.speed*dt, dy/d*e.speed*dt);
      if (e.type === 'skeleton' && d < 420 && d > 150) moveEnt(e, dx/d*e.speed*.55*dt, dy/d*e.speed*.55*dt);
      if (d < e.r + p.r + 4 && e.cd <= 0) { hurt(e.atk); e.cd = .9; }
      if ((e.type === 'skeleton' || e.type === 'boss') && d < 560 && e.cd <= 0) {
        game.shots.push({ x:e.x, y:e.y, vx:dx/d*(e.type==='boss'?170:135), vy:dy/d*(e.type==='boss'?170:135), life:3, r:e.type==='boss'?6:4, dmg:e.type==='boss'?18:10 });
        e.cd = e.shoot;
      }
      if (e.hp <= 0 && !e.dead) { e.dead = true; game.kills++; burst(e.x,e.y,e.color,18); if (e.type === 'boss') { game.exitOpen = true; game.msg='Exit unsealed. Find the green stairs.'; game.msgT=4; } }
    }
    game.enemies = game.enemies.filter(e => !e.dead);
    for (const s of game.shots) { s.x += s.vx*dt; s.y += s.vy*dt; s.life -= dt; if (solidAt(s.x,s.y)) s.life=0; if (dist(s,p)<p.r+s.r) { hurt(s.dmg); s.life=0; } }
    game.shots = game.shots.filter(s => s.life > 0);
    for (const b of game.bits) { b.x += b.vx*dt; b.y += b.vy*dt; b.vx *= .94; b.vy *= .94; b.life -= dt; }
    game.bits = game.bits.filter(b => b.life > 0);
    for (const f of game.float) { f.y -= 28*dt; f.life -= dt; }
    game.float = game.float.filter(f => f.life > 0);
    game.cam.x = clamp(p.x - W/2, 0, MW*TILE - W); game.cam.y = clamp(p.y - H/2, 0, MH*TILE - H);
  }

  function drawTile(t, sx, sy) {
    const colors = { [WALL]:'#273342', [FLOOR]:'#121820', [CRATE]:'#8b5a2b', [EXIT]: game.exitOpen?'#2ea043':'#34523f', [SPIKE]:'#2d333b', [GEM]:'#121820', [POTION]:'#121820' };
    ctx.fillStyle = colors[t] || '#111'; ctx.fillRect(sx, sy, TILE, TILE);
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.strokeRect(sx+.5, sy+.5, TILE-1, TILE-1);
    if (t === WALL) { ctx.fillStyle='rgba(255,255,255,.06)'; ctx.fillRect(sx+3,sy+3,TILE-6,6); }
    if (t === CRATE) { ctx.strokeStyle='#c58b4a'; ctx.lineWidth=3; ctx.strokeRect(sx+7,sy+7,18,18); ctx.beginPath(); ctx.moveTo(sx+8,sy+8); ctx.lineTo(sx+24,sy+24); ctx.moveTo(sx+24,sy+8); ctx.lineTo(sx+8,sy+24); ctx.stroke(); ctx.lineWidth=1; }
    if (t === EXIT) { ctx.fillStyle = game.exitOpen?'#7ee787':'#8b949e'; ctx.fillRect(sx+7,sy+7,18,18); }
    if (t === SPIKE) { ctx.fillStyle='#c9d1d9'; for(let i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(sx+7+i*8,sy+23); ctx.lineTo(sx+11+i*8,sy+9); ctx.lineTo(sx+15+i*8,sy+23); ctx.fill(); } }
    if (t === GEM) { ctx.fillStyle='#7ee787'; ctx.beginPath(); ctx.moveTo(sx+16,sy+6); ctx.lineTo(sx+25,sy+16); ctx.lineTo(sx+16,sy+26); ctx.lineTo(sx+7,sy+16); ctx.fill(); }
    if (t === POTION) { ctx.fillStyle='#58a6ff'; ctx.fillRect(sx+12,sy+9,8,16); ctx.fillStyle='#c9d1d9'; ctx.fillRect(sx+13,sy+5,6,5); }
  }

  function drawBar(x,y,w,h,pct,color) { ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(x,y,w,h); ctx.fillStyle=color; ctx.fillRect(x,y,w*pct,h); ctx.strokeStyle='rgba(255,255,255,.25)'; ctx.strokeRect(x+.5,y+.5,w-1,h-1); }
  function drawEnt(e) { const x=e.x-game.cam.x, y=e.y-game.cam.y; ctx.save(); ctx.translate(x,y); ctx.fillStyle=e.hurt>0?'#fff':e.color; ctx.fillRect(-e.r,-e.r,e.r*2,e.r*2); ctx.fillStyle='rgba(0,0,0,.3)'; ctx.fillRect(-e.r+4,-e.r+5,5,5); ctx.fillRect(e.r-9,-e.r+5,5,5); if (e.type==='boss') { ctx.fillStyle='#ff7b72'; ctx.fillRect(-20,-34,40,7); } ctx.restore(); if (e.maxHp>40) drawBar(x-24,y-e.r-14,48,5,e.hp/e.maxHp,'#ff7b72'); }

  function render() {
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#05080d'; ctx.fillRect(0,0,W,H);
    if (!game.player) return;
    const sx=Math.floor(game.cam.x/TILE), sy=Math.floor(game.cam.y/TILE), ex=sx+Math.ceil(W/TILE)+1, ey=sy+Math.ceil(H/TILE)+1;
    for(let y=sy;y<ey;y++) for(let x=sx;x<ex;x++) drawTile(game.map[y]?.[x] ?? WALL, x*TILE-game.cam.x, y*TILE-game.cam.y);
    for (const s of game.shots) { ctx.fillStyle='#ffdf7e'; ctx.beginPath(); ctx.arc(s.x-game.cam.x,s.y-game.cam.y,s.r,0,TAU); ctx.fill(); }
    for (const e of game.enemies) drawEnt(e);
    const p=game.player, px=p.x-game.cam.x, py=p.y-game.cam.y;
    ctx.save(); ctx.translate(px,py); ctx.globalAlpha=p.inv>0 && Math.floor(performance.now()/80)%2?0.35:1; ctx.fillStyle='#58a6ff'; ctx.fillRect(-12,-12,24,24); ctx.fillStyle='#e6edf3'; ctx.fillRect(4,-5,5,5); ctx.rotate(p.dir); ctx.fillStyle='#c9d1d9'; ctx.fillRect(8,-3,24,6); if (p.atk>0) { ctx.fillStyle='rgba(255,241,168,.35)'; ctx.beginPath(); ctx.arc(24,0,38,-.8,.8); ctx.lineTo(0,0); ctx.fill(); } ctx.restore();
    for (const b of game.bits) { ctx.globalAlpha=clamp(b.life*2,0,1); ctx.fillStyle=b.color; ctx.fillRect(b.x-game.cam.x,b.y-game.cam.y,4,4); ctx.globalAlpha=1; }
    ctx.font='bold 15px system-ui'; ctx.textAlign='center'; for (const f of game.float) { ctx.globalAlpha=clamp(f.life,0,1); ctx.fillStyle=f.color; ctx.fillText(f.text,f.x-game.cam.x,f.y-game.cam.y); ctx.globalAlpha=1; }
    drawBar(18,18,210,16,p.hp/p.maxHp,'#7ee787'); ctx.fillStyle='#e6edf3'; ctx.font='bold 16px system-ui'; ctx.textAlign='left'; ctx.fillText(`HP ${Math.ceil(p.hp)}/${p.maxHp}`,26,32); ctx.fillText(`Gems ${game.gems}  Best ${game.best}  Kills ${game.kills}`,18,58);
    ctx.fillStyle='rgba(5,8,13,.68)'; ctx.fillRect(W-255,16,235,52); ctx.fillStyle='#c9d1d9'; ctx.fillText(game.exitOpen?'Exit open: find green stairs':'Goal: defeat Gatekeeper',W-242,38); if(game.msgT>0) { ctx.fillStyle='#ffdf7e'; ctx.fillText(game.msg,18,H-22); }
  }

  function loop(t) { const dt = Math.min((t-last)/1000 || 0, .05); last = t; update(dt); render(); requestAnimationFrame(loop); }

  startButton.addEventListener('click', () => { if (game.state === 'pause') { game.state='play'; hideOverlay(); } else newGame(); });
  fullscreenButton.addEventListener('click', () => canvas.requestFullscreen?.());
  addEventListener('keydown', e => { keys.add(e.code); if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); if (game.state==='pause' && (e.code==='Escape'||e.code==='KeyP')) { game.state='play'; hideOverlay(); } });
  addEventListener('keyup', e => keys.delete(e.code));
  canvas.addEventListener('mousemove', e => { const r=canvas.getBoundingClientRect(); mouse.x=(e.clientX-r.left)*canvas.width/r.width; mouse.y=(e.clientY-r.top)*canvas.height/r.height; if(game.player) game.player.dir=Math.atan2(mouse.y-(game.player.y-game.cam.y), mouse.x-(game.player.x-game.cam.x)); });
  canvas.addEventListener('mousedown', () => mouse.down = true); addEventListener('mouseup', () => mouse.down = false);
  addEventListener('gamepadconnected', e => { padStatus.textContent = `Joypad: ${e.gamepad.id.split('(')[0].trim()}`; tips.textContent = 'Joypad detected. Press Start to pause.'; });
  showOverlay('Block Dungeon Crawl', 'Explore, collect gems, defeat the Gatekeeper boss, then escape through the stairs.', 'Start dungeon');
  requestAnimationFrame(loop);
})();
