// ============================================================
// Human or Bot? — Client Game Logic
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
};

let timerInterval = null;
let voteInterval = null;
let typingTimeout = null;
let roundTime = 120;
let timeLeft = 120;

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
  socket.emit('find_game', { name });
  showScreen('waiting');
});

els.playerName.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') els.btnPlay.click();
});

// Auto-focus name input
els.playerName.focus();

// ============================================================
// Waiting Screen & Lobby
// ============================================================
socket.on('waiting', ({ position }) => {
  // Already showing waiting screen
});

socket.on('lobby_update', ({ waiting, count, online, gamesActive }) => {
  const lobbyOnline = document.getElementById('lobbyOnline');
  const lobbyWaiting = document.getElementById('lobbyWaiting');
  const lobbyGames = document.getElementById('lobbyGames');
  const lobbyPlayers = document.getElementById('lobbyPlayers');

  if (lobbyOnline) lobbyOnline.textContent = online;
  if (lobbyWaiting) lobbyWaiting.textContent = count;
  if (lobbyGames) lobbyGames.textContent = gamesActive;

  // Also update title screen count
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
socket.on('game_start', ({ gameId, opponent, roundTime: rt }) => {
  roundTime = rt;
  timeLeft = rt;
  els.opponentName.textContent = opponent.name;
  els.chatMessages.innerHTML = '';
  els.messageInput.value = '';
  els.typingIndicator.classList.add('hidden');

  // Add system message
  addMessage('system', `You matched with ${opponent.name}. Chat and figure out: human or bot?`);

  showScreen('chat');
  els.messageInput.focus();
  startTimer();
});

// ============================================================
// Chat
// ============================================================
function addMessage(type, text) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  div.textContent = text;
  els.chatMessages.appendChild(div);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

els.btnSend.addEventListener('click', sendMessage);
els.messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

let lastTypingEmit = 0;
els.messageInput.addEventListener('input', () => {
  const now = Date.now();
  if (now - lastTypingEmit > 1000) {
    socket.emit('typing');
    lastTypingEmit = now;
  }
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
  typingTimeout = setTimeout(() => {
    els.typingIndicator.classList.add('hidden');
  }, 3000);
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
    }
  }, 1000);
}

function updateTimerDisplay() {
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  els.timer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  els.timerFill.style.width = `${(timeLeft / roundTime) * 100}%`;

  if (timeLeft <= 30) {
    els.timer.classList.add('warning');
  } else {
    els.timer.classList.remove('warning');
  }
}

// ============================================================
// Vote Phase
// ============================================================
socket.on('vote_phase', ({ voteTime }) => {
  clearInterval(timerInterval);
  showScreen('vote');

  let voteTimeLeft = voteTime;
  els.voteTimer.textContent = voteTimeLeft;

  voteInterval = setInterval(() => {
    voteTimeLeft--;
    els.voteTimer.textContent = voteTimeLeft;
    if (voteTimeLeft <= 0) clearInterval(voteInterval);
  }, 1000);
});

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
// Reveal Phase
// ============================================================
socket.on('reveal', (data) => {
  clearInterval(voteInterval);
  showScreen('reveal');

  // Animate reveal
  els.revealIcon.textContent = '❓';
  els.revealText.textContent = 'REVEALING...';
  els.revealCard.className = 'reveal-card';
  els.revealResult.classList.add('hidden');

  setTimeout(() => {
    if (data.player2IsBot) {
      els.revealIcon.textContent = '🤖';
      els.revealText.textContent = `IT WAS A BOT!`;
      els.revealCard.classList.add('bot-reveal');
    } else {
      els.revealIcon.textContent = '👤';
      els.revealText.textContent = `IT WAS A HUMAN!`;
      els.revealCard.classList.add('human-reveal');
    }

    setTimeout(() => {
      els.revealResult.classList.remove('hidden');

      if (data.yourVote) {
        if (data.correct) {
          els.resultText.textContent = '✅ YOU WERE RIGHT!';
          els.resultText.className = 'correct';
        } else {
          els.resultText.textContent = '❌ YOU WERE WRONG!';
          els.resultText.className = 'wrong';
        }
        els.resultDetail.textContent = `You guessed "${data.yourVote}" — they were ${data.player2IsBot ? 'a bot' : 'human'}`;
      } else {
        els.resultText.textContent = '⏰ TIME RAN OUT';
        els.resultText.className = 'wrong';
        els.resultDetail.textContent = `They were ${data.player2IsBot ? 'a bot' : 'human'}!`;
      }

      if (data.player2IsBot && data.player2BotPersonality) {
        els.resultDetail.textContent += ` (${data.player2BotPersonality} personality)`;
      }

      // Stats
      if (data.stats) {
        els.statWins.textContent = data.stats.wins;
        els.statLosses.textContent = data.stats.losses;
        els.statStreak.textContent = data.stats.streak;
      }

      // Reset vote buttons
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
  socket.emit('find_game', { name });
  showScreen('waiting');
});

// ============================================================
// Online Count
// ============================================================
function updateOnlineCount() {
  fetch('/api/stats')
    .then(r => r.json())
    .then(data => {
      els.onlineCount.textContent = data.playersOnline;
    })
    .catch(() => {});
}

updateOnlineCount();
setInterval(updateOnlineCount, 5000);
