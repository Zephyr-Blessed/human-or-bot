// ============================================================
// Human or Bot? — Client Game Logic (Multi-Mode)
// ============================================================

const socket = io();

// Elements
const screens = {
  title: document.getElementById('screen-title'),
  waiting: document.getElementById('screen-waiting'),
  chat: document.getElementById('screen-chat'),
  vote: document.getElementById('screen-vote'),
  reveal: document.getElementById('screen-reveal'),
};

const els = {
  playerName: document.getElementById('playerName'),
  btnPlay: document.getElementById('btnPlay'),
  onlineCount: document.getElementById('onlineCount'),
  opponentName: document.getElementById('opponentName'),
  timer: document.getElementById('timer'),
  timerFill: document.querySelector('.timer-fill'),
  chatMessages: document.getElementById('chatMessages'),
  messageInput: document.getElementById('messageInput'),
  btnSend: document.getElementById('btnSend'),
  typingIndicator: document.getElementById('typingIndicator'),
  voteTimer: document.getElementById('voteTimer'),
  btnVoteHuman: document.getElementById('btnVoteHuman'),
  btnVoteBot: document.getElementById('btnVoteBot'),
  revealIcon: document.getElementById('revealIcon'),
  revealText: document.getElementById('revealText'),
  revealCard: document.querySelector('.reveal-card'),
  revealResult: document.getElementById('revealResult'),
  resultText: document.getElementById('resultText'),
  resultDetail: document.getElementById('resultDetail'),
  statWins: document.getElementById('statWins'),
  statLosses: document.getElementById('statLosses'),
  statStreak: document.getElementById('statStreak'),
  btnPlayAgain: document.getElementById('btnPlayAgain'),
  modeLabel: document.getElementById('modeLabel'),
  challengeArea: document.getElementById('challengeArea'),
  chatInput: document.getElementById('chatInputArea'),
  opponentSubmissionArea: document.getElementById('opponentSubmissionArea'),
};

let timerInterval = null;
let voteInterval = null;
let typingTimeout = null;
let roundTime = 120;
let timeLeft = 120;
let currentMode = null;
let currentModeData = null;

// ============================================================
// Screen Management
// ============================================================
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ============================================================
// Title Screen
// ============================================================
els.btnPlay.addEventListener('click', () => {
  const name = els.playerName.value.trim() || 'Anonymous';
  const urlMode = new URLSearchParams(window.location.search).get('mode');
  socket.emit('find_game', { name, mode: urlMode || undefined });
  showScreen('waiting');
});
els.playerName.addEventListener('keypress', (e) => { if (e.key === 'Enter') els.btnPlay.click(); });
els.playerName.focus();

// ============================================================
// Waiting & Lobby
// ============================================================
socket.on('waiting', () => {});
socket.on('lobby_update', ({ waiting, count, online, gamesActive }) => {
  const lobbyOnline = document.getElementById('lobbyOnline');
  const lobbyWaiting = document.getElementById('lobbyWaiting');
  const lobbyGames = document.getElementById('lobbyGames');
  const lobbyPlayers = document.getElementById('lobbyPlayers');
  if (lobbyOnline) lobbyOnline.textContent = online;
  if (lobbyWaiting) lobbyWaiting.textContent = count;
  if (lobbyGames) lobbyGames.textContent = gamesActive;
  els.onlineCount.textContent = online;
  if (lobbyPlayers) {
    lobbyPlayers.innerHTML = waiting.map(name =>
      `<div class="lobby-player"><span class="dot-online"></span>${name}</div>`
    ).join('');
  }
});

// ============================================================
// Game Start
// ============================================================
socket.on('game_start', ({ gameId, opponent, roundTime: rt, mode, modeData }) => {
  roundTime = rt;
  timeLeft = rt;
  currentMode = mode;
  currentModeData = modeData;

  els.opponentName.textContent = opponent.name;
  els.chatMessages.innerHTML = '';
  if (els.messageInput) els.messageInput.value = '';
  els.typingIndicator.classList.add('hidden');

  // Update mode label
  if (els.modeLabel) {
    els.modeLabel.textContent = `${mode.emoji} ${mode.label}`;
  }

  // Setup challenge area based on mode
  setupChallengeUI(mode, modeData);

  showScreen('chat');
  startTimer();
});

// ============================================================
// Challenge UI per Mode
// ============================================================
function setupChallengeUI(mode, data) {
  const area = els.challengeArea;
  const chatInput = els.chatInput;
  area.innerHTML = '';

  // Show/hide chat input
  if (mode.name === 'chat') {
    chatInput.classList.remove('hidden');
    area.innerHTML = '';
    addMessage('system', `Chat and figure out: human or bot?`);
    if (els.messageInput) els.messageInput.focus();
    return;
  }

  chatInput.classList.add('hidden');

  switch (mode.name) {
    case 'draw': setupDrawMode(area, data); break;
    case 'joke': setupJokeMode(area, data); break;
    case 'type': setupTypeMode(area, data); break;
    case 'wyr': setupWYRMode(area, data); break;
    case 'describe': setupDescribeMode(area, data); break;
  }
}

// ---- DRAW MODE ----
function setupDrawMode(area, data) {
  area.innerHTML = `
    <div class="mode-header">🎨 Draw: <span class="draw-prompt">${data.prompt}</span></div>
    <div class="draw-tools">
      <input type="color" id="drawColor" value="#00ff88" class="draw-color-picker">
      <label class="brush-size-label">Size:
        <input type="range" id="drawSize" min="1" max="20" value="4" class="draw-size-slider">
      </label>
      <button id="drawClear" class="pixel-btn mini-btn">CLEAR</button>
    </div>
    <canvas id="drawCanvas" width="400" height="300" class="draw-canvas"></canvas>
    <p class="mode-hint">Draw the prompt above. Your opponent is drawing the same thing!</p>
  `;

  const canvas = document.getElementById('drawCanvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a1a3a';
  ctx.fillRect(0, 0, 400, 300);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let drawing = false;
  let lastX = 0, lastY = 0;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 400 / rect.width;
    const scaleY = 300 / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY];
  }

  function startDraw(e) {
    e.preventDefault();
    drawing = true;
    [lastX, lastY] = getPos(e);
  }
  function doDraw(e) {
    if (!drawing) return;
    e.preventDefault();
    const [x, y] = getPos(e);
    ctx.strokeStyle = document.getElementById('drawColor').value;
    ctx.lineWidth = document.getElementById('drawSize').value;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    [lastX, lastY] = [x, y];
  }
  function stopDraw() { drawing = false; }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', doDraw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);
  canvas.addEventListener('touchstart', startDraw);
  canvas.addEventListener('touchmove', doDraw);
  canvas.addEventListener('touchend', stopDraw);

  document.getElementById('drawClear').addEventListener('click', () => {
    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(0, 0, 400, 300);
  });

  // Auto-submit drawing periodically and on timer end
  window._drawSubmit = () => {
    const dataUrl = canvas.toDataURL('image/png', 0.8);
    socket.emit('draw_submit', { dataUrl });
  };
  window._drawInterval = setInterval(window._drawSubmit, 5000);
}

// ---- JOKE MODE ----
function setupJokeMode(area, data) {
  area.innerHTML = `
    <div class="mode-header">😂 ${data.prompt}</div>
    <textarea id="jokeInput" class="mode-textarea" maxlength="1000" placeholder="Write your funniest joke here..."></textarea>
    <button id="jokeSubmitBtn" class="pixel-btn mini-btn">SUBMIT JOKE</button>
    <p class="mode-hint">Your opponent is writing a joke too. After time's up, you'll see each other's jokes!</p>
  `;
  document.getElementById('jokeSubmitBtn').addEventListener('click', () => {
    const text = document.getElementById('jokeInput').value.trim();
    if (text) {
      socket.emit('joke_submit', { text });
      document.getElementById('jokeSubmitBtn').textContent = '✅ SUBMITTED';
      document.getElementById('jokeSubmitBtn').disabled = true;
    }
  });
  window._jokeSubmit = () => {
    const text = document.getElementById('jokeInput')?.value.trim();
    if (text) socket.emit('joke_submit', { text });
  };
}

// ---- TYPE RACE MODE ----
function setupTypeMode(area, data) {
  const text = data.text;
  area.innerHTML = `
    <div class="mode-header">⌨️ Type Race</div>
    <div class="type-target" id="typeTarget"></div>
    <input type="text" id="typeInput" class="mode-text-input" placeholder="Start typing..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
    <div class="type-stats">
      <span id="typeWpm">0 WPM</span>
      <span id="typeAccuracy">100%</span>
    </div>
    <p class="mode-hint">Type the text above as fast and accurately as you can!</p>
  `;

  const targetEl = document.getElementById('typeTarget');
  const inputEl = document.getElementById('typeInput');
  let startTime = null;
  let rhythm = [];
  let lastKeyTime = null;

  // Render target text
  function renderTarget(typed) {
    let html = '';
    for (let i = 0; i < text.length; i++) {
      if (i < typed.length) {
        if (typed[i] === text[i]) {
          html += `<span class="type-correct">${escapeHtml(text[i])}</span>`;
        } else {
          html += `<span class="type-wrong">${escapeHtml(text[i])}</span>`;
        }
      } else if (i === typed.length) {
        html += `<span class="type-cursor">${escapeHtml(text[i])}</span>`;
      } else {
        html += `<span class="type-pending">${escapeHtml(text[i])}</span>`;
      }
    }
    targetEl.innerHTML = html;
  }

  renderTarget('');
  inputEl.focus();

  inputEl.addEventListener('input', () => {
    const typed = inputEl.value;
    if (!startTime) startTime = Date.now();

    const now = Date.now();
    if (lastKeyTime) rhythm.push(now - lastKeyTime);
    lastKeyTime = now;

    renderTarget(typed);

    // Calculate stats
    const elapsed = (now - startTime) / 1000 / 60; // minutes
    const words = typed.length / 5;
    const wpm = elapsed > 0 ? Math.round(words / elapsed) : 0;

    let correct = 0;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === text[i]) correct++;
    }
    const accuracy = typed.length > 0 ? Math.round((correct / typed.length) * 100) : 100;

    document.getElementById('typeWpm').textContent = `${wpm} WPM`;
    document.getElementById('typeAccuracy').textContent = `${accuracy}%`;

    // Auto-submit when complete
    if (typed.length >= text.length) {
      const time = (Date.now() - startTime) / 1000;
      socket.emit('type_submit', { wpm, accuracy, time, rhythm: rhythm.slice(-100) });
      inputEl.disabled = true;
      inputEl.placeholder = 'Done!';
    }
  });

  window._typeSubmit = () => {
    const typed = inputEl.value;
    if (!startTime || !typed) return;
    const elapsed = (Date.now() - startTime) / 1000 / 60;
    const words = typed.length / 5;
    const wpm = elapsed > 0 ? Math.round(words / elapsed) : 0;
    let correct = 0;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === text[i]) correct++;
    }
    const accuracy = typed.length > 0 ? (correct / typed.length) * 100 : 100;
    const time = (Date.now() - startTime) / 1000;
    socket.emit('type_submit', { wpm, accuracy, time, rhythm: rhythm.slice(-100) });
  };
}

// ---- WOULD YOU RATHER MODE ----
function setupWYRMode(area, data) {
  const questions = data.questions;
  let answers = new Array(5).fill(null);
  let currentQ = 0;

  function renderQuestion() {
    if (currentQ >= questions.length) {
      area.innerHTML = `
        <div class="mode-header">🤔 All answered!</div>
        <div class="wyr-summary">${answers.map((a, i) => a ? `<div class="wyr-answer-row">Q${i + 1}: <strong>${a.choice === 'a' ? questions[i].a : questions[i].b}</strong> — ${a.reason || 'no reason'}</div>` : '').join('')}</div>
        <p class="mode-hint">Waiting for time to run out...</p>
      `;
      // Submit all answers
      socket.emit('wyr_submit', { answers: answers.filter(Boolean) });
      return;
    }

    const q = questions[currentQ];
    area.innerHTML = `
      <div class="mode-header">🤔 Would You Rather? (${currentQ + 1}/${questions.length})</div>
      <div class="wyr-options">
        <button class="pixel-btn wyr-btn wyr-btn-a" id="wyrA">${q.a}</button>
        <div class="wyr-vs">OR</div>
        <button class="pixel-btn wyr-btn wyr-btn-b" id="wyrB">${q.b}</button>
      </div>
      <input type="text" id="wyrReason" class="mode-text-input" placeholder="Quick reason (optional)..." maxlength="200">
    `;

    document.getElementById('wyrA').addEventListener('click', () => submitWYR('a'));
    document.getElementById('wyrB').addEventListener('click', () => submitWYR('b'));
  }

  function submitWYR(choice) {
    const reason = document.getElementById('wyrReason')?.value.trim() || '';
    answers[currentQ] = { choice, reason };
    currentQ++;
    renderQuestion();
  }

  renderQuestion();

  window._wyrSubmit = () => {
    socket.emit('wyr_submit', { answers: answers.filter(Boolean) });
  };
}

// ---- DESCRIBE MODE ----
function setupDescribeMode(area, data) {
  area.innerHTML = `
    <div class="mode-header">📸 Describe This Image</div>
    <img src="${data.image.url}" class="describe-image" alt="Mystery image" crossorigin="anonymous">
    <textarea id="describeInput" class="mode-textarea" maxlength="1000" placeholder="Describe what you see in this image..."></textarea>
    <button id="describeSubmitBtn" class="pixel-btn mini-btn">SUBMIT</button>
    <p class="mode-hint">Your opponent sees the same image. Describe it in your own words!</p>
  `;
  document.getElementById('describeSubmitBtn').addEventListener('click', () => {
    const text = document.getElementById('describeInput').value.trim();
    if (text) {
      socket.emit('describe_submit', { text });
      document.getElementById('describeSubmitBtn').textContent = '✅ SUBMITTED';
      document.getElementById('describeSubmitBtn').disabled = true;
    }
  });
  window._describeSubmit = () => {
    const text = document.getElementById('describeInput')?.value.trim();
    if (text) socket.emit('describe_submit', { text });
  };
}

// ============================================================
// Helper
// ============================================================
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, c => map[c]);
}

// ============================================================
// Chat (mode 0)
// ============================================================
function addMessage(type, text) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  div.textContent = text;
  els.chatMessages.appendChild(div);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

els.btnSend.addEventListener('click', sendMessage);
els.messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

let lastTypingEmit = 0;
els.messageInput.addEventListener('input', () => {
  const now = Date.now();
  if (now - lastTypingEmit > 1000) { socket.emit('typing'); lastTypingEmit = now; }
});

function sendMessage() {
  const text = els.messageInput.value.trim();
  if (!text) return;
  socket.emit('send_message', { text });
  addMessage('self', text);
  els.messageInput.value = '';
  els.messageInput.focus();
}

socket.on('message', ({ from, text }) => {
  els.typingIndicator.classList.add('hidden');
  addMessage('other', text);
});

socket.on('opponent_typing', () => {
  els.typingIndicator.classList.remove('hidden');
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => els.typingIndicator.classList.add('hidden'), 3000);
});

socket.on('opponent_left', () => {
  addMessage('system', 'Your opponent disconnected 💔');
  clearInterval(timerInterval);
});

// ============================================================
// Timer
// ============================================================
function startTimer() {
  clearInterval(timerInterval);
  timeLeft = roundTime;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      // Final submit for current mode
      finalSubmit();
    }
  }, 1000);
}

function finalSubmit() {
  if (window._drawSubmit) { window._drawSubmit(); clearInterval(window._drawInterval); }
  if (window._jokeSubmit) window._jokeSubmit();
  if (window._typeSubmit) window._typeSubmit();
  if (window._wyrSubmit) window._wyrSubmit();
  if (window._describeSubmit) window._describeSubmit();
  // Clear all
  window._drawSubmit = null; window._drawInterval = null;
  window._jokeSubmit = null; window._typeSubmit = null;
  window._wyrSubmit = null; window._describeSubmit = null;
}

function updateTimerDisplay() {
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  els.timer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  els.timerFill.style.width = `${(timeLeft / roundTime) * 100}%`;
  els.timer.classList.toggle('warning', timeLeft <= 30);
}

// ============================================================
// Vote Phase
// ============================================================
socket.on('vote_phase', ({ voteTime, opponentSubmission }) => {
  clearInterval(timerInterval);
  finalSubmit();

  // Show opponent's submission in the vote screen
  renderOpponentSubmission(opponentSubmission);

  showScreen('vote');

  let voteTimeLeft = voteTime;
  els.voteTimer.textContent = voteTimeLeft;
  voteInterval = setInterval(() => {
    voteTimeLeft--;
    els.voteTimer.textContent = voteTimeLeft;
    if (voteTimeLeft <= 0) clearInterval(voteInterval);
  }, 1000);
});

function renderOpponentSubmission(sub) {
  const area = els.opponentSubmissionArea;
  if (!area) return;

  if (!sub) {
    area.innerHTML = currentMode?.name === 'chat' ? '' : '<p class="sub-empty">Opponent didn\'t submit anything 🤷</p>';
    return;
  }

  switch (sub.type) {
    case 'draw':
      area.innerHTML = `<div class="sub-label">Their drawing:</div><img src="${sub.dataUrl}" class="sub-drawing">`;
      break;
    case 'joke':
      area.innerHTML = `<div class="sub-label">Their joke:</div><div class="sub-text">${escapeHtml(sub.text)}</div>`;
      break;
    case 'type':
      area.innerHTML = `<div class="sub-label">Their typing:</div><div class="sub-stats">${sub.wpm} WPM · ${sub.accuracy}% accuracy · ${sub.time}s</div>`;
      break;
    case 'wyr':
      const qData = currentModeData?.questions || [];
      area.innerHTML = `<div class="sub-label">Their answers:</div>` +
        (sub.answers || []).map((a, i) => {
          const q = qData[i];
          const chosen = a.choice === 'a' ? q?.a : q?.b;
          return `<div class="sub-wyr-answer"><strong>${chosen || a.choice}</strong>${a.reason ? ` — "${escapeHtml(a.reason)}"` : ''}</div>`;
        }).join('');
      break;
    case 'describe':
      area.innerHTML = `<div class="sub-label">Their description:</div><div class="sub-text">${escapeHtml(sub.text)}</div>`;
      break;
    default:
      area.innerHTML = '';
  }
}

els.btnVoteHuman.addEventListener('click', () => {
  socket.emit('vote', { vote: 'human' });
  els.btnVoteHuman.style.opacity = '1';
  els.btnVoteBot.style.opacity = '0.3';
  els.btnVoteHuman.disabled = true;
  els.btnVoteBot.disabled = true;
});

els.btnVoteBot.addEventListener('click', () => {
  socket.emit('vote', { vote: 'bot' });
  els.btnVoteBot.style.opacity = '1';
  els.btnVoteHuman.style.opacity = '0.3';
  els.btnVoteHuman.disabled = true;
  els.btnVoteBot.disabled = true;
});

// ============================================================
// Reveal
// ============================================================
socket.on('reveal', (data) => {
  clearInterval(voteInterval);
  showScreen('reveal');

  els.revealIcon.textContent = '❓';
  els.revealText.textContent = 'REVEALING...';
  els.revealCard.className = 'reveal-card';
  els.revealResult.classList.add('hidden');

  setTimeout(() => {
    const opponentIsBot = data.player2IsBot || data.player1IsBot || false;
    if (opponentIsBot) {
      els.revealIcon.textContent = '🤖';
      els.revealText.textContent = 'IT WAS A BOT!';
      els.revealCard.classList.add('bot-reveal');
    } else {
      els.revealIcon.textContent = '👤';
      els.revealText.textContent = 'IT WAS A HUMAN!';
      els.revealCard.classList.add('human-reveal');
    }

    setTimeout(() => {
      els.revealResult.classList.remove('hidden');
      if (data.yourVote) {
        els.resultText.textContent = data.correct ? '✅ YOU WERE RIGHT!' : '❌ YOU WERE WRONG!';
        els.resultText.className = data.correct ? 'correct' : 'wrong';
        els.resultDetail.textContent = `You guessed "${data.yourVote}" — they were ${opponentIsBot ? 'a bot' : 'human'}`;
      } else {
        els.resultText.textContent = '⏰ TIME RAN OUT';
        els.resultText.className = 'wrong';
        els.resultDetail.textContent = `They were ${opponentIsBot ? 'a bot' : 'human'}!`;
      }
      if (opponentIsBot && data.player2BotPersonality) {
        els.resultDetail.textContent += ` (${data.player2BotPersonality})`;
      }
      if (data.stats) {
        els.statWins.textContent = data.stats.wins;
        els.statLosses.textContent = data.stats.losses;
        els.statStreak.textContent = data.stats.streak;
      }
      els.btnVoteHuman.style.opacity = '1';
      els.btnVoteBot.style.opacity = '1';
      els.btnVoteHuman.disabled = false;
      els.btnVoteBot.disabled = false;
    }, 1500);
  }, 2000);
});

// ============================================================
// Play Again
// ============================================================
els.btnPlayAgain.addEventListener('click', () => {
  const name = els.playerName.value.trim() || 'Anonymous';
  const urlMode = new URLSearchParams(window.location.search).get('mode');
  socket.emit('find_game', { name, mode: urlMode || undefined });
  showScreen('waiting');
});

// ============================================================
// Online Count
// ============================================================
function updateOnlineCount() {
  fetch('/api/stats').then(r => r.json()).then(data => { els.onlineCount.textContent = data.playersOnline; }).catch(() => {});
}
updateOnlineCount();
setInterval(updateOnlineCount, 5000);
