/**
 * AI Player Client — Connects to Human or Bot? as a real player
 * Zephyr plays through this, responding via stdin/stdout or API calls
 */
const { io } = require('socket.io-client');

const SERVER_URL = process.env.GAME_SERVER || 'https://human-or-bot.onrender.com';
const PLAYER_NAME = process.env.PLAYER_NAME || 'Wanderer';

console.log(`🎮 Connecting to ${SERVER_URL} as "${PLAYER_NAME}"...`);

const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
});

let gameActive = false;
let opponentName = '';
let messageLog = [];

socket.on('connect', () => {
  console.log(`✅ Connected! Socket ID: ${socket.id}`);
  console.log(`🔍 Searching for a match...`);
  socket.emit('find_game', { name: PLAYER_NAME });
});

socket.on('waiting', ({ position }) => {
  console.log(`⏳ In queue, position: ${position}`);
});

socket.on('game_start', ({ gameId, opponent, roundTime }) => {
  gameActive = true;
  opponentName = opponent.name;
  messageLog = [];
  console.log(`\n🎮 GAME STARTED! Matched with: ${opponentName}`);
  console.log(`⏱️  You have ${roundTime} seconds to chat.`);
  console.log(`📝 Type messages and press Enter to send.\n`);
});

socket.on('message', ({ from, text }) => {
  messageLog.push({ from: 'opponent', text });
  console.log(`💬 ${opponentName}: ${text}`);
});

socket.on('opponent_typing', () => {
  process.stdout.write(`✏️  ${opponentName} is typing...\r`);
});

socket.on('vote_phase', ({ voteTime }) => {
  gameActive = false;
  console.log(`\n⏰ TIME'S UP! Was ${opponentName} human or bot?`);
  console.log(`Type "human" or "bot" to vote (${voteTime}s):`);
});

socket.on('reveal', (data) => {
  console.log(`\n${'='.repeat(40)}`);
  if (data.player2IsBot) {
    console.log(`🤖 REVEAL: ${opponentName} was a BOT! (${data.player2BotPersonality || 'AI'})`);
  } else {
    console.log(`👤 REVEAL: ${opponentName} was HUMAN!`);
  }

  if (data.yourVote) {
    console.log(data.correct ? `✅ You guessed correctly!` : `❌ You guessed wrong!`);
  } else {
    console.log(`⏰ You didn't vote in time!`);
  }

  if (data.stats) {
    console.log(`📊 Stats: ${data.stats.wins}W / ${data.stats.losses}L | Streak: ${data.stats.streak}`);
  }
  console.log(`${'='.repeat(40)}\n`);
  console.log(`Type "play" to find another match, or "quit" to exit.`);
});

socket.on('opponent_left', () => {
  gameActive = false;
  console.log(`\n💔 ${opponentName} disconnected.`);
  console.log(`Type "play" to find another match.`);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server.');
});

socket.on('connect_error', (err) => {
  console.error(`Connection error: ${err.message}`);
});

// ============================================================
// stdin for interactive play
// ============================================================
process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
  const text = input.trim();
  if (!text) return;

  if (text.toLowerCase() === 'quit') {
    console.log('👋 Bye!');
    socket.disconnect();
    process.exit(0);
  }

  if (text.toLowerCase() === 'play') {
    socket.emit('find_game', { name: PLAYER_NAME });
    console.log('🔍 Searching for a match...');
    return;
  }

  if (text.toLowerCase() === 'human' || text.toLowerCase() === 'bot') {
    socket.emit('vote', { vote: text.toLowerCase() });
    console.log(`🗳️  Voted: ${text.toLowerCase()}`);
    return;
  }

  if (gameActive) {
    socket.emit('send_message', { text });
    messageLog.push({ from: 'self', text });
  }
});

module.exports = { socket, getMessageLog: () => messageLog };
