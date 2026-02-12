const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
// Bots removed — pure human-to-human (or AI player) matchmaking only

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '../public')));

// ============================================================
// Game State
// ============================================================
const waitingQueue = [];        // players waiting for a match
const activeGames = new Map();  // gameId -> Game
const playerGames = new Map();  // socketId -> gameId
const playerStats = new Map();  // socketId -> { wins, losses, streak }

const ROUND_TIME = 120;  // 2 minutes
const VOTE_TIME = 15;    // 15 seconds to vote

class Game {
  constructor(id, player1, player2, player2IsBot = false) {
    this.id = id;
    this.player1 = player1;  // { socketId, name }
    this.player2 = player2;  // { socketId, name } or { botId, name, isBot: true }
    this.player2IsBot = player2IsBot;
    this.messages = [];
    this.votes = {};          // socketId -> 'human' | 'bot'
    this.phase = 'chat';      // chat | voting | reveal
    this.startTime = Date.now();
    this.timer = null;
    this.voteTimer = null;
  }
}

let gameCounter = 0;

function generateGameId() {
  return `game_${++gameCounter}_${Date.now().toString(36)}`;
}

// ============================================================
// Matchmaking
// ============================================================
function tryMatch(socket, playerName) {
  // Pure matchmaking — only match with real players in the queue
  if (waitingQueue.length > 0 && waitingQueue[0].socketId !== socket.id) {
    // Match with waiting human
    const opponent = waitingQueue.shift();
    const gameId = generateGameId();
    const game = new Game(gameId,
      { socketId: opponent.socketId, name: opponent.name },
      { socketId: socket.id, name: playerName },
      false
    );
    startGame(game);
    broadcastLobby();
  } else if (waitingQueue.find(p => p.socketId === socket.id)) {
    // Already in queue
    return;
  } else {
    // Add to queue and wait
    waitingQueue.push({ socketId: socket.id, name: playerName });
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

  // Register player 1
  playerGames.set(game.player1.socketId, game.id);
  const s1 = io.sockets.sockets.get(game.player1.socketId);
  if (s1) {
    s1.emit('game_start', {
      gameId: game.id,
      opponent: { name: game.player2.name },
      roundTime: ROUND_TIME,
    });
  }

  // Register player 2 (if human)
  if (!game.player2IsBot) {
    playerGames.set(game.player2.socketId, game.id);
    const s2 = io.sockets.sockets.get(game.player2.socketId);
    if (s2) {
      s2.emit('game_start', {
        gameId: game.id,
        opponent: { name: game.player1.name },
        roundTime: ROUND_TIME,
      });
    }
  }

  // Start round timer
  game.timer = setTimeout(() => endChatPhase(game.id), ROUND_TIME * 1000);

  // If bot, send first message after a short delay
  if (game.player2IsBot && game.bot) {
    setTimeout(() => {
      botSendMessage(game);
    }, 1500 + Math.random() * 2000);
  }
}

function endChatPhase(gameId) {
  const game = activeGames.get(gameId);
  if (!game || game.phase !== 'chat') return;

  game.phase = 'voting';

  // Notify players
  const s1 = io.sockets.sockets.get(game.player1.socketId);
  if (s1) s1.emit('vote_phase', { voteTime: VOTE_TIME });

  if (!game.player2IsBot) {
    const s2 = io.sockets.sockets.get(game.player2.socketId);
    if (s2) s2.emit('vote_phase', { voteTime: VOTE_TIME });
  }

  // Vote timer
  game.voteTimer = setTimeout(() => endVotePhase(gameId), VOTE_TIME * 1000);
}

function endVotePhase(gameId) {
  const game = activeGames.get(gameId);
  if (!game || game.phase !== 'voting') return;

  game.phase = 'reveal';

  // Determine results
  const p1Vote = game.votes[game.player1.socketId];
  const p1Correct = game.player2IsBot ? p1Vote === 'bot' : p1Vote === 'human';

  let p2Vote = null;
  let p2Correct = null;
  if (!game.player2IsBot) {
    p2Vote = game.votes[game.player2.socketId];
    p2Correct = p2Vote === 'human'; // player 1 is always human
  }

  // Update stats
  updateStats(game.player1.socketId, p1Correct);
  if (!game.player2IsBot) {
    updateStats(game.player2.socketId, p2Correct);
  }

  const reveal = {
    player2IsBot: game.player2IsBot,
    player2Name: game.player2.name,
    player1Name: game.player1.name,
    player2BotPersonality: game.player2IsBot ? game.bot?.personality : null,
  };

  // Send results to player 1
  const s1 = io.sockets.sockets.get(game.player1.socketId);
  if (s1) {
    s1.emit('reveal', {
      ...reveal,
      yourVote: p1Vote,
      correct: p1Correct,
      stats: getStats(game.player1.socketId),
    });
  }

  // Send results to player 2 (if human)
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

  // Cleanup after a delay
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
  if (correct) {
    stats.wins++;
    stats.streak++;
  } else {
    stats.losses++;
    stats.streak = 0;
  }
  playerStats.set(socketId, stats);
}

function getStats(socketId) {
  return playerStats.get(socketId) || { wins: 0, losses: 0, streak: 0, totalGames: 0 };
}

// ============================================================
// Bot Chat
// ============================================================
function botSendMessage(game) {
  if (!game.bot || game.phase !== 'chat') return;

  const response = game.bot.getResponse(game.messages);
  if (response) {
    // Simulate typing delay
    const typingDelay = Math.max(800, response.length * 40 + Math.random() * 1500);

    const s1 = io.sockets.sockets.get(game.player1.socketId);
    if (s1) s1.emit('opponent_typing');

    setTimeout(() => {
      if (game.phase !== 'chat') return;
      const msg = { from: 'opponent', text: response, timestamp: Date.now() };
      game.messages.push({ from: 'bot', text: response });
      if (s1) s1.emit('message', msg);
    }, typingDelay);
  }
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

  socket.on('send_message', ({ text }) => {
    const gameId = playerGames.get(socket.id);
    if (!gameId) return;
    const game = activeGames.get(gameId);
    if (!game || game.phase !== 'chat') return;

    const cleanText = (text || '').slice(0, 500);
    if (!cleanText) return;

    game.messages.push({ from: socket.id, text: cleanText });

    // Send to opponent
    if (game.player1.socketId === socket.id) {
      if (game.player2IsBot) {
        // Trigger bot response
        setTimeout(() => botSendMessage(game), 500 + Math.random() * 1000);
      } else {
        const s2 = io.sockets.sockets.get(game.player2.socketId);
        if (s2) s2.emit('message', { from: 'opponent', text: cleanText, timestamp: Date.now() });
      }
    } else {
      const s1 = io.sockets.sockets.get(game.player1.socketId);
      if (s1) s1.emit('message', { from: 'opponent', text: cleanText, timestamp: Date.now() });
    }
  });

  socket.on('typing', () => {
    const gameId = playerGames.get(socket.id);
    if (!gameId) return;
    const game = activeGames.get(gameId);
    if (!game || game.phase !== 'chat') return;

    if (game.player1.socketId === socket.id && !game.player2IsBot) {
      const s2 = io.sockets.sockets.get(game.player2.socketId);
      if (s2) s2.emit('opponent_typing');
    } else if (game.player2.socketId === socket.id) {
      const s1 = io.sockets.sockets.get(game.player1.socketId);
      if (s1) s1.emit('opponent_typing');
    }
  });

  socket.on('vote', ({ vote }) => {
    const gameId = playerGames.get(socket.id);
    if (!gameId) return;
    const game = activeGames.get(gameId);
    if (!game || game.phase !== 'voting') return;
    if (vote !== 'human' && vote !== 'bot') return;

    game.votes[socket.id] = vote;

    // If all humans have voted, end early
    const neededVotes = game.player2IsBot ? 1 : 2;
    if (Object.keys(game.votes).length >= neededVotes) {
      clearTimeout(game.voteTimer);
      endVotePhase(gameId);
    }
  });

  socket.on('disconnect', () => {
    // Remove from queue
    const idx = waitingQueue.findIndex(p => p.socketId === socket.id);
    if (idx !== -1) {
      waitingQueue.splice(idx, 1);
      broadcastLobby();
    }

    // Handle active game
    const gameId = playerGames.get(socket.id);
    if (gameId) {
      const game = activeGames.get(gameId);
      if (game && game.phase === 'chat') {
        // Notify opponent
        const opponentId = game.player1.socketId === socket.id
          ? (game.player2IsBot ? null : game.player2.socketId)
          : game.player1.socketId;
        if (opponentId) {
          const s = io.sockets.sockets.get(opponentId);
          if (s) s.emit('opponent_left');
        }
        cleanupGame(gameId);
      }
    }
  });
});

// ============================================================
// AI Player HTTP API — allows AI to play via REST calls
// ============================================================
const aiPlayers = new Map(); // token -> { socketId, name, messages, pendingMessages }

app.use(express.json());

// Join the queue as an AI player
app.post('/api/ai/join', (req, res) => {
  const { name, secret } = req.body;
  if (secret !== process.env.AI_SECRET && secret !== 'zephyr-plays-2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = `ai_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  
  // Create a virtual socket for the AI player
  const virtualSocket = {
    id: `ai_${token}`,
    emit: (event, data) => {
      const player = aiPlayers.get(token);
      if (!player) return;
      
      if (event === 'game_start') {
        player.gameStarted = true;
        player.opponent = data.opponent.name;
        player.roundTime = data.roundTime;
        player.gameId = data.gameId;
        player.events.push({ type: 'game_start', data, timestamp: Date.now() });
      } else if (event === 'message') {
        player.pendingMessages.push({ from: data.from, text: data.text, timestamp: Date.now() });
        player.events.push({ type: 'message', data, timestamp: Date.now() });
      } else if (event === 'opponent_typing') {
        player.events.push({ type: 'opponent_typing', timestamp: Date.now() });
      } else if (event === 'vote_phase') {
        player.phase = 'voting';
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

  // Register virtual socket
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
  };
  
  aiPlayers.set(token, playerData);

  // Join the matchmaking queue
  tryMatch(virtualSocket, playerData.name);

  res.json({ token, message: `Joined as ${playerData.name}. Poll /api/ai/poll for updates.` });
});

// Poll for game state and new messages
app.get('/api/ai/poll', (req, res) => {
  const token = req.headers['x-ai-token'];
  const player = aiPlayers.get(token);
  if (!player) return res.status(401).json({ error: 'Invalid token' });

  const newMessages = [...player.pendingMessages];
  player.pendingMessages = [];

  const recentEvents = player.events.slice(-20);

  res.json({
    phase: player.phase,
    gameStarted: player.gameStarted,
    opponent: player.opponent,
    newMessages,
    allMessages: player.messages,
    events: recentEvents,
    lobby: player.lobby,
    reveal: player.revealData,
  });
});

// Send a message
app.post('/api/ai/send', (req, res) => {
  const token = req.headers['x-ai-token'];
  const player = aiPlayers.get(token);
  if (!player) return res.status(401).json({ error: 'Invalid token' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text' });

  const gameId = playerGames.get(player.socketId);
  if (!gameId) return res.status(400).json({ error: 'Not in a game' });
  
  const game = activeGames.get(gameId);
  if (!game || game.phase !== 'chat') return res.status(400).json({ error: 'Game not in chat phase' });

  const cleanText = text.slice(0, 500);
  game.messages.push({ from: player.socketId, text: cleanText });
  player.messages.push({ from: 'self', text: cleanText });

  // Send to opponent
  const opponentSocketId = game.player1.socketId === player.socketId 
    ? game.player2.socketId 
    : game.player1.socketId;
  
  const opponentSocket = io.sockets.sockets.get(opponentSocketId);
  if (opponentSocket && opponentSocket.emit) {
    opponentSocket.emit('message', { from: 'opponent', text: cleanText, timestamp: Date.now() });
  }

  res.json({ sent: true, text: cleanText });
});

// Vote
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

  // Check if all voted
  const neededVotes = game.player2IsBot ? 1 : 2;
  if (Object.keys(game.votes).length >= neededVotes) {
    clearTimeout(game.voteTimer);
    endVotePhase(gameId);
  }

  res.json({ voted: vote });
});

// Leave
app.post('/api/ai/leave', (req, res) => {
  const token = req.headers['x-ai-token'];
  const player = aiPlayers.get(token);
  if (!player) return res.status(401).json({ error: 'Invalid token' });

  // Remove from queue
  const idx = waitingQueue.findIndex(p => p.socketId === player.socketId);
  if (idx !== -1) {
    waitingQueue.splice(idx, 1);
    broadcastLobby();
  }

  // Clean up game
  const gameId = playerGames.get(player.socketId);
  if (gameId) {
    const game = activeGames.get(gameId);
    if (game) {
      const opponentId = game.player1.socketId === player.socketId
        ? game.player2.socketId : game.player1.socketId;
      const opponentSocket = io.sockets.sockets.get(opponentId);
      if (opponentSocket && opponentSocket.emit) opponentSocket.emit('opponent_left');
      cleanupGame(gameId);
    }
  }

  io.sockets.sockets.delete(player.socketId);
  aiPlayers.delete(token);
  res.json({ left: true });
});

// ============================================================
// Server stats endpoint
// ============================================================
app.get('/api/stats', (req, res) => {
  res.json({
    playersOnline: io.sockets.sockets.size,
    gamesActive: activeGames.size,
    playersWaiting: waitingQueue.length,
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Human or Bot? running on http://localhost:${PORT}`);
});
