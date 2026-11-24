(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('arena');
  const ctx = canvas.getContext('2d');

  const state = {
    mode: 'rescue', running: false, ended: false, pausedForUpgrade: false,
    last: 0, elapsed: 0, toastTimer: 0, shake: 0, domainFlash: 0,
    player: null, enemies: [], civilians: [], projectiles: [], particles: [],
    keys: {}, cooldowns: { attack: 0, burst: 0, dash: 0, enemy: 0 },
    wave: 1, saved: 0, targetSaves: 3, xp: 0, bestWave: 0,
    totalSaved: 0, damageBonus: 0, energyGain: 1, missionTime: 0,
    bossPhase: 0, nextSpawn: 0, lastUpgradeWave: 0
  };

  const modes = {
    rescue: { type: 'FIELD OPERATION', name: 'VEILBREAKER RESCUE', objective: 'SAVE 3 CIVILIANS', enemy: 'CURSED SPIRIT' },
    survival: { type: 'SURVIVAL PROTOCOL', name: 'ENDLESS CURSE NIGHT', objective: 'SURVIVE THE WAVES', enemy: 'CURSE SWARM' },
    duel: { type: 'SPECIAL GRADE', name: 'DOMAIN DUEL', objective: 'DEFEAT THE SPECIAL GRADE', enemy: 'THE HOLLOW REGENT' }
  };

  function newPlayer() {
    return { x: 190, y: 390, z: 0, vz: 0, hp: 100, maxHp: 100, energy: 0, facing: 1, invuln: 0, grounded: true };
  }
  function showToast(text) {
    $('arenaToast').textContent = text;
    state.toastTimer = 2.1;
    $('arenaToast').style.opacity = '1';
  }
  function setStatus(text) { $('statusLine').textContent = text; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function updateStats() {
    $('totalSaved').textContent = state.totalSaved;
    $('bestWave').textContent = state.bestWave;
    $('xpValue').textContent = state.xp;
    $('rankLabel').textContent = state.xp >= 400 ? 'SPECIAL GRADE' : state.xp >= 180 ? 'GRADE 1' : state.xp >= 60 ? 'GRADE 2' : 'GRADE 4';
  }

  function openMode(mode) {
    state.mode = mode;
    $('hubScreen').classList.add('hidden');
    $('gameScreen').classList.remove('hidden');
    $('missionType').textContent = modes[mode].type;
    $('missionName').textContent = modes[mode].name;
    $('missionObjective').textContent = modes[mode].objective;
    $('enemyName').textContent = modes[mode].enemy;
    $('endPanel').classList.add('hidden');
    $('upgradePanel').classList.add('hidden');
    resetRun();
  }

  function backToHQ() {
    state.running = false;
    $('gameScreen').classList.add('hidden');
    $('hubScreen').classList.remove('hidden');
    updateStats();
  }

  function resetRun() {
    state.running = true; state.ended = false; state.pausedForUpgrade = false;
    state.last = performance.now(); state.elapsed = 0; state.shake = 0; state.domainFlash = 0;
    state.player = newPlayer(); state.enemies = []; state.civilians = []; state.projectiles = []; state.particles = [];
    state.cooldowns = { attack: 0, burst: 0, dash: 0, enemy: 1.0 };
    state.wave = 1; state.saved = 0; state.targetSaves = 3; state.damageBonus = 0; state.energyGain = 1;
    state.missionTime = 0; state.bossPhase = 0; state.nextSpawn = 1.2; state.lastUpgradeWave = 0;
    if (state.mode === 'rescue') {
      for (let i = 0; i < 3; i++) spawnCivilian(510 + i * 115);
      spawnEnemy('grunt', 720);
    } else if (state.mode === 'survival') {
      spawnEnemy('grunt', 730); spawnEnemy('grunt', 820);
    } else {
      spawnEnemy('boss', 760);
    }
    showToast(state.mode === 'rescue' ? 'GET THE CIVILIANS TO THE SAFE ZONE' : state.mode === 'survival' ? 'SURVIVE THE CURSE WAVES' : 'SPECIAL GRADE DETECTED');
    setStatus('Rin, your Violet Thread technique is ready.');
    updateHUD();
    requestAnimationFrame(loop);
  }

  function spawnCivilian(x) {
    state.civilians.push({ x, y: 0, rescued: false, hp: 1, wobble: Math.random() * 5 });
  }
  function spawnEnemy(kind, x) {
    const boss = kind === 'boss';
    const grunt = kind === 'grunt';
    state.enemies.push({
      kind, x: clamp(x ?? rand(640, 900), 70, 940), z: 0,
      hp: boss ? 260 : grunt ? 42 + state.wave * 7 : 25,
      maxHp: boss ? 260 : grunt ? 42 + state.wave * 7 : 25,
      speed: boss ? 43 : grunt ? 52 + state.wave * 3 : 70,
      damage: boss ? 16 : grunt ? 8 : 6,
      size: boss ? 1.65 : grunt ? 1.0 : .8,
      cooldown: rand(.7, 1.7), tell: 0, invuln: 0, phase: Math.random() * 7,
      dead: false
    });
  }

  function addParticles(x, y, color, count = 10, power = 1) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2), speed = rand(.4, 2.7) * power;
      state.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: rand(.35, .9), max: .9, color, size: rand(2, 5) });
    }
  }
  function gainEnergy(amount) { state.player.energy = clamp(state.player.energy + amount * state.energyGain, 0, 100); }

  function strike() {
    if (!state.running || state.ended || state.pausedForUpgrade || state.cooldowns.attack > 0) return;
    state.cooldowns.attack = .34;
    const p = state.player;
    addParticles(p.x + p.facing * 42, floorY(p.x) - 58 - p.z, '#ff7ac8', 8, 1);
    let hit = false;
    state.enemies.forEach(e => {
      if (e.dead) return;
      if (Math.abs(e.x - p.x) < (e.kind === 'boss' ? 120 : 88) && Math.abs(e.z - p.z) < 65) {
        damageEnemy(e, 14 + state.damageBonus, '#ff72c9'); hit = true;
      }
    });
    if (hit) { gainEnergy(12); setStatus('Violet Thread: clean hit. Cursed energy recovered.'); }
    else setStatus('Strike missed — get closer to a curse.');
    updateHUD();
  }

  function burst() {
    if (!state.running || state.ended || state.pausedForUpgrade || state.cooldowns.burst > 0) return;
    const p = state.player;
    if (p.energy < 20) { setStatus('Need 20% cursed energy for a Violet Burst.'); return; }
    p.energy -= 20; state.cooldowns.burst = .6;
    state.projectiles.push({ x: p.x + p.facing * 28, z: p.z + 42, vx: p.facing * 480, life: 1.7, color: '#b98aff', r: 13 });
    addParticles(p.x, floorY(p.x) - 45 - p.z, '#b98aff', 13, 1.1);
    setStatus('VIOLET BURST released.');
    updateHUD();
  }

  function dash() {
    if (!state.running || state.ended || state.pausedForUpgrade || state.cooldowns.dash > 0) return;
    const p = state.player;
    p.x = clamp(p.x + p.facing * 100, 35, 965);
    p.invuln = .34; state.cooldowns.dash = .75;
    addParticles(p.x, floorY(p.x) - 35 - p.z, '#79f1ef', 15, 1.4);
    setStatus('Threadstep dash — briefly invulnerable.');
  }
  function jump() {
    if (!state.running || state.ended || state.pausedForUpgrade || !state.player.grounded) return;
    state.player.vz = 440; state.player.grounded = false;
    addParticles(state.player.x, floorY(state.player.x) - 5, '#79f1ef', 7, .8);
  }

  function useDomain() {
    if (!state.running || state.ended || state.pausedForUpgrade) return;
    const p = state.player;
    if (p.energy < 100) { setStatus('Domain requires 100% energy. Land strikes to charge it.'); return; }
    p.energy = 0; state.domainFlash = 1.6; state.shake = 12;
    addParticles(p.x, floorY(p.x) - 40 - p.z, '#ff6dbd', 32, 2);
    state.enemies.forEach(e => { if (!e.dead) damageEnemy(e, e.kind === 'boss' ? 72 : 52, '#d1a0ff'); });
    setStatus('DOMAIN EXPANSION: VIOLET THREAD SANCTUM!');
    updateHUD();
  }

  function damageEnemy(e, damage, color) {
    if (e.dead || e.invuln > 0) return;
    e.hp -= damage; e.invuln = .12; state.shake = 4;
    addParticles(e.x, floorY(e.x) - 52 - e.z, color, 13, 1.2);
    if (e.hp <= 0) {
      e.dead = true; state.xp += e.kind === 'boss' ? 120 : 18;
      addParticles(e.x, floorY(e.x) - 45, '#b98aff', 24, 1.7);
      if (e.kind === 'boss') showToast('SPECIAL GRADE EXORCISED');
      else showToast('CURSE EXORCISED + XP');
      if (state.mode === 'rescue' && state.enemies.filter(x => !x.dead).length === 0 && state.saved < state.targetSaves) {
        setStatus('Area clear. Move near a civilian and press J to guide them to safety.');
      }
      if (state.mode === 'duel' && state.enemies.every(x => x.dead)) endRun(true, 'SPECIAL GRADE EXORCISED', 'The Hollow Regent has fallen. The domain is yours.');
      updateStats();
    }
    updateHUD();
  }

  function rescueNearby() {
    if (state.mode !== 'rescue' || !state.running) return;
    const p = state.player;
    const c = state.civilians.find(c => !c.rescued && Math.abs(c.x - p.x) < 65);
    if (!c) return;
    c.rescued = true; state.saved++; state.totalSaved++; state.xp += 25;
    addParticles(c.x, floorY(c.x) - 25, '#b6ffcf', 22, 1.3);
    showToast('CIVILIAN ESCORTED TO SAFETY');
    setStatus(`Civilian rescued: ${state.saved}/${state.targetSaves}. Keep moving!`);
    updateStats(); updateHUD();
    if (state.saved >= state.targetSaves) endRun(true, 'DISTRICT SECURED', 'All civilians made it to safety. You held the veil long enough for evacuation.');
  }

  function endRun(win, title, copy) {
    state.running = false; state.ended = true;
    $('endPanel').classList.remove('hidden');
    $('endTitle').textContent = title;
    $('endCopy').textContent = copy;
    $('endEyebrow').textContent = win ? 'MISSION COMPLETE' : 'MISSION FAILED';
    $('retryBtn').textContent = win ? 'RUN IT BACK ↻' : 'RETRY MISSION ↻';
    showToast(win ? 'OPERATION COMPLETE' : 'SORCERER DOWN');
    updateStats();
  }

  function updateHUD() {
    const p = state.player;
    if (!p) return;
    $('hpText').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    $('hpMeter').style.width = `${clamp(p.hp / p.maxHp * 100, 0, 100)}%`;
    $('energyText').textContent = `${Math.floor(p.energy)}%`;
    $('energyMeter').style.width = `${p.energy}%`;
    const live = state.enemies.filter(e => !e.dead);
    if (state.mode === 'duel') {
      const boss = live.find(e => e.kind === 'boss') || state.enemies.find(e => e.kind === 'boss');
      $('enemyHpText').textContent = boss ? `${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}` : '0';
      $('enemyMeter').style.width = boss ? `${clamp(boss.hp / boss.maxHp * 100, 0, 100)}%` : '0%';
    } else {
      const total = live.reduce((n, e) => n + Math.max(0, e.hp), 0);
      const max = live.reduce((n, e) => n + e.maxHp, 0);
      $('enemyHpText').textContent = `${live.length} ACTIVE`;
      $('enemyMeter').style.width = `${max ? total / max * 100 : 0}%`;
    }
    $('waveText').textContent = state.mode === 'duel' ? 'BOSS ENCOUNTER' : `WAVE ${state.wave}`;
    $('savedText').textContent = state.mode === 'rescue' ? `CIVILIANS ${state.saved}/${state.targetSaves}` : state.mode === 'survival' ? `SCORE ${state.xp}` : 'DOMAIN DUEL';
  }

  function update(dt) {
    const p = state.player;
    state.elapsed += dt; state.missionTime += dt;
    state.cooldowns.attack = Math.max(0, state.cooldowns.attack - dt);
    state.cooldowns.burst = Math.max(0, state.cooldowns.burst - dt);
    state.cooldowns.dash = Math.max(0, state.cooldowns.dash - dt);
    state.cooldowns.enemy = Math.max(0, state.cooldowns.enemy - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    state.domainFlash = Math.max(0, state.domainFlash - dt);
    state.shake = Math.max(0, state.shake - 24 * dt);
    if (state.toastTimer > 0) { state.toastTimer -= dt; $('arenaToast').style.opacity = state.toastTimer < .3 ? String(state.toastTimer / .3) : '1'; }

    if (state.keys.a || state.keys.arrowleft) { p.x -= 245 * dt; p.facing = -1; }
    if (state.keys.d || state.keys.arrowright) { p.x += 245 * dt; p.facing = 1; }
    p.x = clamp(p.x, 28, 972);
    p.vz -= 1050 * dt; p.z += p.vz * dt;
    if (p.z <= 0) { p.z = 0; p.vz = 0; p.grounded = true; }

    state.enemies.forEach(e => {
      if (e.dead) return;
      e.invuln = Math.max(0, e.invuln - dt);
      e.phase += dt * 3;
      const dx = p.x - e.x;
      e.facing = dx < 0 ? -1 : 1;
      const gap = Math.abs(dx);
      if (gap > (e.kind === 'boss' ? 120 : 58)) e.x += Math.sign(dx) * e.speed * dt;
      e.x = clamp(e.x, 25, 975);
      e.cooldown -= dt;
      if (e.cooldown <= 0 && gap < (e.kind === 'boss' ? 205 : 85)) {
        e.cooldown = e.kind === 'boss' ? 1.45 : 1.3 + Math.random() * .5;
        e.tell = .42;
      }
      if (e.tell > 0) {
        e.tell -= dt;
        if (e.tell <= 0 && gap < (e.kind === 'boss' ? 220 : 93) && p.invuln <= 0 && Math.abs(p.z) < 65) {
          p.hp = Math.max(0, p.hp - e.damage); state.shake = 6;
          addParticles(p.x, floorY(p.x) - 45, '#ff537f', 12, 1.2);
          setStatus(e.kind === 'boss' ? 'Boss impact! Watch for the red attack tell.' : 'Hit taken. Dash through attacks to avoid damage.');
          updateHUD();
          if (p.hp <= 0) endRun(false, 'CURSE OVERWHELMED YOU', 'Your field run ended. Return to HQ and try a different approach.');
        }
      }
    });

    state.projectiles.forEach(b => {
      b.x += b.vx * dt; b.life -= dt;
      const e = state.enemies.find(e => !e.dead && Math.abs(e.x - b.x) < (e.kind === 'boss' ? 46 : 30) && Math.abs((floorY(e.x) - 48 - (e.z || 0)) - (floorY(b.x) - b.z)) < 95);
      if (e && b.life > 0) {
        b.life = 0; damageEnemy(e, 25 + state.damageBonus, b.color); gainEnergy(4);
      }
    });
    state.projectiles = state.projectiles.filter(b => b.life > 0 && b.x > -30 && b.x < 1030);
    state.particles.forEach(a => { a.x += a.vx * 30 * dt; a.y += a.vy * 30 * dt; a.life -= dt; a.vx *= .985; a.vy *= .985; });
    state.particles = state.particles.filter(a => a.life > 0);

    if (state.mode === 'rescue') {
      if (state.saved < state.targetSaves && state.enemies.every(e => e.dead) && state.enemies.length < 4) {
        if (state.nextSpawn <= 0) { spawnEnemy('grunt', rand(680, 950)); state.nextSpawn = 2.8; showToast('NEW CURSE APPROACHING'); }
        else state.nextSpawn -= dt;
      }
      if (state.saved < state.targetSaves && state.civilians.every(c => c.rescued)) endRun(true, 'DISTRICT SECURED', 'Every civilian reached safety.');
    } else if (state.mode === 'survival') {
      if (state.enemies.every(e => e.dead)) {
        state.wave++;
        state.bestWave = Math.max(state.bestWave, state.wave - 1);
        updateStats();
        if (state.wave % 2 === 0) {
          state.running = false; state.pausedForUpgrade = true;
          $('upgradePanel').classList.remove('hidden');
          showToast(`WAVE ${state.wave - 1} CLEARED`);
        } else {
          const n = Math.min(2 + state.wave, 8);
          for (let i = 0; i < n; i++) spawnEnemy(state.wave % 5 === 0 && i === 0 ? 'boss' : 'grunt', rand(650, 950));
          showToast(`WAVE ${state.wave} INCOMING`);
        }
        updateHUD();
      }
    }
    updateHUD();
  }

  function chooseUpgrade(type) {
    if (!state.pausedForUpgrade) return;
    if (type === 'power') state.damageBonus += 5;
    if (type === 'vitality') state.player.hp = Math.min(state.player.maxHp, state.player.hp + 25);
    if (type === 'charge') state.energyGain += .35;
    $('upgradePanel').classList.add('hidden');
    state.pausedForUpgrade = false; state.running = true;
    const n = Math.min(2 + state.wave, 8);
    for (let i = 0; i < n; i++) spawnEnemy(state.wave % 5 === 0 && i === 0 ? 'boss' : 'grunt', rand(650, 950));
    showToast(`WAVE ${state.wave} — UPGRADE EQUIPPED`);
    state.last = performance.now();
    requestAnimationFrame(loop);
    updateHUD();
  }

  function floorY(x) {
    // Perspective floor: foreground edges are lower than the distant horizon.
    return 305 + (x / 1000) * 28;
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, 560);
    g.addColorStop(0, '#211532'); g.addColorStop(.48, '#120d1d'); g.addColorStop(1, '#080710');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1000, 560);
    // Distant skyline
    for (let i = 0; i < 23; i++) {
      const x = i * 48 - 5, h = 50 + ((i * 29) % 90);
      ctx.fillStyle = i % 2 ? '#21172e' : '#181123';
      ctx.fillRect(x, 285 - h, 39, h);
      for (let yy = 300 - h; yy < 282; yy += 18) {
        ctx.fillStyle = '#bb78ff44'; ctx.fillRect(x + 8, yy, 4, 5); ctx.fillRect(x + 23, yy, 4, 5);
      }
    }
    // Veil moon
    ctx.fillStyle = '#d9b8ff'; ctx.globalAlpha = .7;
    ctx.beginPath(); ctx.arc(770, 95, 35, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#b36eff40'; ctx.lineWidth = 1;
    for (let i = 0; i < 50; i++) {
      const x = (i * 137 + 31) % 1000, y = (i * 53 + 17) % 245;
      ctx.globalAlpha = .2 + .4 * Math.abs(Math.sin(state.elapsed * 2 + i));
      ctx.fillStyle = i % 3 ? '#c6a4ff' : '#ff7ac8'; ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    // Perspective plane
    ctx.fillStyle = '#171020'; ctx.beginPath(); ctx.moveTo(0, 304); ctx.lineTo(1000, 304); ctx.lineTo(1000, 560); ctx.lineTo(0, 560); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#55366b'; ctx.lineWidth = 1;
    for (let i = -12; i <= 12; i++) {
      ctx.beginPath(); ctx.moveTo(500 + i * 26, 304); ctx.lineTo(500 + i * 76, 560); ctx.stroke();
    }
    for (let y = 320; y < 560; y += (y - 290) * .12) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1000, y); ctx.stroke();
    }
    // Breach glow
    const rg = ctx.createRadialGradient(500, 310, 10, 500, 310, 260);
    rg.addColorStop(0, '#8d4cbb24'); rg.addColorStop(1, '#8d4cbb00');
    ctx.fillStyle = rg; ctx.fillRect(0, 230, 1000, 330);
    if (state.domainFlash > 0) {
      ctx.fillStyle = `rgba(151,70,255,${state.domainFlash * .20})`; ctx.fillRect(0, 0, 1000, 560);
      ctx.strokeStyle = '#ff7ac8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(500, 320, 180 + (1.6 - state.domainFlash) * 130, 90 + (1.6 - state.domainFlash) * 80, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawSorcerer(x, y, facing, enemy = false, scale = 1, invuln = 0, tell = 0, z = 0) {
    ctx.save(); ctx.translate(x, y - z); ctx.scale(facing * scale, scale);
    const coat = enemy ? '#56286f' : '#171522', accent = enemy ? '#ff5eac' : '#a875ff';
    if (tell > 0) {
      ctx.strokeStyle = '#ff365f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, -26, 48 + (tell * 15), 65, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = .7; ctx.shadowBlur = 22; ctx.shadowColor = accent; ctx.fillStyle = accent;
    ctx.beginPath(); ctx.ellipse(0, -38, enemy ? 31 : 24, 47, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    // Ground shadow adds pseudo-depth
    ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.ellipse(0, 1 + z, 27, 7, 0, 0, Math.PI * 2); ctx.fill();
    // Legs
    ctx.strokeStyle = coat; ctx.lineWidth = 11; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-7, -21); ctx.lineTo(-13, -3); ctx.moveTo(7, -21); ctx.lineTo(13, -3); ctx.stroke();
    // Jacket body
    ctx.fillStyle = coat; ctx.beginPath(); ctx.moveTo(-15, -63); ctx.lineTo(15, -63); ctx.lineTo(20, -22); ctx.lineTo(-20, -22); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(7, -37); ctx.stroke();
    // Arm and energy cuff
    ctx.strokeStyle = coat; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(10, -53); ctx.lineTo(25, -39); ctx.stroke();
    ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(21, -43); ctx.lineTo(29, -37); ctx.stroke();
    // Face and hair
    ctx.fillStyle = '#efc0b2'; ctx.beginPath(); ctx.arc(0, -77, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = enemy ? '#2a173b' : '#252036'; ctx.beginPath(); ctx.moveTo(-13, -78); ctx.lineTo(-10, -92); ctx.lineTo(-2, -86); ctx.lineTo(6, -95); ctx.lineTo(14, -81); ctx.lineTo(9, -72); ctx.lineTo(2, -80); ctx.lineTo(-7, -71); ctx.lineTo(-13, -72); ctx.closePath(); ctx.fill();
    ctx.fillStyle = enemy ? '#ff83d1' : '#79f1ef'; ctx.fillRect(4, -79, 5, 3);
    if (enemy) {
      ctx.strokeStyle = '#ff5eac'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-11, -58); ctx.lineTo(-22, -47); ctx.moveTo(12, -61); ctx.lineTo(23, -71); ctx.stroke();
    }
    if (invuln > 0) { ctx.globalAlpha = .45; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -44, 38, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function drawEnemy(e) {
    const y = floorY(e.x);
    const s = e.size;
    // enemy shadow
    ctx.fillStyle = '#0009'; ctx.beginPath(); ctx.ellipse(e.x, y + 1, 24 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
    if (e.kind === 'boss') {
      ctx.save(); ctx.translate(e.x, y); ctx.scale(s, s);
      ctx.globalAlpha = .65; ctx.shadowBlur = 30; ctx.shadowColor = '#ff4fbc'; ctx.fillStyle = '#a345c9';
      ctx.beginPath(); ctx.ellipse(0, -63, 48, 66, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      ctx.fillStyle = '#281332'; ctx.beginPath(); ctx.moveTo(-36, -60); ctx.lineTo(-22, -104); ctx.lineTo(-7, -83); ctx.lineTo(9, -110); ctx.lineTo(33, -77); ctx.lineTo(41, -42); ctx.lineTo(22, -18); ctx.lineTo(-24, -18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffb3ec'; ctx.fillRect(-18, -70, 11, 5); ctx.fillRect(9, -70, 11, 5);
      ctx.strokeStyle = '#ff68bd'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-30, -35); ctx.lineTo(-55, -10); ctx.moveTo(30, -35); ctx.lineTo(56, -12); ctx.stroke();
      ctx.restore();
    } else {
      drawSorcerer(e.x, y, e.facing, true, s, e.invuln, e.tell, 0);
    }
    // tiny health strip
    const w = e.kind === 'boss' ? 100 : 48;
    ctx.fillStyle = '#100b18'; ctx.fillRect(e.x - w/2, y - (e.kind === 'boss' ? 145 : 113), w, 5);
    ctx.fillStyle = e.kind === 'boss' ? '#ff5eac' : '#b77bff';
    ctx.fillRect(e.x - w/2, y - (e.kind === 'boss' ? 145 : 113), w * clamp(e.hp / e.maxHp, 0, 1), 5);
  }

  function drawCivilian(c) {
    if (c.rescued) return;
    const y = floorY(c.x);
    ctx.save(); ctx.translate(c.x, y + Math.sin(state.elapsed * 3 + c.wobble) * 2);
    ctx.fillStyle = '#0007'; ctx.beginPath(); ctx.ellipse(0, 2, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b6ffcf'; ctx.beginPath(); ctx.arc(0, -32, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#354052'; ctx.fillRect(-8, -22, 16, 20);
    ctx.strokeStyle = '#b6ffcf'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-6, -15); ctx.lineTo(-13, -5); ctx.moveTo(6, -15); ctx.lineTo(13, -5); ctx.stroke();
    ctx.fillStyle = '#b6ffcf'; ctx.font = '10px Orbitron'; ctx.textAlign = 'center'; ctx.fillText('HELP', 0, -49);
    ctx.restore();
  }

  function draw() {
    ctx.save();
    if (state.shake > 0) ctx.translate(rand(-state.shake, state.shake), rand(-state.shake, state.shake));
    drawBackground();
    // Safe-zone marker in rescue mode
    if (state.mode === 'rescue') {
      ctx.fillStyle = '#b6ffcf10'; ctx.fillRect(15, 295, 125, 265);
      ctx.strokeStyle = '#b6ffcf66'; ctx.setLineDash([6, 6]); ctx.strokeRect(15, 295, 125, 265); ctx.setLineDash([]);
      ctx.fillStyle = '#b6ffcf'; ctx.font = '10px Orbitron'; ctx.fillText('SAFE ZONE', 25, 290);
      ctx.fillStyle = '#b6ffcf'; ctx.globalAlpha = .65; ctx.fillRect(28, 315, 5, 60); ctx.globalAlpha = 1;
    }
    // Draw objects back-to-front for depth
    const objects = [];
    state.civilians.forEach(c => { if (!c.rescued) objects.push({x:c.x, type:'civilian', ref:c}); });
    state.enemies.forEach(e => { if (!e.dead) objects.push({x:e.x, type:'enemy', ref:e}); });
    objects.push({x:state.player.x, type:'player', ref:state.player});
    objects.sort((a,b) => a.x - b.x);
    objects.forEach(o => {
      if (o.type === 'civilian') drawCivilian(o.ref);
      else if (o.type === 'enemy') drawEnemy(o.ref);
      else drawSorcerer(o.ref.x, floorY(o.ref.x), o.ref.facing, false, 1, o.ref.invuln, 0, o.ref.z);
    });
    state.projectiles.forEach(b => {
      const y = floorY(b.x) - b.z;
      ctx.save(); ctx.shadowBlur = 22; ctx.shadowColor = b.color; ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    state.particles.forEach(a => {
      ctx.globalAlpha = clamp(a.life / a.max, 0, 1); ctx.fillStyle = a.color; ctx.fillRect(a.x, a.y, a.size, a.size);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function loop(now) {
    if (!state.running) return;
    const dt = Math.min((now - state.last) / 1000, .032);
    state.last = now;
    update(dt); draw();
    if (state.running) requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (['arrowleft','arrowright','arrowup',' '].includes(key)) e.preventDefault();
    state.keys[key] = true;
    if (e.repeat) return;
    if (key === 'j') { strike(); if (state.mode === 'rescue') rescueNearby(); }
    if (key === 'k') burst();
    if (key === 'l') useDomain();
    if (key === 'w' || key === 'arrowup' || key === ' ') jump();
    if (key === 'shift') dash();
  });
  window.addEventListener('keyup', e => { state.keys[e.key.toLowerCase()] = false; });

  document.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => openMode(btn.dataset.mode)));
  $('backBtn').addEventListener('click', backToHQ);
  $('hqBtn').addEventListener('click', backToHQ);
  $('retryBtn').addEventListener('click', () => resetRun());
  document.querySelectorAll('[data-upgrade]').forEach(btn => btn.addEventListener('click', () => chooseUpgrade(btn.dataset.upgrade)));

  document.querySelectorAll('[data-action]').forEach(btn => {
    const action = btn.dataset.action;
    const down = e => {
      e.preventDefault();
      if (action === 'left') state.keys.arrowleft = true;
      else if (action === 'right') state.keys.arrowright = true;
      else if (action === 'jump') jump();
      else if (action === 'attack') { strike(); if (state.mode === 'rescue') rescueNearby(); }
      else if (action === 'burst') burst();
      else if (action === 'dash') dash();
      else if (action === 'domain') useDomain();
    };
    const up = () => {
      if (action === 'left') state.keys.arrowleft = false;
      if (action === 'right') state.keys.arrowright = false;
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
  });

  updateStats();
})();
