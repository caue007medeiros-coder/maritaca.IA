// ==========================
// RINGUE 2D — Jogo de Boxe Arcade
// ==========================
// Tudo em JS puro — sem dependências externas

// --- CONSTANTES DO JOGO ---
const GAME = {
  RING_WIDTH: 800,
  RING_HEIGHT: 480,
  RING_PADDING: 32,     // espaço das bordas do ringue
  RING_ROPE_Y: [40, 240, 440],

  BOXER_WIDTH: 96,
  BOXER_HEIGHT: 128,
  BOXER_GROUND_Y: 72,   // posição base (bottom) no ringue
  BOXER_START_X: {
    P1: 160,
    P2: 644  // 800 - 160 - 96 = 644
  },

  PUNCH_RANGE: 92,      // alcance do soco (pixels)
  PUNCH_DURATION: 180,  // duração da animação do soco (ms)
  IMPACT_DURATION: 160, // flash de impacto (ms)
  ROUND_TIME: 60,       // segundos por round
  MAX_SCORE: 5          // rounds para vencer
};

// --- ESTADOS DO JOGO ---
const STATE = {
  // ⚠️ CRÍTICO: começa rodando, não pausado
  current: 'RUNNING',   // 'RUNNING', 'PAUSED', 'ENDED'
  roundTimer: GAME.ROUND_TIME,
  intervalId: null,
  lastFrame: 0
};

// Elementos do DOM
const startScreen = document.getElementById('start-screen');
const gameArea = document.getElementById('game-area');
const endScreen = document.getElementById('end-screen');
const pauseOverlay = document.getElementById('pause-overlay');

// Boxeadores e HUD
const p1 = {
  el: document.getElementById('p1'),
  sprite: document.getElementById('p1-sprite'),
  healthBar: document.getElementById('p1-health'),
  scoreEl: document.getElementById('p1-score'),
  x: GAME.BOXER_START_X.P1,
  y: GAME.BOXER_GROUND_Y,
  health: 100,
  score: 0,
  facing: 1,           // 1 = direita, -1 = esquerda
  punching: false,
  punchCooldown: 0
};

const p2 = {
  el: document.getElementById('p2'),
  sprite: document.getElementById('p2-sprite'),
  healthBar: document.getElementById('p2-health'),
  scoreEl: document.getElementById('p2-score'),
  x: GAME.BOXER_START_X.P2,
  y: GAME.BOXER_GROUND_Y,
  health: 100,
  score: 0,
  facing: -1,
  punching: false,
  punchCooldown: 0
};

// SVG Sprites embutidos (personagens originais)
function getBoxerSVG(player) {
  // Player 1 = azul; Player 2 = vermelho
  const color = player === 'p1' ? '#38bdf8' : '#ef4444';
  const accent = player === 'p1' ? '#0ea5e9' : '#b91c1c';

  return `
    <svg width="96" height="128" viewBox="0 0 96 128" xmlns="http://www.w3.org/2000/svg">
      <!-- Corpo -->
      <rect x="36" y="34" width="24" height="44" rx="8" fill="${color}" stroke="${accent}" stroke-width="2"/>
      <!-- Braços -->
      <rect x="22" y="44" width="14" height="28" rx="5" fill="${color}" stroke="${accent}" stroke-width="1.5"/>
      <rect x="60" y="44" width="14" height="28" rx="5" fill="${color}" stroke="${accent}" stroke-width="1.5"/>
      <!-- Pernas -->
      <rect x="38" y="78" width="10" height="26" rx="4" fill="${color}" stroke="${accent}" stroke-width="1.5"/>
      <rect x="48" y="78" width="10" height="26" rx="4" fill="${color}" stroke="${accent}" stroke-width="1.5"/>
      <!-- Cabeça -->
      <circle cx="48" y="26" r="14" fill="${color}" stroke="${accent}" stroke-width="2"/>
      <!-- Luvas (destaque) -->
      <circle cx="28" y="60" r="6" fill="#fff" stroke="#d97706" stroke-width="2"/>
      <circle cx="68" y="60" r="6" fill="#fff" stroke="#d97706" stroke-width="2"/>
      <!-- Rosto -->
      <circle cx="46" y="24" r="2.5" fill="#111827"/>
      <circle cx="52" y="24" r="2.5" fill="#111827"/>
      <path d="M46 30 Q48 32 50 30" stroke="#111827" stroke-width="1.5" fill="none"/>
    </svg>
  `;
}

// Renderizar sprites iniciais
document.getElementById('p1-sprite').innerHTML = getBoxerSVG('p1');
document.getElementById('p2-sprite').innerHTML = getBoxerSVG('p2');

// --- CONTROLES ---
const KEYS = {
  P1_LEFT: 'a',  P1_RIGHT: 'd',  P1_PUNCH: 's',
  P2_LEFT: 'j',  P2_RIGHT: 'l',  P2_PUNCH: 'k'
};

const keyState = {};

// --- INÍCIO DO JOGO ---
document.getElementById('start-btn').onclick = startGame;
document.getElementById('restart-btn').onclick = () => {
  endScreen.classList.remove('active');
  startGame();
};

// Pausa e retomada
document.getElementById('resume-btn').onclick = resumeGame;
document.getElementById('menu-btn').onclick = () => {
  pauseOverlay.style.display = 'none';
  startScreen.classList.add('active');
  stopGameLoop();
};

// Tecla ESC para pausar
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && STATE.current === 'RUNNING') {
    pauseGame();
  }
});

// ==========================
// FUNÇÕES PRINCIPAIS
// ==========================

function startGame() {
  startScreen.classList.remove('active');
  gameArea.classList.remove('hidden');
  endScreen.classList.remove('active');

  // Resetar estados
  p1.health = 100;
  p1.score = 0;
  p1.x = GAME.BOXER_START_X.P1;
  p1.facing = 1;
  p1.punching = false;
  p1.punchCooldown = 0;

  p2.health = 100;
  p2.score = 0;
  p2.x = GAME.BOXER_START_X.P2;
  p2.facing = -1;
  p2.punching = false;
  p2.punchCooldown = 0;

  STATE.current = 'RUNNING';  // ⚠️ CRÍTICO: começa rodando
  STATE.roundTimer = GAME.ROUND_TIME;
  pauseOverlay.style.display = 'none';

  // Atualizar HUD
  updateHealthBar(p1);
  updateHealthBar(p2);
  p1.scoreEl.textContent = p1.score;
  p2.scoreEl.textContent = p2.score;
  document.getElementById('round-timer').textContent = STATE.roundTimer;

  // Iniciar timer de round
  startRoundTimer();

  // Iniciar game loop
  if (STATE.intervalId) clearInterval(STATE.intervalId);
  STATE.lastFrame = performance.now();
  STATE.intervalId = setInterval(gameLoop, 16); // ~60fps
}

function stopGameLoop() {
  if (STATE.intervalId) {
    clearInterval(STATE.intervalId);
    STATE.intervalId = null;
  }
}

function pauseGame() {
  if (STATE.current !== 'RUNNING') return;
  STATE.current = 'PAUSED';
  pauseOverlay.style.display = 'flex';
  stopGameLoop();
}

function resumeGame() {
  if (STATE.current !== 'PAUSED') return;
  STATE.current = 'RUNNING';
  pauseOverlay.style.display = 'none';
  // Reiniciar o loop
  STATE.lastFrame = performance.now();
  STATE.intervalId = setInterval(gameLoop, 16);
}

// ==========================
// GAME LOOP
// ==========================
function gameLoop() {
  if (STATE.current !== 'RUNNING') return;

  // --- Movimentação dos boxeadores ---
  // (controles processados via keyState no evento de teclado)

  // P1
  if (keyState[KEYS.P1_LEFT] && p1.x > GAME.RING_PADDING) {
    p1.x -= 3;
    p1.facing = -1;
  }
  if (keyState[KEYS.P1_RIGHT] && p1.x < GAME.RING_WIDTH - GAME.RING_PADDING - GAME.BOXER_WIDTH) {
    p1.x += 3;
    p1.facing = 1;
  }

  // P2
  if (keyState[KEYS.P2_LEFT] && p2.x > GAME.RING_PADDING) {
    p2.x -= 3;
    p2.facing = -1;
  }
  if (keyState[KEYS.P2_RIGHT] && p2.x < GAME.RING_WIDTH - GAME.RING_PADDING - GAME.BOXER_WIDTH) {
    p2.x += 3;
    p2.facing = 1;
  }

  // --- Socos ---
  // P1 punch
  if (keyState[KEYS.P1_PUNCH] && !p1.punching && p1.punchCooldown === 0) {
    p1.punching = true;
    setTimeout(() => { p1.punching = false; }, GAME.PUNCH_DURATION);
    p1.punchCooldown = GAME.PUNCH_DURATION + 120; // cooldown extra

    // Verificar colisão com P2
    if (checkPunchHit(p1, p2)) {
      handlePunchImpact(p2, 12);  // dano de 12
      showImpactFlash(p2.x + 48, p2.y + 36);
    }
  }
  if (p1.punchCooldown > 0) p1.punchCooldown--;

  // P2 punch
  if (keyState[KEYS.P2_PUNCH] && !p2.punching && p2.punchCooldown === 0) {
    p2.punching = true;
    setTimeout(() => { p2.punching = false; }, GAME.PUNCH_DURATION);
    p2.punchCooldown = GAME.PUNCH_DURATION + 120;

    if (checkPunchHit(p2, p1)) {
      handlePunchImpact(p1, 12);
      showImpactFlash(p1.x + 48, p1.y + 36);
    }
  }
  if (p2.punchCooldown > 0) p2.punchCooldown--;

  // --- Atualizar posição dos elementos ---
  updateBoxerDOM(p1);
  updateBoxerDOM(p2);

  // --- Animar sprites (opcional: soco) ---
  // (SVG não tem animação complexa, mas podemos trocar classe)
  p1.sprite.style.transform = p1.punching ? 'scaleX(-1)' : (p1.facing === 1 ? 'scaleX(1)' : 'scaleX(-1)');
  p2.sprite.style.transform = p2.punching ? 'scaleX(1)' : (p2.facing === 1 ? 'scaleX(1)' : 'scaleX(-1)');

  // O transform de punch usa scaleX(-1) para P1 (gira o soco) e scaleX(1) para P2
}

// ==========================
// AUXILIARES
// ==========================

function updateBoxerDOM(boxer) {
  boxer.el.style.left = `${boxer.x}px`;
  boxer.el.style.bottom = `${GAME.BOXER_GROUND_Y}px`;
  // Z-index para frente/atrás (quem está mais à direita fica na frente)
  boxer.el.style.zIndex = Math.floor(boxer.x / 10) + 10;
}

function updateHealthBar(boxer) {
  // P2 usa pseudo-elemento ::before; P1 usa gradiente direto
  if (boxer === p1) {
    boxer.healthBar.style.width = `${boxer.health}%`;
  } else {
    // Para P2, manipulamos o width via style (o ::before ocupa 100% do container)
    boxer.healthBar.style.width = '96px';
    boxer.healthBar.style.height = '10px';
  }
  // Atualizar visual do P2 via inline style width proporcional
  if (boxer === p2) {
    const fill = document.createElement('div');
    fill.style.position = 'absolute';
    fill.style.left = '0';
    fill.style.top = '0';
    fill.style.height = '100%';
    fill.style.width = `${boxer.health}%`;
    fill.style.background = 'linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)';
    fill.style.borderRadius = '6px 0 0 6px';
    fill.style.pointerEvents = 'none';
    // Remover fill anterior se existir
    if (boxer.healthBar._fill) boxer.healthBar.removeChild(boxer.healthBar._fill);
    boxer.healthBar.appendChild(fill);
    boxer.healthBar._fill = fill;
  }
}

function checkPunchHit(attacker, defender) {
  // Calcular distância entre centros
  const dx = (defender.x + 48) - (attacker.x + 48);
  const dy = (defender.y + 64) - (attacker.y + 64);
  const distance = Math.sqrt(dx * dx + dy * dy);

  // O alcance depende da direção do soco e da distância entre os boxeadores
  // Só acerta se estiver na frente e dentro do alcance
  const facingDiff = attacker.facing - defender.facing;
  const maxRange = GAME.PUNCH_RANGE + (attacker.punching ? 24 : 0);

  // Verificar se estão próximos no eixo X e não muito separados no eixo Y
  return (
    Math.abs(dx) < maxRange &&
    Math.abs(dy) < 56 &&
    // Só acerta se o atacante está virado para o defensor
    ((attacker.facing === 1 && dx > -20 && dx < 60) ||
     (attacker.facing === -1 && dx < 20 && dx > -60))
  );
}

function handlePunchImpact(boxer, damage) {
  boxer.health = Math.max(0, boxer.health - damage);
  updateHealthBar(boxer);

  if (boxer.health === 0) {
    // Round terminou — ponto para o outro
    const winner = (boxer === p1) ? p2 : p1;
    winner.score++;
    winner.scoreEl.textContent = winner.score;

    // Resetar posições
    p1.x = GAME.BOXER_START_X.P1;
    p2.x = GAME.BOXER_START_X.P2;
    p1.health = 100;
    p2.health = 100;
    updateHealthBar(p1);
    updateHealthBar(p2);

    // Se alguém atingiu a pontuação máxima
    if (winner.score >= GAME.MAX_SCORE) {
      endGame(winner);
      return;
    }

    // Senão, próximo round (pequena pausa)
    setTimeout(() => {
      STATE.roundTimer = GAME.ROUND_TIME;
      document.getElementById('round-timer').textContent = STATE.roundTimer;
    }, 1200);
  }
}

function showImpactFlash(x, y) {
  const flash = document.getElementById('impact-flash');
  flash.style.left = `${x - 60}px`;
  flash.style.top = `${y - 50}px`;
  flash.style.opacity = '1';
  flash.classList.remove('active');
  void flash.offsetWidth; // reflow
  flash.classList.add('active');
  setTimeout(() => {
    flash.classList.remove('active');
    flash.style.opacity = '0';
  }, GAME.IMPACT_DURATION);
}

function startRoundTimer() {
  const timerEl = document.getElementById('round-timer');
  let seconds = STATE.roundTimer;

  // Limpar timer anterior se existir
  if (STATE.timerId) clearInterval(STATE.timerId);

  timerEl.textContent = seconds;
  STATE.timerId = setInterval(() => {
    if (STATE.current !== 'RUNNING') return;

    seconds--;
    timerEl.textContent = seconds;
    STATE.roundTimer = seconds;

    if (seconds <= 0) {
      clearInterval(STATE.timerId);
      // Empate: quem tem mais vida ganha o round
      if (p1.health > p2.health) {
        p1.score++;
        p1.scoreEl.textContent = p1.score;
      } else if (p2.health > p1.health) {
        p2.score++;
        p2.scoreEl.textContent = p2.score;
      }
      // Resetar para próximo round
      p1.x = GAME.BOXER_START_X.P1;
      p2.x = GAME.BOXER_START_X.P2;
      p1.health = 100;
      p2.health = 100;
      updateHealthBar(p1);
      updateHealthBar(p2);

      if ((p1.score >= GAME.MAX_SCORE) || (p2.score >= GAME.MAX_SCORE)) {
        const winner = p1.score > p2.score ? p1 : p2;
        endGame(winner);
      } else {
        STATE.roundTimer = GAME.ROUND_TIME;
        timerEl.textContent = STATE.roundTimer;
      }
    }
  }, 1000);
}

function endGame(winner) {
  stopGameLoop();
  STATE.current = 'ENDED';

  // Exibir tela de fim
  gameArea.classList.add('hidden');
  endScreen.classList.add('active');

  const winnerText = document.getElementById('winner-text');
  winnerText.textContent = winner === p1 ? 'VENCEDOR — PLAYER 1 🟦' : 'VENCEDOR — PLAYER 2 🟥';

  document.getElementById('final-score-p1').textContent = p1.score;
  document.getElementById('final-score-p2').textContent = p2.score;
}

// ==========================
// EVENTOS DE TECLADO
// ==========================
document.addEventListener('keydown', (e) => {
  keyState[e.key.toLowerCase()] = true;
  // ESC pausa (já tratado acima)
});

document.addEventListener('keyup', (e) => {
  keyState[e.key.toLowerCase()] = false;
});

// ==========================
// INICIALIZAÇÃO
// ==========================
// Renderizar health bars iniciais corretamente
updateHealthBar(p1);
updateHealthBar(p2);

// Garantir que o overlay de pausa comece escondido (defesa dupla)
pauseOverlay.style.display = 'none';
