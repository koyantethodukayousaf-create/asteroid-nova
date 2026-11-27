    'use strict';

    const gameWrapper = document.getElementById('game-wrapper');
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d', { alpha: true });

    const scoreDisplay = document.getElementById('score-display');
    const levelDisplay = document.getElementById('level-display');
    const comboBadge = document.getElementById('combo-badge');
    const livesContainer = document.getElementById('lives-container');
    const startScreen = document.getElementById('start-screen');
    const pauseScreen = document.getElementById('pause-screen');
    const gameoverScreen = document.getElementById('gameover-screen');
    const finalScoreText = document.getElementById('final-score-text');
    const orientationHint = document.getElementById('orientation-hint');
    const startBtn = document.getElementById('start-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const restartBtn = document.getElementById('restart-btn');
    const settingsSoundBtn = document.getElementById('settings-sound-btn');
    const settingsGraphicsBtn = document.getElementById('settings-graphics-btn');
    const settingsRestartBtn = document.getElementById('settings-restart-btn');
    const settingsMenuBtn = document.getElementById('settings-menu-btn');
    const muteBtn = document.getElementById('btn-mute');
    const pauseBtn = document.getElementById('btn-pause');
    const boostBtn = document.getElementById('btn-boost');
    const shieldBtn = document.getElementById('btn-shield');
    const missileBtn = document.getElementById('btn-missile');
    const fireBtn = document.getElementById('btn-fire');
    const boostBar = document.getElementById('boost-bar');
    const shieldBar = document.getElementById('shield-bar');
    const missileBar = document.getElementById('missile-bar');
    const joystickZone = document.getElementById('joystick-zone');
    const joystickKnob = document.getElementById('joystick-knob');

    const GRAPHICS_MODES = ['NORMAL', 'MEDIUM', 'ULTRA'];
    const GRAPHICS_CONFIG = {
      NORMAL: {
        particleMultiplier: 0.6,
        maxParticles: 150,
        starDensityDivisor: 6200,
        nebulaCount: 4,
        galaxyCount: 1,
        craterDetail: 0.65,
        glowEnabled: false
      },
      MEDIUM: {
        particleMultiplier: 1.0,
        maxParticles: 240,
        starDensityDivisor: 4000,
        nebulaCount: 7,
        galaxyCount: 2,
        craterDetail: 1.0,
        glowEnabled: true
      },
      ULTRA: {
        particleMultiplier: 1.45,
        maxParticles: 360,
        starDensityDivisor: 2700,
        nebulaCount: 10,
        galaxyCount: 3,
        craterDetail: 1.35,
        glowEnabled: true
      }
    };

    let width = 1;
    let height = 1;
    let dpr = 1;
    let lastFrameTime = performance.now();
    let resizeFrame = 0;
    let gameResizeObserver = null;
    let renderedLivesCount = -1;
    const MAX_COMBO = 5;

    function readGraphicsQuality() {
      try {
        const saved = localStorage.getItem('asteroidNovaGraphics');
        if (saved && GRAPHICS_CONFIG[saved]) return saved;
      } catch (_) {}
      return 'MEDIUM';
    }

    function saveGraphicsQuality(mode) {
      try { localStorage.setItem('asteroidNovaGraphics', mode); }
      catch (_) {}
    }

    const gameState = {
      running: false, paused: false, score: 0, highScore: 0,
      level: 1, lives: 3, combo: 1, comboTimer: 0, screenShake: 0,
      galaxyTime: 0, graphicsQuality: readGraphicsQuality()
    };

    function getGraphicsProfile() {
      return GRAPHICS_CONFIG[gameState.graphicsQuality] || GRAPHICS_CONFIG.MEDIUM;
    }

    const keys = { left: false, right: false, up: false, fire: false, missile: false, boost: false, shield: false };
    const joystick = { active: false, angle: 0, force: 0 };

    let ship = null;
    let bullets = [];
    let missiles = [];
    let asteroids = [];
    let particles = [];
    let shockwaves = [];
    let powerups = [];
    let floatingTexts = [];
    let stars = [];
    let nebulaClouds = [];
    let bgGalaxies = [];

    // Interstellar 3D Launch Scene Entities
    let menuStars3D = [];
    let menuBodies3D = [];

    function readHighScore() {
      try { return Number(localStorage.getItem('asteroidNovaHigh')) || 0; }
      catch (_) { return 0; }
    }

    function saveHighScore(score) {
      try { localStorage.setItem('asteroidNovaHigh', String(score)); }
      catch (_) {}
    }

    gameState.highScore = readHighScore();

    function syncGraphicsUI() {
      settingsGraphicsBtn.textContent = `Graphics: ${gameState.graphicsQuality}`;
      const colorMap = {
        NORMAL: 'var(--amber)',
        MEDIUM: 'var(--cyan)',
        ULTRA: '#e066ff'
      };
      const col = colorMap[gameState.graphicsQuality] || 'var(--cyan)';
      settingsGraphicsBtn.style.borderColor = col;
      settingsGraphicsBtn.style.color = col;
    }

    function cycleGraphicsQuality() {
      const idx = GRAPHICS_MODES.indexOf(gameState.graphicsQuality);
      const next = GRAPHICS_MODES[(idx + 1) % GRAPHICS_MODES.length];
      gameState.graphicsQuality = next;
      saveGraphicsQuality(next);
      syncGraphicsUI();
      initGalaxyBackground();
    }

    function isInstalledAppMode() {
      return window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
    }

    function updateOrientationHint() {
      if (window.innerWidth > window.innerHeight) {
        orientationHint.textContent = '';
        return;
      }

      orientationHint.textContent = isInstalledAppMode()
        ? 'Rotate your device to landscape for the full cockpit layout.'
        : 'For landscape fullscreen, install Asteroid Nova and open it from your home screen.';
    }

    function enterFullscreenAndLandscape() {
      // Invoke both APIs immediately in the Launch Mission click gesture.
      // Awaiting fullscreen first can consume the transient user activation and
      // cause the orientation lock request to be rejected.
      const alreadyFullscreen = Boolean(
        document.fullscreenElement || document.webkitFullscreenElement
      );

      if (!alreadyFullscreen && !isInstalledAppMode()) {
        const request = gameWrapper.requestFullscreen || gameWrapper.webkitRequestFullscreen;
        if (typeof request === 'function') {
          try {
            const result = request.call(gameWrapper, { navigationUI: 'hide' });
            if (result && typeof result.catch === 'function') {
              result.catch(error => console.info('Fullscreen request was not granted.', error));
            }
          } catch (error) {
            // Older WebKit implementations may not accept the options object.
            try {
              const fallback = request.call(gameWrapper);
              if (fallback && typeof fallback.catch === 'function') fallback.catch(() => {});
            } catch (_) {
              console.info('Fullscreen is unavailable in this browser.', error);
            }
          }
        }
      }

      try {
        if (screen.orientation && typeof screen.orientation.lock === 'function') {
          const lockResult = screen.orientation.lock('landscape');
          if (lockResult && typeof lockResult.catch === 'function') lockResult.catch(() => {});
        }
      } catch (_) {
        // The manifest controls launch orientation in an installed PWA.
      }

      scheduleResize();
    }

    class SoundFX {
      constructor() { this.ctx = null; this.muted = false; this.lastExplosionAt = 0; }
      init() {
        if (!this.ctx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) this.ctx = new AudioContextClass();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      }
      tone(type, startHz, endHz, duration, volume) {
        if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
        try {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const now = this.ctx.currentTime;
          osc.type = type;
          osc.frequency.setValueAtTime(startHz, now);
          if (endHz !== startHz) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), now + duration);
          gain.gain.setValueAtTime(volume, now);
          gain.gain.exponentialRampToValueAtTime(.005, now + duration);
          osc.connect(gain); gain.connect(this.ctx.destination);
          osc.start(now); osc.stop(now + duration);
        } catch (_) {}
      }
      playLaser() { this.tone('sawtooth', 880, 110, .14, .14); }
      playMissile() { this.tone('square', 220, 640, .25, .14); }
      playShield() { this.tone('sine', 300, 900, .22, .18); }
      playBoost() { this.tone('sawtooth', 110, 180, .12, .1); }
      playThrust() { this.tone('triangle', 75, 75, .08, .06); }
      playPowerup() {
        if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
        try {
          const now = this.ctx.currentTime;
          [440, 660, 880].forEach((hz, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine'; osc.frequency.setValueAtTime(hz, now + i * .08);
            gain.gain.setValueAtTime(.13, now + i * .08);
            gain.gain.exponentialRampToValueAtTime(.005, now + i * .08 + .13);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(now + i * .08); osc.stop(now + i * .08 + .14);
          });
        } catch (_) {}
      }
      playExplosion(size = 1) {
        if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
        const nowMs = performance.now();
        if (nowMs - this.lastExplosionAt < 45) return;
        this.lastExplosionAt = nowMs;
        try {
          const duration = Math.min(.45, .2 + size * .08);
          const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
          const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * .3));
          const noise = this.ctx.createBufferSource();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();
          noise.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = 420 / Math.max(1, size);
          gain.gain.setValueAtTime(.22, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(.005, this.ctx.currentTime + duration);
          noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination); noise.start();
        } catch (_) {}
      }
    }

    const sfx = new SoundFX();

    function syncSoundUI() {
      muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
      muteBtn.setAttribute('aria-label', sfx.muted ? 'Turn sound on' : 'Turn sound off');
      settingsSoundBtn.textContent = sfx.muted ? 'Sound: OFF' : 'Sound: ON';
    }

    function getPlayfieldBounds() {
      const compact = width > height && height <= 620;
      const side = compact ? 36 : (width <= 480 ? 32 : 40);
      const top = compact ? 44 : 62;
      const bottom = compact ? 52 : 76;
      return {
        minX: Math.min(width / 2 - 20, side),
        maxX: Math.max(width / 2 + 20, width - side),
        minY: Math.min(height / 2 - 20, top),
        maxY: Math.max(height / 2 + 20, height - bottom)
      };
    }

    function getAsteroidScale() {
      return Math.max(.62, Math.min(1, Math.min(width, height) / 680));
    }

    function clampEntityPositionsAfterResize() {
      const bounds = getPlayfieldBounds();
      if (ship) {
        ship.x = Math.min(bounds.maxX, Math.max(bounds.minX, ship.x));
        ship.y = Math.min(bounds.maxY, Math.max(bounds.minY, ship.y));
      }
      asteroids.forEach(a => { a.x = Math.min(width, Math.max(0, a.x)); a.y = Math.min(height, Math.max(0, a.y)); });
      bullets.forEach(b => { b.x = Math.min(width, Math.max(0, b.x)); b.y = Math.min(height, Math.max(0, b.y)); });
      missiles.forEach(m => { m.x = Math.min(width, Math.max(0, m.x)); m.y = Math.min(height, Math.max(0, m.y)); });
      powerups.forEach(p => {
        p.x = Math.min(bounds.maxX, Math.max(bounds.minX, p.x));
        p.y = Math.min(bounds.maxY, Math.max(bounds.minY, p.y));
      });
    }

    function createSpiralGalaxyClusters(armCount, maxR) {
      const clusters = [];
      const starColors = ['#ffffff', '#cceeff', '#ffd9a8', '#e0b0ff', '#99ddff'];
      for (let arm = 0; arm < armCount; arm++) {
        const baseAngle = (arm / armCount) * Math.PI * 2;
        for (let i = 0; i < 48; i++) {
          const t = i / 48;
          const dist = Math.pow(t, .85) * maxR;
          const swirl = t * 3.8 + baseAngle + (Math.random() - .5) * .45;
          clusters.push({
            r: dist,
            theta: swirl,
            size: (1 - t * .6) * (1.2 + Math.random() * 2.2),
            alpha: (1 - t * .72) * (.35 + Math.random() * .55),
            color: starColors[Math.floor(Math.random() * starColors.length)]
          });
        }
      }
      return clusters;
    }

    function create3DBody(zOverride = null) {
      const types = ['spiral_galaxy', 'planet', 'wormhole', 'planet', 'asteroid_cluster'];
      const type = types[Math.floor(Math.random() * types.length)];
      const angle = Math.random() * Math.PI * 2;
      const dist = 190 + Math.random() * 580;

      const planetPalettes = [
        { hi: '#9be7ff', mid: '#2563eb', dark: '#040b1f', atmo: 'rgba(56, 189, 248, 0.35)', ring: 'rgba(186, 230, 253, 0.55)' },
        { hi: '#fed7aa', mid: '#c2410c', dark: '#1a0602', atmo: 'rgba(251, 146, 60, 0.32)', ring: 'rgba(254, 215, 170, 0.6)' },
        { hi: '#e9d5ff', mid: '#6b21a8', dark: '#0d031c', atmo: 'rgba(192, 132, 252, 0.34)', ring: 'rgba(233, 213, 255, 0.5)' },
        { hi: '#a7f3d0', mid: '#047857', dark: '#02140e', atmo: 'rgba(52, 211, 153, 0.30)', ring: 'rgba(167, 243, 208, 0.45)' }
      ];
      const pal = planetPalettes[Math.floor(Math.random() * planetPalettes.length)];

      const verts = [];
      const n = 12;
      for (let i = 0; i < n; i++) {
        const theta = (i / n) * Math.PI * 2;
        const v = .78 + Math.random() * .38;
        verts.push({ x: Math.cos(theta) * v, y: Math.sin(theta) * v });
      }

      const baseSize = type === 'spiral_galaxy' ? (95 + Math.random() * 65)
                     : type === 'wormhole' ? (68 + Math.random() * 40)
                     : type === 'planet' ? (44 + Math.random() * 44)
                     : (20 + Math.random() * 18);

      return {
        type,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        z: zOverride !== null ? zOverride : (850 + Math.random() * 1050),
        baseSize,
        hasRing: type === 'planet' && Math.random() < .6,
        ringTilt: (Math.random() - .5) * .75,
        tiltY: .42 + Math.random() * .35,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() < .5 ? 1 : -1) * (.004 + Math.random() * .01),
        palette: pal,
        vertices: verts,
        spiralClusters: type === 'spiral_galaxy' ? createSpiralGalaxyClusters(3, 1) : null
      };
    }

    function initMenu3DScene() {
      menuStars3D = [];
      menuBodies3D = [];
      const starColors = ['#ffffff', '#dbeafe', '#fef3c7', '#e0e7ff', '#bae6fd'];

      for (let i = 0; i < 240; i++) {
        menuStars3D.push({
          x: (Math.random() - .5) * 2200,
          y: (Math.random() - .5) * 2200,
          z: 30 + Math.random() * 1770,
          pz: 1800,
          color: starColors[Math.floor(Math.random() * starColors.length)],
          size: .6 + Math.random() * 1.4
        });
      }

      for (let i = 0; i < 16; i++) {
        menuBodies3D.push(create3DBody(220 + i * 110));
      }
    }

    function initGalaxyBackground() {
      const profile = getGraphicsProfile();
      stars = [];
      nebulaClouds = [];
      bgGalaxies = [];

      const starCount = Math.min(360, Math.max(60, Math.floor((width * height) / profile.starDensityDivisor)));
      const colors = ['#ffffff', '#dbeafe', '#fef3c7', '#e9d5ff', '#bae6fd'];
      for (let i = 0; i < starCount; i++) {
        const layer = Math.random();
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: layer > .88 ? 2.0 : layer > .45 ? 1.15 : .65,
          alpha: .28 + layer * .7,
          twinkleSpeed: .012 + Math.random() * .03,
          twinklePhase: Math.random() * Math.PI * 2,
          speedX: (Math.random() - .5) * .06,
          speedY: .05 + layer * .24,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }

      const cloudPalette = [
        ['rgba(88, 28, 135, 0.24)', 'rgba(30, 27, 75, 0.10)', 'rgba(2, 3, 8, 0)'],
        ['rgba(14, 116, 144, 0.20)', 'rgba(15, 23, 42, 0.09)', 'rgba(2, 3, 8, 0)'],
        ['rgba(157, 23, 77, 0.16)', 'rgba(49, 16, 47, 0.07)', 'rgba(2, 3, 8, 0)'],
        ['rgba(180, 83, 9, 0.14)', 'rgba(41, 20, 10, 0.06)', 'rgba(2, 3, 8, 0)']
      ];
      const maxDim = Math.max(width, height);
      for (let i = 0; i < profile.nebulaCount; i++) {
        const pal = cloudPalette[i % cloudPalette.length];
        nebulaClouds.push({
          xRatio: .1 + Math.random() * .8,
          yRatio: .1 + Math.random() * .8,
          radius: maxDim * (.26 + Math.random() * .24),
          driftAngle: Math.random() * Math.PI * 2,
          driftSpeed: .0002 + Math.random() * .00022,
          driftAmp: 24 + Math.random() * 32,
          colors: pal
        });
      }

      for (let i = 0; i < profile.galaxyCount; i++) {
        bgGalaxies.push({
          xRatio: i === 0 ? .24 : i === 1 ? .76 : .52,
          yRatio: i === 0 ? .32 : i === 1 ? .68 : .22,
          radius: maxDim * (.13 + Math.random() * .05),
          tilt: i === 0 ? -.48 : i === 1 ? .42 : -.22,
          tiltY: .44,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: .0012 * (i === 0 ? 1 : -1),
          coreTint: i === 0 ? 'rgba(186, 230, 253, 0.32)' : 'rgba(254, 215, 170, 0.28)',
          armTint: i === 0 ? 'rgba(147, 51, 234, 0.16)' : 'rgba(14, 165, 233, 0.15)',
          clusters: createSpiralGalaxyClusters(3, 1)
        });
      }

      if (menuStars3D.length === 0) initMenu3DScene();
    }

    function resizeCanvas() {
      resizeFrame = 0;
      const rect = gameWrapper.getBoundingClientRect();
      const nextWidth = Math.max(1, rect.width);
      const nextHeight = Math.max(1, rect.height);
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      const changed = Math.abs(nextWidth - width) > .5 || Math.abs(nextHeight - height) > .5;
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;

      updateOrientationHint();

      const pixelWidth = Math.max(1, Math.round(width * dpr));
      const pixelHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;

      if (changed || stars.length === 0) initGalaxyBackground();
      clampEntityPositionsAfterResize();
    }

    function scheduleResize() {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resizeCanvas);
    }

    if ('ResizeObserver' in window) {
      gameResizeObserver = new ResizeObserver(scheduleResize);
      gameResizeObserver.observe(gameWrapper);
    }
    window.addEventListener('resize', scheduleResize, { passive: true });
    window.addEventListener('orientationchange', scheduleResize, { passive: true });
    window.addEventListener('pageshow', scheduleResize, { passive: true });
    document.addEventListener('fullscreenchange', scheduleResize, { passive: true });
    document.addEventListener('webkitfullscreenchange', scheduleResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', scheduleResize, { passive: true });
      window.visualViewport.addEventListener('scroll', scheduleResize, { passive: true });
    }

    class Shockwave {
      constructor(x, y, maxRadius, color) { this.x = x; this.y = y; this.radius = 8; this.maxRadius = maxRadius; this.color = color; this.alpha = .9; }
      update(dt = 1) { this.radius += (this.maxRadius - this.radius) * Math.min(1, .14 * dt); this.alpha -= .04 * dt; }
      draw() {
        if (this.alpha <= 0) return;
        ctx.save(); ctx.globalAlpha = Math.max(0, this.alpha); ctx.strokeStyle = this.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }

    class FloatingText {
      constructor(x, y, text, color = '#38e8ff') { this.x = x; this.y = y; this.text = text; this.color = color; this.life = 45; this.maxLife = 45; }
      update(dt = 1) { this.y -= .8 * dt; this.life -= dt; }
      draw() {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.save(); ctx.globalAlpha = alpha; ctx.font = 'bold 14px Orbitron, sans-serif';
        ctx.fillStyle = this.color;
        ctx.textAlign = 'center'; ctx.fillText(this.text, this.x, this.y); ctx.restore();
      }
    }

    class Ship {
      constructor() {
        const bounds = getPlayfieldBounds();
        this.x = (bounds.minX + bounds.maxX) / 2; this.y = (bounds.minY + bounds.maxY) / 2;
        this.vx = 0; this.vy = 0; this.angle = -Math.PI / 2; this.radius = 16;
        this.invulnerable = 90; this.fireCooldown = 0; this.rapidFireTimer = 0;
        this.boostEnergy = 100; this.isBoosting = false;
        this.shieldActiveTimer = 0; this.shieldCooldown = 0; this.shieldMaxCooldown = 480;
        this.missileCooldown = 0; this.missileMaxCooldown = 240;
      }
      activateShield() {
        if (this.shieldCooldown <= 0 && this.shieldActiveTimer <= 0) {
          this.shieldActiveTimer = 210; this.shieldCooldown = this.shieldMaxCooldown;
          sfx.playShield(); shockwaves.push(new Shockwave(this.x, this.y, 65, '#00e676'));
          floatingTexts.push(new FloatingText(this.x, this.y - 28, 'SHIELD ONLINE', '#00e676'));
        }
      }
      launchMissile() {
        if (this.missileCooldown <= 0) {
          this.missileCooldown = this.missileMaxCooldown; sfx.playMissile();
          const nx = this.x + Math.cos(this.angle) * 22;
          const ny = this.y + Math.sin(this.angle) * 22;
          missiles.push(new HomingMissile(nx, ny, this.angle));
          floatingTexts.push(new FloatingText(this.x, this.y - 28, 'MISSILE LOCK', '#ffab00'));
        }
      }
      update(dt = 1) {
        if (keys.shield) this.activateShield();
        if (keys.missile) this.launchMissile();

        if (keys.boost && this.boostEnergy > 4) {
          this.isBoosting = true; this.boostEnergy = Math.max(0, this.boostEnergy - 1.4 * dt);
          if (Math.random() < .35 * dt) sfx.playBoost();
        } else {
          this.isBoosting = false; this.boostEnergy = Math.min(100, this.boostEnergy + .45 * dt);
        }

        const thrustMultiplier = this.isBoosting ? 1.85 : 1;
        const maxSpeed = this.isBoosting ? 13.5 : 8.5;
        if (joystick.active && joystick.force > .12) {
          let diff = joystick.angle - this.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          this.angle += diff * Math.min(1, .22 * dt);
          const thrust = .18 * joystick.force * thrustMultiplier * dt;
          this.vx += Math.cos(this.angle) * thrust; this.vy += Math.sin(this.angle) * thrust;
          this.emitThruster(this.isBoosting);
        } else {
          const rotSpeed = .085 * dt;
          if (keys.left) this.angle -= rotSpeed;
          if (keys.right) this.angle += rotSpeed;
          if (keys.up || this.isBoosting) {
            const thrust = .17 * thrustMultiplier * dt;
            this.vx += Math.cos(this.angle) * thrust; this.vy += Math.sin(this.angle) * thrust;
            this.emitThruster(this.isBoosting);
          }
        }

        const damping = Math.pow(.988, dt);
        this.vx *= damping; this.vy *= damping;
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > maxSpeed) { this.vx = this.vx / speed * maxSpeed; this.vy = this.vy / speed * maxSpeed; }

        const bounds = getPlayfieldBounds();
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.x < bounds.minX) { this.x = bounds.minX; if (this.vx < 0) this.vx *= -.25; }
        else if (this.x > bounds.maxX) { this.x = bounds.maxX; if (this.vx > 0) this.vx *= -.25; }
        if (this.y < bounds.minY) { this.y = bounds.minY; if (this.vy < 0) this.vy *= -.25; }
        else if (this.y > bounds.maxY) { this.y = bounds.maxY; if (this.vy > 0) this.vy *= -.25; }

        this.invulnerable = Math.max(0, this.invulnerable - dt);
        this.fireCooldown = Math.max(0, this.fireCooldown - dt);
        this.rapidFireTimer = Math.max(0, this.rapidFireTimer - dt);
        this.shieldActiveTimer = Math.max(0, this.shieldActiveTimer - dt);
        this.shieldCooldown = Math.max(0, this.shieldCooldown - dt);
        this.missileCooldown = Math.max(0, this.missileCooldown - dt);
        if (keys.fire && this.fireCooldown <= 0) this.shoot();

        boostBar.style.width = `${this.boostEnergy}%`;
        boostBtn.classList.toggle('cooldown', this.boostEnergy < 10);
        const shieldPct = this.shieldCooldown > 0 ? ((this.shieldMaxCooldown - this.shieldCooldown) / this.shieldMaxCooldown) * 100 : 100;
        shieldBar.style.width = `${shieldPct}%`; shieldBtn.classList.toggle('cooldown', this.shieldCooldown > 0);
        const missilePct = this.missileCooldown > 0 ? ((this.missileMaxCooldown - this.missileCooldown) / this.missileMaxCooldown) * 100 : 100;
        missileBar.style.width = `${missilePct}%`; missileBtn.classList.toggle('cooldown', this.missileCooldown > 0);
      }
      emitThruster(isBoost = false) {
        const maxP = getGraphicsProfile().maxParticles;
        if (particles.length >= maxP) return;
        const count = isBoost ? 2 : 1;
        for (let i = 0; i < count; i++) {
          if (Math.random() < .85 && particles.length < maxP) {
            const a = this.angle + Math.PI + (Math.random() - .5) * (isBoost ? .6 : .4);
            particles.push(new Particle(
              this.x - Math.cos(this.angle) * 16, this.y - Math.sin(this.angle) * 16,
              Math.cos(a) * (isBoost ? 4.5 : 2.5) + this.vx * .3,
              Math.sin(a) * (isBoost ? 4.5 : 2.5) + this.vy * .3,
              isBoost ? '#ffffff' : '#38e8ff', isBoost ? 24 : 18
            ));
          }
        }
        if (!isBoost && Math.random() < .3) sfx.playThrust();
      }
      shoot() {
        sfx.playLaser();
        const nx = this.x + Math.cos(this.angle) * 20;
        const ny = this.y + Math.sin(this.angle) * 20;
        if (this.rapidFireTimer > 0) {
          [-.14, 0, .14].forEach(offset => bullets.push(new Bullet(nx, ny, this.angle + offset, '#c77dff')));
          this.fireCooldown = 9;
        } else {
          bullets.push(new Bullet(nx, ny, this.angle, '#38e8ff')); this.fireCooldown = 13;
        }
      }
      draw() {
        const blink = this.invulnerable > 0 && Math.floor(this.invulnerable / 5) % 2 === 0;
        ctx.save(); ctx.translate(this.x, this.y);
        if (this.shieldActiveTimer > 0) {
          const pulse = 32 + Math.sin(performance.now() * .015) * 3;
          ctx.save(); ctx.strokeStyle = '#00e676'; ctx.fillStyle = 'rgba(0,230,118,.14)';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(0, 0, pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
        }
        if (!blink) {
          ctx.rotate(this.angle);
          ctx.strokeStyle = this.isBoosting ? '#fff' : (this.rapidFireTimer > 0 ? '#e066ff' : '#38e8ff');
          ctx.fillStyle = '#070b1e'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-14, -13); ctx.lineTo(-8, 0); ctx.lineTo(-14, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(3, 0, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
    }

    class Bullet {
      constructor(x, y, angle, color = '#38e8ff') {
        this.x = x; this.y = y; this.vx = Math.cos(angle) * 12; this.vy = Math.sin(angle) * 12;
        this.life = 55; this.color = color; this.radius = 3;
      }
      update(dt = 1) { this.x = (this.x + this.vx * dt + width) % width; this.y = (this.y + this.vy * dt + height) % height; this.life -= dt; }
      draw() {
        ctx.save(); ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * .75, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }

    class HomingMissile {
      constructor(x, y, angle) {
        this.x = x; this.y = y; this.angle = angle; this.speed = 9.5;
        this.vx = Math.cos(angle) * this.speed; this.vy = Math.sin(angle) * this.speed;
        this.life = 140; this.radius = 6;
      }
      update(dt = 1) {
        this.life -= dt;
        let closest = null; let minDist = Infinity;
        for (let i = 0; i < asteroids.length; i++) {
          const dist = Math.hypot(asteroids[i].x - this.x, asteroids[i].y - this.y);
          if (dist < minDist) { minDist = dist; closest = asteroids[i]; }
        }
        if (closest) {
          const targetAngle = Math.atan2(closest.y - this.y, closest.x - this.x);
          let diff = targetAngle - this.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          this.angle += diff * Math.min(1, .14 * dt);
        }
        this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed;
        this.x = (this.x + this.vx * dt + width) % width; this.y = (this.y + this.vy * dt + height) % height;
        const maxP = getGraphicsProfile().maxParticles;
        if (particles.length < maxP) {
          particles.push(new Particle(
            this.x - Math.cos(this.angle) * 8, this.y - Math.sin(this.angle) * 8,
            (Math.random() - .5) * 1.5, (Math.random() - .5) * 1.5, '#ffab00', 16
          ));
        }
      }
      draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        ctx.fillStyle = '#ffab00'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, -5); ctx.lineTo(-4, 0); ctx.lineTo(-7, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }

    class Asteroid {
      constructor(x, y, size = 3, customScale = null) {
        this.x = x;
        this.y = y;
        this.size = size;

        const screenScale = getAsteroidScale();
        if (customScale !== null) {
          this.sizeScale = customScale;
        } else if (size === 3) {
          this.sizeScale = 0.72 + Math.random() * 0.58;
        } else if (size === 2) {
          this.sizeScale = 0.82 + Math.random() * 0.36;
        } else {
          this.sizeScale = 0.85 + Math.random() * 0.35;
        }

        const baseRadius = size === 3 ? 44 : size === 2 ? 24 : 13;
        this.radius = baseRadius * screenScale * this.sizeScale;

        const baseSpeed = ((4 - size) * 0.72 + gameState.level * 0.2) / Math.sqrt(this.sizeScale);
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * baseSpeed;
        this.vy = Math.sin(angle) * baseSpeed;

        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.035;

        this.vertices = [];
        const n = 14 + Math.floor(Math.random() * 6);
        for (let i = 0; i < n; i++) {
          const theta = (i / n) * Math.PI * 2;
          const variance = 0.75 + Math.random() * 0.44;
          this.vertices.push({
            x: Math.cos(theta) * this.radius * variance,
            y: Math.sin(theta) * this.radius * variance
          });
        }

        const palettes = {
          3: {
            coreHot: '#ff9e7d',
            light: '#ef233c',
            mid: '#7f121f',
            dark: '#190408',
            rim: '#ff4d6d',
            glow: 'rgba(239, 35, 60, 0.28)',
            craterFill: 'rgba(10, 2, 5, 0.78)',
            craterRim: 'rgba(255, 140, 130, 0.36)',
            veinColor: 'rgba(255, 110, 75, 0.22)'
          },
          2: {
            coreHot: '#ffd180',
            light: '#fb6f24',
            mid: '#7c240d',
            dark: '#190803',
            rim: '#ff9e3d',
            glow: 'rgba(251, 111, 36, 0.22)',
            craterFill: 'rgba(14, 5, 2, 0.72)',
            craterRim: 'rgba(255, 200, 120, 0.3)',
            veinColor: 'rgba(255, 165, 60, 0.18)'
          },
          1: {
            coreHot: '#fff59d',
            light: '#f5b700',
            mid: '#6e4709',
            dark: '#171003',
            rim: '#ffe066',
            glow: 'rgba(245, 183, 0, 0.18)',
            craterFill: 'rgba(16, 11, 2, 0.68)',
            craterRim: 'rgba(255, 245, 165, 0.28)',
            veinColor: 'rgba(255, 225, 100, 0.15)'
          }
        };
        this.palette = palettes[size] || palettes[3];
        this.color = this.palette.rim;

        const detailFactor = getGraphicsProfile().craterDetail;
        this.craters = [];
        if (this.radius >= 10) {
          const baseCraters = size === 3 ? (5 + Math.floor(Math.random() * 3)) : (2 + Math.floor(Math.random() * 3));
          const craterCount = Math.max(2, Math.round(baseCraters * detailFactor));
          for (let c = 0; c < craterCount; c++) {
            const cDist = (0.14 + Math.random() * 0.48) * this.radius;
            const cAngle = Math.random() * Math.PI * 2;
            const cRadius = Math.max(2.0, this.radius * (0.10 + Math.random() * 0.13));
            this.craters.push({
              x: Math.cos(cAngle) * cDist,
              y: Math.sin(cAngle) * cDist,
              r: cRadius,
              rot: Math.random() * Math.PI * 2
            });
          }
        }

        this.ridges = [];
        const ridgeCount = size === 3 ? 3 : 2;
        for (let r = 0; r < ridgeCount; r++) {
          const a1 = Math.random() * Math.PI * 2;
          const d1 = this.radius * (0.2 + Math.random() * 0.35);
          const a2 = a1 + (Math.random() - 0.5) * 1.1;
          const d2 = d1 + this.radius * (0.2 + Math.random() * 0.25);
          this.ridges.push({
            x1: Math.cos(a1) * d1,
            y1: Math.sin(a1) * d1,
            x2: Math.cos(a2) * d2,
            y2: Math.sin(a2) * d2
          });
        }
      }

      update(dt = 1) {
        this.x = (this.x + this.vx * dt + width) % width;
        this.y = (this.y + this.vy * dt + height) % height;
        this.rotation += this.rotSpeed * dt;
      }

      tracePath() {
        ctx.beginPath();
        this.vertices.forEach((v, i) => {
          if (i === 0) ctx.moveTo(v.x, v.y);
          else ctx.lineTo(v.x, v.y);
        });
        ctx.closePath();
      }

      draw() {
        const profile = getGraphicsProfile();
        ctx.save();
        ctx.translate(this.x, this.y);

        if (profile.glowEnabled && this.size === 3) {
          const aura = ctx.createRadialGradient(0, 0, this.radius * 0.55, 0, 0, this.radius * 1.45);
          aura.addColorStop(0, this.palette.glow);
          aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = aura;
          ctx.beginPath();
          ctx.arc(0, 0, this.radius * 1.45, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.rotate(this.rotation);

        this.tracePath();
        const grad = ctx.createRadialGradient(
          -this.radius * 0.38,
          -this.radius * 0.38,
          this.radius * 0.05,
          this.radius * 0.12,
          this.radius * 0.12,
          this.radius * 1.28
        );
        grad.addColorStop(0, this.palette.coreHot);
        grad.addColorStop(0.24, this.palette.light);
        grad.addColorStop(0.62, this.palette.mid);
        grad.addColorStop(0.9, this.palette.dark);
        grad.addColorStop(1, '#040307');

        ctx.fillStyle = grad;
        ctx.fill();

        ctx.save();
        ctx.clip();

        ctx.strokeStyle = this.palette.veinColor;
        ctx.lineWidth = Math.max(1, this.radius * 0.035);
        this.ridges.forEach(rg => {
          ctx.beginPath();
          ctx.moveTo(rg.x1, rg.y1);
          ctx.lineTo(rg.x2, rg.y2);
          ctx.stroke();
        });

        this.craters.forEach(cr => {
          ctx.save();
          ctx.translate(cr.x, cr.y);
          ctx.rotate(cr.rot);
          ctx.scale(1, 0.82);

          const cGrad = ctx.createRadialGradient(-cr.r * 0.2, -cr.r * 0.2, cr.r * 0.1, 0, 0, cr.r);
          cGrad.addColorStop(0, this.palette.craterFill);
          cGrad.addColorStop(0.8, 'rgba(25, 6, 12, 0.55)');
          cGrad.addColorStop(1, 'rgba(255, 130, 120, 0.12)');
          ctx.fillStyle = cGrad;
          ctx.beginPath();
          ctx.arc(0, 0, cr.r, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = this.palette.craterRim;
          ctx.lineWidth = Math.max(0.8, cr.r * 0.14);
          ctx.beginPath();
          ctx.arc(0, 0, cr.r * 0.92, Math.PI * 0.85, Math.PI * 1.95);
          ctx.stroke();

          ctx.restore();
        });

        ctx.restore();

        this.tracePath();
        ctx.strokeStyle = this.palette.rim;
        ctx.lineWidth = Math.max(1.5, 2.3 * (this.radius / 44));
        ctx.stroke();

        ctx.restore();
      }
    }

    class Particle {
      constructor(x, y, vx, vy, color, maxLife = 30) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.color = color;
        this.life = maxLife; this.maxLife = maxLife; this.radius = Math.random() * 2.5 + 1;
      }
      update(dt = 1) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        const damp = Math.pow(.96, dt); this.vx *= damp; this.vy *= damp; this.life -= dt;
      }
      draw() {
        ctx.save(); ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }

    class PowerUp {
      constructor(x, y) { this.x = x; this.y = y; this.radius = 14; this.type = Math.random() < .65 ? 'TRIPLE' : 'SHIELD'; this.life = 450; this.pulse = 0; }
      update(dt = 1) { this.life -= dt; this.pulse += .1 * dt; }
      draw() {
        const scale = 1 + Math.sin(this.pulse) * .15; const color = this.type === 'TRIPLE' ? '#c77dff' : '#00e676';
        ctx.save(); ctx.translate(this.x, this.y); ctx.scale(scale, scale);
        ctx.strokeStyle = color; ctx.fillStyle = 'rgba(10,15,30,.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(this.type === 'TRIPLE' ? '⚡' : '✚', 0, 1); ctx.restore();
      }
    }

    function getAsteroidPoints(size) { return size === 3 ? 15 : size === 2 ? 25 : 40; }

    function spawnExplosion(x, y, color, count = 16) {
      const profile = getGraphicsProfile();
      const scaledCount = Math.round(count * profile.particleMultiplier);
      const safeCount = Math.min(scaledCount, Math.max(0, profile.maxParticles - particles.length));
      for (let i = 0; i < safeCount; i++) {
        const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 4.5 + 1;
        particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, 25 + Math.random() * 20));
      }
    }

    function addScoreWithCombo(basePoints, x, y, color) {
      gameState.comboTimer = 110;
      const earned = basePoints * gameState.combo;
      gameState.score += earned;
      floatingTexts.push(new FloatingText(x, y, `+${earned}`, color));
      if (gameState.combo < MAX_COMBO) gameState.combo++;
      updateHUD();
    }

    function spawnAsteroidsForLevel(level) {
      const count = 3 + level;
      for (let i = 0; i < count; i++) {
        let x = 0, y = 0, attempts = 0;
        do {
          x = Math.random() * width; y = Math.random() * height; attempts++;
        } while (ship && Math.hypot(x - ship.x, y - ship.y) < 160 && attempts < 30);
        asteroids.push(new Asteroid(x, y, 3));
      }
    }

    function updateHUD() {
      scoreDisplay.textContent = gameState.score.toLocaleString();
      levelDisplay.textContent = String(gameState.level);
      if (gameState.combo > 1) { comboBadge.textContent = `x${gameState.combo} COMBO`; comboBadge.classList.add('visible'); }
      else comboBadge.classList.remove('visible');

      if (gameState.lives !== renderedLivesCount) {
        renderedLivesCount = gameState.lives;
        livesContainer.replaceChildren();
        for (let i = 0; i < gameState.lives; i++) {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('width', '17'); svg.setAttribute('height', '17'); svg.setAttribute('viewBox', '-15 -15 30 30');
          const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          polygon.setAttribute('points', '0,-12 10,10 0,5 -10,10');
          polygon.setAttribute('fill', '#38e8ff'); polygon.setAttribute('stroke', '#fff'); polygon.setAttribute('stroke-width', '1.5');
          svg.appendChild(polygon); livesContainer.appendChild(svg);
        }
      }
    }

    function clearInputState() {
      Object.keys(keys).forEach(k => { keys[k] = false; });
      joystick.active = false; joystick.force = 0; joystickPointerId = null;
      joystickKnob.style.transition = 'transform .15s ease-out';
      joystickKnob.style.transform = 'translate(0,0)';
      document.querySelectorAll('.btn-tactical.active').forEach(btn => btn.classList.remove('active'));
      activeButtonPointers.forEach(set => set.clear());
    }

    function startGame() {
      enterFullscreenAndLandscape();
      sfx.init();
      startScreen.classList.add('hidden');
      pauseScreen.classList.add('hidden');
      gameoverScreen.classList.add('hidden');
      gameWrapper.classList.remove('menu-mode');
      pauseBtn.textContent = 'Ⅱ';

      resizeCanvas();
      renderedLivesCount = -1;
      gameState.running = true; gameState.paused = false; gameState.score = 0;
      gameState.level = 1; gameState.lives = 3; gameState.combo = 1;
      gameState.comboTimer = 0; gameState.screenShake = 0;
      bullets = []; missiles = []; asteroids = []; particles = []; shockwaves = []; powerups = []; floatingTexts = [];
      ship = new Ship();
      spawnAsteroidsForLevel(gameState.level);
      updateHUD();
      clearInputState();
      lastFrameTime = performance.now();
    }

    function gameOver() {
      gameState.running = false; gameState.paused = false; clearInputState(); pauseScreen.classList.add('hidden');
      if (gameState.score > gameState.highScore) { gameState.highScore = gameState.score; saveHighScore(gameState.highScore); }
      finalScoreText.textContent = `Final Score: ${gameState.score.toLocaleString()}  •  Best Score: ${gameState.highScore.toLocaleString()}`;
      gameoverScreen.classList.remove('hidden');
    }

    function togglePause(forceResume = false) {
      if (!gameState.running) return;
      gameState.paused = forceResume ? false : !gameState.paused;
      pauseBtn.textContent = gameState.paused ? '▶' : 'Ⅱ';
      pauseScreen.classList.toggle('hidden', !gameState.paused);
      if (gameState.paused) {
        syncSoundUI();
        syncGraphicsUI();
        clearInputState();
      }
    }

    function destroyAsteroidAtIndex(index, spawnChildren = true, awardColor = null) {
      const asteroid = asteroids[index];
      if (!asteroid) return;
      const x = asteroid.x;
      const y = asteroid.y;
      const size = asteroid.size;
      const color = awardColor || asteroid.color;

      sfx.playExplosion(size);
      spawnExplosion(x, y, color, size * 5);
      shockwaves.push(new Shockwave(x, y, asteroid.radius * 1.4, color));
      gameState.screenShake = Math.min(10, size * 2);
      addScoreWithCombo(getAsteroidPoints(size), x, y, color);

      asteroids.splice(index, 1);

      if (spawnChildren) {
        if (size > 1) {
          asteroids.push(new Asteroid(x, y, size - 1));
          asteroids.push(new Asteroid(x, y, size - 1));
        } else if (Math.random() < .2) {
          powerups.push(new PowerUp(x, y));
        }
      }
    }

    function updateGame(dt = 1) {
      if (!gameState.running || gameState.paused || !ship) return;
      if (gameState.screenShake > 0) gameState.screenShake = Math.max(0, gameState.screenShake - dt);
      if (gameState.comboTimer > 0) {
        gameState.comboTimer -= dt;
        if (gameState.comboTimer <= 0) { gameState.combo = 1; updateHUD(); }
      }

      ship.update(dt);
      for (let i = bullets.length - 1; i >= 0; i--) { bullets[i].update(dt); if (bullets[i].life <= 0) bullets.splice(i, 1); }
      for (let i = missiles.length - 1; i >= 0; i--) { missiles[i].update(dt); if (missiles[i].life <= 0) missiles.splice(i, 1); }
      for (let i = 0; i < asteroids.length; i++) asteroids[i].update(dt);
      for (let i = particles.length - 1; i >= 0; i--) { particles[i].update(dt); if (particles[i].life <= 0) particles.splice(i, 1); }
      for (let i = shockwaves.length - 1; i >= 0; i--) { shockwaves[i].update(dt); if (shockwaves[i].alpha <= 0) shockwaves.splice(i, 1); }
      for (let i = floatingTexts.length - 1; i >= 0; i--) { floatingTexts[i].update(dt); if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1); }

      for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i]; p.update(dt);
        if (p.life <= 0) { powerups.splice(i, 1); continue; }
        if (Math.hypot(ship.x - p.x, ship.y - p.y) < ship.radius + p.radius) {
          sfx.playPowerup();
          if (p.type === 'TRIPLE') { ship.rapidFireTimer = 420; floatingTexts.push(new FloatingText(ship.x, ship.y - 24, 'TRIPLE LASER!', '#c77dff')); }
          else {
            if (gameState.lives < 5) gameState.lives++;
            ship.shieldActiveTimer = Math.max(ship.shieldActiveTimer, 180);
            floatingTexts.push(new FloatingText(ship.x, ship.y - 24, 'HULL + SHIELD!', '#00e676')); updateHUD();
          }
          spawnExplosion(p.x, p.y, '#00e676', 12); powerups.splice(i, 1);
        }
      }

      for (let b = bullets.length - 1; b >= 0; b--) {
        const bullet = bullets[b];
        if (!bullet) continue;
        for (let a = asteroids.length - 1; a >= 0; a--) {
          const asteroid = asteroids[a];
          if (!asteroid) continue;
          if (Math.hypot(bullet.x - asteroid.x, bullet.y - asteroid.y) < asteroid.radius + bullet.radius) {
            bullets.splice(b, 1);
            destroyAsteroidAtIndex(a, true);
            break;
          }
        }
      }

      for (let m = missiles.length - 1; m >= 0; m--) {
        const missile = missiles[m];
        if (!missile) continue;
        let detonated = false;
        for (let a = asteroids.length - 1; a >= 0; a--) {
          const asteroid = asteroids[a];
          if (!asteroid) continue;
          if (Math.hypot(missile.x - asteroid.x, missile.y - asteroid.y) < asteroid.radius + missile.radius + 6) {
            detonated = true;
            break;
          }
        }
        if (detonated) {
          const mx = missile.x;
          const my = missile.y;
          missiles.splice(m, 1);
          sfx.playExplosion(3);
          spawnExplosion(mx, my, '#ffab00', 22);
          shockwaves.push(new Shockwave(mx, my, 125, '#ffab00'));
          gameState.screenShake = 10;

          for (let a = asteroids.length - 1; a >= 0; a--) {
            const asteroid = asteroids[a];
            if (!asteroid) continue;
            if (Math.hypot(mx - asteroid.x, my - asteroid.y) < 115 + asteroid.radius) {
              destroyAsteroidAtIndex(a, true, '#ffab00');
            }
          }
        }
      }

      for (let a = asteroids.length - 1; a >= 0; a--) {
        const asteroid = asteroids[a];
        if (!asteroid || !ship) continue;
        const isShielded = ship.shieldActiveTimer > 0;
        const hitDistance = isShielded ? 34 + asteroid.radius : ship.radius + asteroid.radius - 3;

        if (Math.hypot(ship.x - asteroid.x, ship.y - asteroid.y) < hitDistance) {
          if (isShielded) {
            destroyAsteroidAtIndex(a, true, '#00e676');
            continue;
          }

          if (ship.invulnerable <= 0) {
            sfx.playExplosion(3);
            spawnExplosion(ship.x, ship.y, '#38e8ff', 24);
            shockwaves.push(new Shockwave(ship.x, ship.y, 90, '#ff3366'));
            gameState.screenShake = 12;
            gameState.lives = Math.max(0, gameState.lives - 1);
            gameState.combo = 1;
            updateHUD();

            if (gameState.lives <= 0) {
              gameOver();
              return;
            }

            const bounds = getPlayfieldBounds();
            ship.x = (bounds.minX + bounds.maxX) / 2;
            ship.y = (bounds.minY + bounds.maxY) / 2;
            ship.vx = 0;
            ship.vy = 0;
            ship.invulnerable = 90;
            break;
          }
        }
      }

      if (asteroids.length === 0) {
        gameState.level++;
        addScoreWithCombo(50 * gameState.level, width / 2, height / 2 - 20, '#c77dff');
        updateHUD();
        floatingTexts.push(new FloatingText(width / 2, height / 2 - 48, `LEVEL ${gameState.level}`, '#c77dff'));
        spawnAsteroidsForLevel(gameState.level);
      }
    }

    function renderSpiralGalaxy(radius, rot, tiltY, coreTint, armTint, clusters) {
      ctx.save();
      ctx.scale(1, tiltY);
      ctx.rotate(rot);

      const discGrad = ctx.createRadialGradient(0, 0, radius * .02, 0, 0, radius * 1.15);
      discGrad.addColorStop(0, 'rgba(255, 252, 240, 0.92)');
      discGrad.addColorStop(.16, coreTint);
      discGrad.addColorStop(.52, armTint);
      discGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = discGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.15, 0, Math.PI * 2);
      ctx.fill();

      if (clusters) {
        for (let i = 0; i < clusters.length; i++) {
          const c = clusters[i];
          const px = Math.cos(c.theta) * (c.r * radius);
          const py = Math.sin(c.theta) * (c.r * radius);
          ctx.globalAlpha = c.alpha;
          ctx.fillStyle = c.color;
          ctx.beginPath();
          ctx.arc(px, py, Math.max(.6, c.size * (radius / 110)), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    function draw3DWarpLaunchScene(dt = 1) {
      gameState.galaxyTime += dt;
      const cx = width * .5;
      const cy = height * .5;
      const fov = Math.min(width, height) * .72;

      ctx.fillStyle = '#020308';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-.32);
      const milkyWay = ctx.createLinearGradient(0, -height * .45, 0, height * .45);
      milkyWay.addColorStop(0, 'rgba(2, 3, 8, 0)');
      milkyWay.addColorStop(.32, 'rgba(30, 41, 82, 0.22)');
      milkyWay.addColorStop(.5, 'rgba(88, 56, 138, 0.26)');
      milkyWay.addColorStop(.68, 'rgba(20, 62, 92, 0.20)');
      milkyWay.addColorStop(1, 'rgba(2, 3, 8, 0)');
      ctx.fillStyle = milkyWay;
      ctx.fillRect(-width, -height * .45, width * 2, height * .9);
      ctx.restore();

      nebulaClouds.forEach((cloud, idx) => {
        const orbit = gameState.galaxyTime * .0025 + idx * 1.25;
        const nx = cx + Math.cos(orbit) * (width * .32);
        const ny = cy + Math.sin(orbit * .85) * (height * .26);
        const rad = cloud.radius * .85;
        const grad = ctx.createRadialGradient(nx, ny, rad * .04, nx, ny, rad);
        grad.addColorStop(0, cloud.colors[0]);
        grad.addColorStop(.55, cloud.colors[1]);
        grad.addColorStop(1, cloud.colors[2]);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(nx, ny, rad, 0, Math.PI * 2);
        ctx.fill();
      });

      const starSpeed = 7.2 * dt;
      for (let i = 0; i < menuStars3D.length; i++) {
        const s = menuStars3D[i];
        s.pz = s.z;
        s.z -= starSpeed;
        if (s.z <= 18) {
          s.x = (Math.random() - .5) * 2200;
          s.y = (Math.random() - .5) * 2200;
          s.z = 1780;
          s.pz = 1780;
        }
        const sx = cx + (s.x / s.z) * fov;
        const sy = cy + (s.y / s.z) * fov;
        const px = cx + (s.x / s.pz) * fov;
        const py = cy + (s.y / s.pz) * fov;
        const alpha = Math.min(.95, (1800 - s.z) / 950);
        const thickness = Math.max(.7, (1 - s.z / 1800) * 2.2 * s.size);

        ctx.strokeStyle = s.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const bodySpeed = 3.8 * dt;
      for (let i = 0; i < menuBodies3D.length; i++) {
        const b = menuBodies3D[i];
        b.z -= bodySpeed;
        b.rot += b.rotSpeed * dt;
        if (b.z <= 55) {
          menuBodies3D[i] = create3DBody(1650 + Math.random() * 250);
        }
      }
      menuBodies3D.sort((a, b) => b.z - a.z);

      for (let i = 0; i < menuBodies3D.length; i++) {
        const b = menuBodies3D[i];
        const scale = fov / b.z;
        const sx = cx + b.x * scale;
        const sy = cy + b.y * scale;
        const r = b.baseSize * scale;

        if (sx + r * 2.5 < 0 || sx - r * 2.5 > width || sy + r * 2.5 < 0 || sy - r * 2.5 > height) continue;

        const fadeIn = Math.min(1, (1800 - b.z) / 420);
        const fadeOut = Math.min(1, (b.z - 55) / 140);
        const alpha = Math.max(0, Math.min(1, fadeIn * fadeOut));

        ctx.save();
        ctx.translate(sx, sy);
        ctx.globalAlpha = alpha;

        if (b.type === 'planet') {
          const atmoGrad = ctx.createRadialGradient(0, 0, r * .88, 0, 0, r * 1.24);
          atmoGrad.addColorStop(0, b.palette.atmo);
          atmoGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = atmoGrad;
          ctx.beginPath();
          ctx.arc(0, 0, r * 1.24, 0, Math.PI * 2);
          ctx.fill();

          if (b.hasRing) {
            ctx.save();
            ctx.rotate(b.ringTilt);
            ctx.strokeStyle = b.palette.ring;
            ctx.lineWidth = Math.max(1.5, r * .14);
            ctx.beginPath();
            ctx.ellipse(0, 0, r * 2.1, r * .46, 0, Math.PI, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          const pGrad = ctx.createRadialGradient(-r * .36, -r * .36, r * .08, 0, 0, r);
          pGrad.addColorStop(0, b.palette.hi);
          pGrad.addColorStop(.48, b.palette.mid);
          pGrad.addColorStop(.88, b.palette.dark);
          pGrad.addColorStop(1, '#020308');

          ctx.fillStyle = pGrad;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();

          if (b.hasRing) {
            ctx.save();
            ctx.rotate(b.ringTilt);
            ctx.strokeStyle = b.palette.ring;
            ctx.lineWidth = Math.max(1.5, r * .14);
            ctx.beginPath();
            ctx.ellipse(0, 0, r * 2.1, r * .46, 0, 0, Math.PI);
            ctx.stroke();
            ctx.restore();
          }
        } else if (b.type === 'spiral_galaxy') {
          ctx.rotate(b.ringTilt);
          renderSpiralGalaxy(
            r * 1.45,
            b.rot,
            b.tiltY,
            'rgba(186, 230, 253, 0.55)',
            'rgba(139, 92, 246, 0.28)',
            b.spiralClusters
          );
        } else if (b.type === 'wormhole') {
          ctx.rotate(b.rot);
          const portalGrad = ctx.createRadialGradient(0, 0, r * .15, 0, 0, r * 1.35);
          portalGrad.addColorStop(0, '#010104');
          portalGrad.addColorStop(.38, '#020410');
          portalGrad.addColorStop(.52, 'rgba(192, 132, 252, 0.72)');
          portalGrad.addColorStop(.68, 'rgba(56, 189, 248, 0.35)');
          portalGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = portalGrad;
          ctx.beginPath();
          ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(224, 242, 254, 0.65)';
          ctx.lineWidth = Math.max(1.2, r * .05);
          ctx.beginPath();
          ctx.ellipse(0, 0, r * .82, r * .55, .3, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.rotate(b.rot);
          const aGrad = ctx.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r);
          aGrad.addColorStop(0, '#475569');
          aGrad.addColorStop(.6, '#1e293b');
          aGrad.addColorStop(1, '#090d16');
          ctx.fillStyle = aGrad;
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
          ctx.lineWidth = Math.max(1, r * .05);
          ctx.beginPath();
          b.vertices.forEach((v, idx) => {
            if (idx === 0) ctx.moveTo(v.x * r, v.y * r);
            else ctx.lineTo(v.x * r, v.y * r);
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
      }
    }

    function drawGalaxyBackground(dt = 1) {
      const animSpeed = gameState.running && !gameState.paused ? dt : .55 * dt;
      gameState.galaxyTime += animSpeed;

      ctx.fillStyle = '#020308';
      ctx.fillRect(0, 0, width, height);

      const baseGlow = ctx.createRadialGradient(
        width * .5, height * .46, 20,
        width * .5, height * .46, Math.max(width, height) * .82
      );
      baseGlow.addColorStop(0, 'rgba(28, 22, 68, .38)');
      baseGlow.addColorStop(.55, 'rgba(9, 16, 40, .24)');
      baseGlow.addColorStop(1, 'rgba(2, 3, 8, 0)');
      ctx.fillStyle = baseGlow;
      ctx.fillRect(0, 0, width, height);

      nebulaClouds.forEach(cloud => {
        const cx = cloud.xRatio * width + Math.cos(gameState.galaxyTime * cloud.driftSpeed * 12 + cloud.driftAngle) * cloud.driftAmp;
        const cy = cloud.yRatio * height + Math.sin(gameState.galaxyTime * cloud.driftSpeed * 10 + cloud.driftAngle) * (cloud.driftAmp * .7);
        const grad = ctx.createRadialGradient(cx, cy, cloud.radius * .05, cx, cy, cloud.radius);
        grad.addColorStop(0, cloud.colors[0]);
        grad.addColorStop(.52, cloud.colors[1]);
        grad.addColorStop(1, cloud.colors[2]);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, cloud.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      bgGalaxies.forEach(gal => {
        gal.rot += gal.rotSpeed * animSpeed;
        ctx.save();
        ctx.translate(gal.xRatio * width, gal.yRatio * height);
        ctx.rotate(gal.tilt);
        ctx.globalAlpha = .72;
        renderSpiralGalaxy(gal.radius, gal.rot, gal.tiltY, gal.coreTint, gal.armTint, gal.clusters);
        ctx.restore();
      });

      stars.forEach(star => {
        star.x = (star.x + star.speedX * animSpeed + width) % width;
        star.y = (star.y + star.speedY * animSpeed) % height;
        star.twinklePhase += star.twinkleSpeed * animSpeed;
        const pulse = .74 + .26 * Math.sin(star.twinklePhase);
        ctx.globalAlpha = Math.max(.08, Math.min(1, star.alpha * pulse));
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    function drawGame(dt = 1) {
      ctx.save();
      if (gameState.screenShake > 0) {
        ctx.translate((Math.random() - .5) * gameState.screenShake, (Math.random() - .5) * gameState.screenShake);
      }
      ctx.clearRect(-20, -20, width + 40, height + 40);

      if (!startScreen.classList.contains('hidden')) {
        draw3DWarpLaunchScene(dt);
      } else {
        drawGalaxyBackground(dt);
        if (gameState.running) {
          powerups.forEach(p => p.draw()); shockwaves.forEach(s => s.draw()); asteroids.forEach(a => a.draw());
          bullets.forEach(b => b.draw()); missiles.forEach(m => m.draw()); particles.forEach(p => p.draw());
          floatingTexts.forEach(f => f.draw()); if (ship) ship.draw();
        }
      }
      ctx.restore();
    }

    function gameLoop(now) {
      const rawDelta = (now - lastFrameTime) / (1000 / 60);
      lastFrameTime = now;
      const dt = Math.min(2.5, Math.max(.1, rawDelta || 1));
      try {
        updateGame(dt);
      } catch (err) {
        console.error('Game update error:', err);
      }
      drawGame(dt);
      requestAnimationFrame(gameLoop);
    }

    window.addEventListener('keydown', e => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.left = true;
      if (['ArrowRight', 'KeyD'].includes(e.code)) keys.right = true;
      if (['ArrowUp', 'KeyW'].includes(e.code)) keys.up = true;
      if (e.code === 'Space') { e.preventDefault(); keys.fire = true; }
      if (['ShiftLeft', 'ShiftRight'].includes(e.code)) keys.boost = true;
      if (e.code === 'KeyE') keys.shield = true;
      if (e.code === 'KeyQ') keys.missile = true;
      if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) togglePause();
    });

    window.addEventListener('keyup', e => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.left = false;
      if (['ArrowRight', 'KeyD'].includes(e.code)) keys.right = false;
      if (['ArrowUp', 'KeyW'].includes(e.code)) keys.up = false;
      if (e.code === 'Space') keys.fire = false;
      if (['ShiftLeft', 'ShiftRight'].includes(e.code)) keys.boost = false;
      if (e.code === 'KeyE') keys.shield = false;
      if (e.code === 'KeyQ') keys.missile = false;
    });

    let joystickPointerId = null;
    function updateJoystickPosition(clientX, clientY) {
      const rect = joystickZone.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxRadius = Math.max(1, rect.width / 2 - 14);
      let dx = clientX - centerX; let dy = clientY - centerY;
      const distance = Math.hypot(dx, dy);
      if (distance > maxRadius) { dx = dx / distance * maxRadius; dy = dy / distance * maxRadius; }
      joystickKnob.style.transition = 'none';
      joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      joystick.active = true; joystick.angle = Math.atan2(dy, dx);
      joystick.force = Math.min(distance / maxRadius, 1);
    }

    function resetJoystick() {
      joystick.active = false; joystick.force = 0; joystickPointerId = null;
      joystickKnob.style.transition = 'transform .15s ease-out';
      joystickKnob.style.transform = 'translate(0,0)';
    }

    joystickZone.addEventListener('pointerdown', e => {
      if (joystickPointerId !== null) return;
      e.preventDefault(); sfx.init(); joystickPointerId = e.pointerId;
      try { joystickZone.setPointerCapture(e.pointerId); } catch (_) {}
      updateJoystickPosition(e.clientX, e.clientY);
    });
    joystickZone.addEventListener('pointermove', e => {
      if (e.pointerId === joystickPointerId) { e.preventDefault(); updateJoystickPosition(e.clientX, e.clientY); }
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
      joystickZone.addEventListener(type, e => { if (e.pointerId === joystickPointerId) resetJoystick(); });
    });

    const activeButtonPointers = new Map();
    function bindControlButton(btn, keyName) {
      const ids = new Set(); activeButtonPointers.set(btn, ids);
      btn.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault(); e.stopPropagation(); sfx.init();
        ids.add(e.pointerId); keys[keyName] = true; btn.classList.add('active');
        try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      });
      const release = e => {
        if (!ids.has(e.pointerId)) return;
        ids.delete(e.pointerId); keys[keyName] = ids.size > 0;
        btn.classList.toggle('active', ids.size > 0);
      };
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => btn.addEventListener(type, release));
      btn.addEventListener('contextmenu', e => e.preventDefault());
    }

    bindControlButton(fireBtn, 'fire');
    bindControlButton(missileBtn, 'missile');
    bindControlButton(boostBtn, 'boost');
    bindControlButton(shieldBtn, 'shield');

    window.addEventListener('blur', clearInputState);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { clearInputState(); if (gameState.running && !gameState.paused) togglePause(); }
    });

    startBtn.addEventListener('click', startGame);
    resumeBtn.addEventListener('click', () => togglePause(true));
    restartBtn.addEventListener('click', startGame);
    settingsRestartBtn.addEventListener('click', startGame);
    settingsMenuBtn.addEventListener('click', () => {
      gameState.running = false;
      gameState.paused = false;
      clearInputState();
      gameWrapper.classList.add('menu-mode');
      pauseBtn.textContent = 'Ⅱ';
      pauseScreen.classList.add('hidden');
      gameoverScreen.classList.add('hidden');
      startScreen.classList.remove('hidden');
    });
    settingsSoundBtn.addEventListener('click', () => {
      sfx.muted = !sfx.muted;
      syncSoundUI();
    });
    settingsGraphicsBtn.addEventListener('click', cycleGraphicsQuality);
    pauseBtn.addEventListener('click', () => togglePause());
    muteBtn.addEventListener('click', () => {
      sfx.muted = !sfx.muted;
      syncSoundUI();
    });

    syncSoundUI();
    syncGraphicsUI();
    resizeCanvas();
    updateHUD();
    requestAnimationFrame(gameLoop);

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(error => {
          console.warn('Service worker registration failed:', error);
        });
      });
    }
