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
  } else if (waitingQueue.find(p => p.socketId === socket.id)) {
    // Already in queue
    return;
  } else {
    // Add to queue and wait
    waitingQueue.push({ socketId: socket.id, name: playerName });
    socket.emit('waiting', { position: waitingQueue.length });
  }
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
    if (idx !== -1) waitingQueue.splice(idx, 1);

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
