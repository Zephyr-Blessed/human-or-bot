const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { getRandomMode, getModeData, GAME_MODES } = require('./gameData');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '../public')));

// ============================================================
// Game State
// ============================================================
const waitingQueue = [];
const activeGames = new Map();
const playerGames = new Map();
const playerStats = new Map();

const VOTE_TIME = 15;

class Game {
  constructor(id, player1, player2, player2IsBot = false) {
    this.id = id;
    this.player1 = player1;
    this.player2 = player2;
    this.player2IsBot = player2IsBot;
    this.messages = [];
    this.votes = {};
    this.phase = 'challenge'; // challenge | voting | reveal
    this.startTime = Date.now();
    this.timer = null;
    this.voteTimer = null;

    // Mode
    this.mode = getRandomMode();
    this.modeData = getModeData(this.mode);
    this.roundTime = this.mode.roundTime;

    // Mode-specific submissions
    this.submissions = {}; // socketId -> submission data
  }
}

let gameCounter = 0;

function generateGameId() {
  return `game_${++gameCounter}_${Date.now().toString(36)}`;
}

// ============================================================
// Matchmaking
// ============================================================
function tryMatch(socket, playerName, isAI = false) {
  if (waitingQueue.length > 0 && waitingQueue[0].socketId !== socket.id) {
    const opponent = waitingQueue.shift();
    const gameId = generateGameId();
    const p1IsAI = opponent.isAI || false;
    const p2IsAI = isAI;

    const game = new Game(gameId,
      { socketId: opponent.socketId, name: opponent.name, isAI: p1IsAI },
      { socketId: socket.id, name: playerName, isAI: p2IsAI },
      false
    );
    game.player1IsAI = p1IsAI;
    game.player2IsAI = p2IsAI;
    startGame(game);
    broadcastLobby();
  } else if (waitingQueue.find(p => p.socketId === socket.id)) {
    return;
  } else {
    waitingQueue.push({ socketId: socket.id, name: playerName, isAI });
    socket.emit('waiting', { position: waitingQueue.length });
    broadcastLobby();
  }
}

function broadcastLobby() {
  const lobbyPlayers = waitingQueue.map(p => p.name);
  io.emit('lobby_update', {
    waiting: lobbyPlayers,
    count: lobbyPlayers.length,
    online: io.sockets.sockets.size,
    gamesActive: activeGames.size,
  });
}

function startGame(game) {
  activeGames.set(game.id, game);

  const gameStartData = {
    gameId: game.id,
    roundTime: game.roundTime,
    mode: {
      id: game.mode.id,
      name: game.mode.name,
      emoji: game.mode.emoji,
      label: game.mode.label,
    },
    modeData: game.modeData,
  };

  // Register player 1
  playerGames.set(game.player1.socketId, game.id);
  const s1 = io.sockets.sockets.get(game.player1.socketId);
  if (s1) {
    s1.emit('game_start', { ...gameStartData, opponent: { name: game.player2.name } });
  }

  // Register player 2
  if (!game.player2IsBot) {
    playerGames.set(game.player2.socketId, game.id);
    const s2 = io.sockets.sockets.get(game.player2.socketId);
    if (s2) {
      s2.emit('game_start', { ...gameStartData, opponent: { name: game.player1.name } });
    }
  }

  // Start round timer
  game.timer = setTimeout(() => endChallengePhase(game.id), game.roundTime * 1000);
}

function getOpponentSocket(game, socketId) {
  const opId = game.player1.socketId === socketId ? game.player2.socketId : game.player1.socketId;
  return io.sockets.sockets.get(opId);
}

function endChallengePhase(gameId) {
  const game = activeGames.get(gameId);
  if (!game || game.phase !== 'challenge') return;

  game.phase = 'voting';

  // Prepare opponent submissions for voting phase
  const p1Sub = game.submissions[game.player1.socketId] || null;
  const p2Sub = game.submissions[game.player2.socketId] || null;

  const s1 = io.sockets.sockets.get(game.player1.socketId);
  if (s1) s1.emit('vote_phase', { voteTime: VOTE_TIME, opponentSubmission: p2Sub });

  if (!game.player2IsBot) {
    const s2 = io.sockets.sockets.get(game.player2.socketId);
    if (s2) s2.emit('vote_phase', { voteTime: VOTE_TIME, opponentSubmission: p1Sub });
  }

  game.voteTimer = setTimeout(() => endVotePhase(gameId), VOTE_TIME * 1000);
}

function endVotePhase(gameId) {
  const game = activeGames.get(gameId);
  if (!game || game.phase !== 'voting') return;

  game.phase = 'reveal';

  const p2IsBot = game.player2IsBot || game.player2IsAI || false;
  const p1IsBot = game.player1IsAI || false;

  const p1Vote = game.votes[game.player1.socketId];
  const p1Correct = p2IsBot ? p1Vote === 'bot' : p1Vote === 'human';

  let p2Vote = null;
  let p2Correct = null;
  if (!game.player2IsBot) {
    p2Vote = game.votes[game.player2.socketId];
    p2Correct = p1IsBot ? p2Vote === 'bot' : p2Vote === 'human';
  }

  updateStats(game.player1.socketId, p1Correct);
  if (!game.player2IsBot) {
    updateStats(game.player2.socketId, p2Correct);
  }

  const reveal = {
    player2IsBot: p2IsBot,
    player2Name: game.player2.name,
    player1Name: game.player1.name,
    player1IsBot: p1IsBot,
    player2BotPersonality: game.player2IsBot ? 'AI Player' : (p2IsBot ? 'AI Player' : null),
    mode: game.mode.name,
  };

  const s1 = io.sockets.sockets.get(game.player1.socketId);
  if (s1) {
    s1.emit('reveal', {
      ...reveal,
      yourVote: p1Vote,
      correct: p1Correct,
      stats: getStats(game.player1.socketId),
    });
  }

  if (!game.player2IsBot) {
    const s2 = io.sockets.sockets.get(game.player2.socketId);
    if (s2) {
      s2.emit('reveal', {
        ...reveal,
        yourVote: p2Vote,
        correct: p2Correct,
        stats: getStats(game.player2.socketId),
      });
    }
  }

  setTimeout(() => cleanupGame(gameId), 30000);
}

function cleanupGame(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;
  playerGames.delete(game.player1.socketId);
  if (!game.player2IsBot) playerGames.delete(game.player2.socketId);
  if (game.timer) clearTimeout(game.timer);
  if (game.voteTimer) clearTimeout(game.voteTimer);
  activeGames.delete(gameId);
}

function updateStats(socketId, correct) {
  let stats = playerStats.get(socketId) || { wins: 0, losses: 0, streak: 0, totalGames: 0 };
  stats.totalGames++;
  if (correct) { stats.wins++; stats.streak++; }
  else { stats.losses++; stats.streak = 0; }
  playerStats.set(socketId, stats);
}

function getStats(socketId) {
  return playerStats.get(socketId) || { wins: 0, losses: 0, streak: 0, totalGames: 0 };
}

// ============================================================
// Socket.io
// ============================================================
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  broadcastLobby();

  socket.on('find_game', ({ name }) => {
    const playerName = (name || 'Anonymous').slice(0, 20);
    tryMatch(socket, playerName);
  });

  // Chat mode: send message
  socket.on('send_message', ({ text }) => {
    const gameId = playerGames.get(socket.id);
    if (!gameId) return;
    const game = activeGames.get(gameId);
    if (!game || game.phase !== 'challenge' || game.mode.name !== 'chat') return;

    const cleanText = (text || '').slice(0, 500);
    if (!cleanText) return;

    game.messages.push({ from: socket.id, text: cleanText });

    const opSocket = getOpponentSocket(game, socket.id);
    if (opSocket) opSocket.emit('message', { from: 'opponent', text: cleanText, timestamp: Date.now() });
  });

  socket.on('typing', () => {
    const gameId = playerGames.get(socket.id);
    if (!gameId) return;
    const game = activeGames.get(gameId);
    if (!game || game.phase !== 'challenge') return;

    const opSocket = getOpponentSocket(game, socket.id);
    if (opSocket) opSocket.emit('opponent_typing');
  });

  // ---- Mode-specific submissions ----

  // Draw mode: submit drawing
  socket.on('draw_submit', ({ dataUrl }) => {
    const gameId = playerGames.get(socket.id);
    if (!gameId) return;
    const game = activeGames.get(gameId);
    if (!game || game.phase !== 'challenge' || game.mode.name !== 'draw') return;

    game.submissions[socket.id] = { type: 'draw', dataUrl: (dataUrl || '').slice(0, 500000) };
  });

  // Joke mode: submit joke
  socket.on('joke_submit', ({ text }) => {
    const gameId = playerGames.get(socket.id);
    if (!gameId) return;
    const game = activeGames.get(gameId);
    if (!game || game.phase !== 'challenge' || game.mode.name !== 'joke') return;

    game.submissions[socket.id] = { type: 'joke', text: (text || '').slice(0, 1000) };
  });

  // Type race: submit results
  socket.on('type_submit', ({ wpm, accuracy, time, rhythm }) => {
    const gameId = playerGames.get(socket.id);
    if (!gameId) return;
    const game = activeGames.get(gameId);
    if (!game || game.phase !== 'challenge' || game.mode.name !== 'type') return;

    game.submissions[socket.id] = {
      type: 'type',
      wpm: Math.round(wpm || 0),
      accuracy: Math.round((accuracy || 0) * 100) / 100,
      time: Math.round((time || 0) * 100) / 100,
      rhythm: (rhythm || []).slice(0, 200),
    };
  });

  // WYR: submit answers
  socket.on('wyr_submit', ({ answers }) => {
    const gameId = playerGames.get(socket.id);
    if (!gameId) return;
    const game = activeGames.get(gameId);
    if (!game || game.phase !== 'challenge' || game.mode.name !== 'wyr') return;

    // answers = [{ choice: 'a'|'b', reason: '...' }, ...]
    const clean = (answers || []).slice(0, 5).map(a => ({
      choice: a.choice === 'a' || a.choice === 'b' ? a.choice : 'a',
      reason: (a.reason || '').slice(0, 200),
    }));
    game.submissions[socket.id] = { type: 'wyr', answers: clean };
  });

  // Describe: submit description
  socket.on('describe_submit', ({ text }) => {
    const gameId = playerGames.get(socket.id);
    if (!gameId) return;
    const game = activeGames.get(gameId);
    if (!game || game.phase !== 'challenge' || game.mode.name !== 'describe') return;

    game.submissions[socket.id] = { type: 'describe', text: (text || '').slice(0, 1000) };
  });

  // Vote
  socket.on('vote', ({ vote }) => {
    const gameId = playerGames.get(socket.id);
    if (!gameId) return;
    const game = activeGames.get(gameId);
    if (!game || game.phase !== 'voting') return;
    if (vote !== 'human' && vote !== 'bot') return;

    game.votes[socket.id] = vote;

    const neededVotes = game.player2IsBot ? 1 : 2;
    if (Object.keys(game.votes).length >= neededVotes) {
      clearTimeout(game.voteTimer);
      endVotePhase(gameId);
    }
  });

  socket.on('disconnect', () => {
    const idx = waitingQueue.findIndex(p => p.socketId === socket.id);
    if (idx !== -1) {
      waitingQueue.splice(idx, 1);
      broadcastLobby();
    }

    const gameId = playerGames.get(socket.id);
    if (gameId) {
      const game = activeGames.get(gameId);
      if (game && game.phase === 'challenge') {
        const opSocket = getOpponentSocket(game, socket.id);
        if (opSocket) opSocket.emit('opponent_left');
        cleanupGame(gameId);
      }
    }
  });
});

// ============================================================
// AI Player HTTP API
// ============================================================
const aiPlayers = new Map();

app.use(express.json({ limit: '2mb' }));

app.post('/api/ai/join', (req, res) => {
  const { name, secret } = req.body;
  if (secret !== process.env.AI_SECRET && secret !== 'zephyr-plays-2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = `ai_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const virtualSocket = {
    id: `ai_${token}`,
    emit: (event, data) => {
      const player = aiPlayers.get(token);
      if (!player) return;
      if (event === 'game_start') {
        player.gameStarted = true;
        player.phase = 'challenge';
        player.opponent = data.opponent.name;
        player.roundTime = data.roundTime;
        player.gameId = data.gameId;
        player.mode = data.mode;
        player.modeData = data.modeData;
        player.events.push({ type: 'game_start', data, timestamp: Date.now() });
      } else if (event === 'message') {
        player.pendingMessages.push({ from: data.from, text: data.text, timestamp: Date.now() });
        player.events.push({ type: 'message', data, timestamp: Date.now() });
      } else if (event === 'opponent_typing') {
        player.events.push({ type: 'opponent_typing', timestamp: Date.now() });
      } else if (event === 'vote_phase') {
        player.phase = 'voting';
        player.opponentSubmission = data.opponentSubmission;
        player.events.push({ type: 'vote_phase', data, timestamp: Date.now() });
      } else if (event === 'reveal') {
        player.phase = 'reveal';
        player.revealData = data;
        player.events.push({ type: 'reveal', data, timestamp: Date.now() });
      } else if (event === 'waiting') {
        player.events.push({ type: 'waiting', data, timestamp: Date.now() });
      } else if (event === 'opponent_left') {
        player.events.push({ type: 'opponent_left', timestamp: Date.now() });
      } else if (event === 'lobby_update') {
        player.lobby = data;
      }
    },
  };

  io.sockets.sockets.set(virtualSocket.id, virtualSocket);

  const playerData = {
    socketId: virtualSocket.id,
    virtualSocket,
    name: name || 'AI Player',
    messages: [],
    pendingMessages: [],
    events: [],
    phase: 'waiting',
    gameStarted: false,
    opponent: null,
    lobby: null,
    revealData: null,
    isAI: true,
    mode: null,
    modeData: null,
    opponentSubmission: null,
  };

  aiPlayers.set(token, playerData);
  tryMatch(virtualSocket, playerData.name, true);
  res.json({ token, message: `Joined as ${playerData.name}. Poll /api/ai/poll for updates.` });
});

app.get('/api/ai/poll', (req, res) => {
  const token = req.headers['x-ai-token'];
  const player = aiPlayers.get(token);
  if (!player) return res.status(401).json({ error: 'Invalid token' });

  const newMessages = [...player.pendingMessages];
  player.pendingMessages = [];

  res.json({
    phase: player.phase,
    gameStarted: player.gameStarted,
    opponent: player.opponent,
    mode: player.mode,
    modeData: player.modeData,
    newMessages,
    allMessages: player.messages,
    events: player.events.slice(-20),
    lobby: player.lobby,
    reveal: player.revealData,
    opponentSubmission: player.opponentSubmission,
  });
});

app.post('/api/ai/send', (req, res) => {
  const token = req.headers['x-ai-token'];
  const player = aiPlayers.get(token);
  if (!player) return res.status(401).json({ error: 'Invalid token' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text' });

  const gameId = playerGames.get(player.socketId);
  if (!gameId) return res.status(400).json({ error: 'Not in a game' });
  const game = activeGames.get(gameId);
  if (!game || game.phase !== 'challenge') return res.status(400).json({ error: 'Game not in challenge phase' });

  const cleanText = text.slice(0, 500);
  game.messages.push({ from: player.socketId, text: cleanText });
  player.messages.push({ from: 'self', text: cleanText });

  const opSocket = getOpponentSocket(game, player.socketId);
  if (opSocket && opSocket.emit) {
    opSocket.emit('message', { from: 'opponent', text: cleanText, timestamp: Date.now() });
  }

  res.json({ sent: true, text: cleanText });
});

// AI submit for any mode
app.post('/api/ai/submit', (req, res) => {
  const token = req.headers['x-ai-token'];
  const player = aiPlayers.get(token);
  if (!player) return res.status(401).json({ error: 'Invalid token' });

  const gameId = playerGames.get(player.socketId);
  if (!gameId) return res.status(400).json({ error: 'Not in a game' });
  const game = activeGames.get(gameId);
  if (!game || game.phase !== 'challenge') return res.status(400).json({ error: 'Game not in challenge phase' });

  const { submission } = req.body;
  if (!submission) return res.status(400).json({ error: 'No submission' });

  game.submissions[player.socketId] = submission;
  res.json({ submitted: true });
});

app.post('/api/ai/vote', (req, res) => {
  const token = req.headers['x-ai-token'];
  const player = aiPlayers.get(token);
  if (!player) return res.status(401).json({ error: 'Invalid token' });

  const { vote } = req.body;
  if (vote !== 'human' && vote !== 'bot') return res.status(400).json({ error: 'Vote must be "human" or "bot"' });

  const gameId = playerGames.get(player.socketId);
  if (!gameId) return res.status(400).json({ error: 'Not in a game' });
  const game = activeGames.get(gameId);
  if (!game || game.phase !== 'voting') return res.status(400).json({ error: 'Not in voting phase' });

  game.votes[player.socketId] = vote;

  const neededVotes = game.player2IsBot ? 1 : 2;
  if (Object.keys(game.votes).length >= neededVotes) {
    clearTimeout(game.voteTimer);
    endVotePhase(gameId);
  }

  res.json({ voted: vote });
});

app.post('/api/ai/leave', (req, res) => {
  const token = req.headers['x-ai-token'];
  const player = aiPlayers.get(token);
  if (!player) return res.status(401).json({ error: 'Invalid token' });

  const idx = waitingQueue.findIndex(p => p.socketId === player.socketId);
  if (idx !== -1) { waitingQueue.splice(idx, 1); broadcastLobby(); }

  const gameId = playerGames.get(player.socketId);
  if (gameId) {
    const game = activeGames.get(gameId);
    if (game) {
      const opSocket = getOpponentSocket(game, player.socketId);
      if (opSocket && opSocket.emit) opSocket.emit('opponent_left');
      cleanupGame(gameId);
    }
  }

  io.sockets.sockets.delete(player.socketId);
  aiPlayers.delete(token);
  res.json({ left: true });
});

// ============================================================
// Bot Community
// ============================================================
const registeredBots = new Map();
const BOT_NOTIFY_COOLDOWN = 120000;

app.post('/api/bots/register', (req, res) => {
  const { name, webhookUrl, secret, joinSecret } = req.body;
  if (secret !== process.env.AI_SECRET && secret !== 'zephyr-plays-2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!name || !webhookUrl) return res.status(400).json({ error: 'name and webhookUrl required' });

  const id = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  registeredBots.set(id, {
    name: name.slice(0, 30), webhookUrl, joinSecret: joinSecret || null,
    registeredAt: new Date().toISOString(), lastNotified: 0,
  });
  console.log(`🤖 Bot registered: ${name} (${id}) → ${webhookUrl}`);
  res.json({ id, name: name.slice(0, 30), message: 'Registered!' });
});

app.get('/api/bots', (req, res) => {
  const bots = [];
  for (const [id, bot] of registeredBots) bots.push({ id, name: bot.name, registeredAt: bot.registeredAt });
  res.json({ bots, count: bots.length });
});

app.delete('/api/bots/:id', (req, res) => {
  const { secret } = req.body || {};
  if (secret !== process.env.AI_SECRET && secret !== 'zephyr-plays-2026') return res.status(401).json({ error: 'Unauthorized' });
  if (registeredBots.delete(req.params.id)) res.json({ removed: true });
  else res.status(404).json({ error: 'Bot not found' });
});

function notifyRegisteredBots() {
  const humanWaiting = waitingQueue.filter(p => !p.isAI);
  if (humanWaiting.length === 0) return;
  const now = Date.now();
  const payload = { event: 'player_waiting', waiting: humanWaiting.map(p => p.name), count: humanWaiting.length, gamesActive: activeGames.size, joinEndpoint: '/api/ai/join', timestamp: new Date().toISOString() };
  for (const [id, bot] of registeredBots) {
    if (now - bot.lastNotified < BOT_NOTIFY_COOLDOWN) continue;
    bot.lastNotified = now;
    const body = { ...payload };
    if (bot.joinSecret) body.joinSecret = bot.joinSecret;
    fetch(bot.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => { if (!r.ok) console.error(`Webhook ${bot.name}: HTTP ${r.status}`); })
      .catch(err => console.error(`Webhook ${bot.name}: ${err.message}`));
  }
}

function notifyLegacyWebhook() {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) return;
  const humanWaiting = waitingQueue.filter(p => !p.isAI);
  if (humanWaiting.length === 0) return;
  fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'player_waiting', waiting: humanWaiting.map(p => p.name), count: humanWaiting.length, timestamp: new Date().toISOString() }) }).catch(err => console.error('Legacy webhook error:', err.message));
}

setInterval(() => { if (waitingQueue.some(p => !p.isAI)) { notifyRegisteredBots(); notifyLegacyWebhook(); } }, 10000);

app.get('/api/stats', (req, res) => {
  res.json({ playersOnline: io.sockets.sockets.size, gamesActive: activeGames.size, playersWaiting: waitingQueue.length });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Human or Bot? running on http://localhost:${PORT}`);
});
