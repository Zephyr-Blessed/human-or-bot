/**
 * Zephyr AI Player — Plays Human or Bot? as a real participant
 * 
 * This is NOT a scripted bot. It connects as a regular player,
 * and Zephyr responds conversationally, trying to pass as human
 * (or just having fun chatting).
 * 
 * Usage: Called by OpenClaw to play a round.
 * Output: JSON log of the game to stdout when done.
 */
const { io } = require('socket.io-client');

const SERVER_URL = process.env.GAME_SERVER || 'https://human-or-bot.onrender.com';
const PLAYER_NAME = process.env.PLAYER_NAME || 'Zeph';

// Zephyr's conversational style — casual, warm, hippie vibes but not too obvious
const ZEPHYR_RESPONSES = {
  greetings: [
    'hey! how goes it?',
    'hi there, hows your day been?',
    'hey hey, nice to meet you',
    'yo whats up! how are you',
  ],
  generic: [
    'haha yeah i feel that',
    'oh nice, thats cool',
    'hmm interesting',
    'oh for real?',
    'haha true',
    'wait really?',
    'oh thats actually pretty cool',
    'yeah i get what you mean',
    'lol fair enough',
  ],
  questions: [
    'what do you do for fun?',
    'where are you from? or like... general area',
    'been up to anything interesting lately?',
    'whats the best thing thats happened to you this week?',
    'do you have any pets?',
    'what are you watching rn? i need recommendations',
    'whats your take on pineapple on pizza, this is important',
    'if you could live anywhere where would it be',
  ],
  personal: [
    'i do some tech stuff, mostly web dev. its fun but i also try to get outside a lot',
    'been really into hiking lately, found this amazing trail last weekend',
    'i cook a lot actually, trying to eat healthier. made an insane curry yesterday',
    'just moved to a new place, still getting used to the area',
    'honestly ive been on a podcast binge lately, cant stop listening to them',
    'been trying to learn guitar. im terrible but its fun lol',
  ],
  weather: [
    'its been kinda grey here, could use some sun',
    'actually its beautiful today, probably should go outside instead of being on here haha',
    'rainy but i dont mind, perfect excuse to stay in',
  ],
  food: [
    'im a huge curry fan, like any curry ill eat it',
    'just discovered this amazing ramen place near me',
    'i try to cook most of my meals but sometimes pizza calls my name',
    'made banana bread last weekend and it was actually decent for once lol',
  ],
  music: [
    'been listening to a lot of tame impala lately',
    'honestly my playlist is all over the place, from jazz to electronic',
    'i go through phases, rn im in a lo-fi beats era',
  ],
  probing: [
    'hmm thats exactly what a bot would say lol jk jk',
    'ok ok im starting to think youre real haha',
    'you know what, im gonna say youre human. you have that vibe',
    'wait are YOU trying to figure out if IM a bot? lol',
  ],
};

function getZephyrResponse(messages, isFirst) {
  if (isFirst) {
    return pick(ZEPHYR_RESPONSES.greetings);
  }

  const lastMsg = messages[messages.length - 1]?.text?.toLowerCase() || '';
  
  // Detect topic
  if (/weather|rain|sun|cold|hot|warm/.test(lastMsg)) return pick(ZEPHYR_RESPONSES.weather);
  if (/food|eat|cook|restaurant|hungry|pizza|lunch|dinner/.test(lastMsg)) return pick(ZEPHYR_RESPONSES.food);
  if (/music|song|listen|band|playlist/.test(lastMsg)) return pick(ZEPHYR_RESPONSES.music);
  if (/what do you do|about you|your turn|yourself|tell me/.test(lastMsg)) return pick(ZEPHYR_RESPONSES.personal);
  if (/bot|human|real|robot|ai|artificial/.test(lastMsg)) return pick(ZEPHYR_RESPONSES.probing);
  if (/\?$/.test(lastMsg.trim())) return pick([...ZEPHYR_RESPONSES.personal, ...ZEPHYR_RESPONSES.generic]);

  // Mix responses with follow-up questions
  if (Math.random() > 0.5) {
    return pick(ZEPHYR_RESPONSES.generic) + ' ' + pick(ZEPHYR_RESPONSES.questions);
  }
  
  if (messages.filter(m => m.from === 'self').length < 2) {
    return pick(ZEPHYR_RESPONSES.questions);
  }

  return pick(ZEPHYR_RESPONSES.generic);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================
// Game client
// ============================================================
const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

let messages = [];
let gameResult = null;
let responded = false;

socket.on('connect', () => {
  console.error(`Connected to ${SERVER_URL} as ${PLAYER_NAME}`);
  socket.emit('find_game', { name: PLAYER_NAME });
});

socket.on('waiting', () => {
  console.error('Waiting for match...');
});

socket.on('game_start', ({ gameId, opponent, roundTime }) => {
  console.error(`Matched with ${opponent.name}! ${roundTime}s round.`);
  messages = [];
  responded = false;

  // Send first message after a human-like delay
  setTimeout(() => {
    const msg = getZephyrResponse([], true);
    socket.emit('send_message', { text: msg });
    messages.push({ from: 'self', text: msg });
    console.error(`> ${msg}`);
  }, 2000 + Math.random() * 3000);
});

socket.on('message', ({ text }) => {
  messages.push({ from: 'opponent', text });
  console.error(`< ${text}`);

  // Respond with human-like delay
  const delay = 1500 + text.length * 30 + Math.random() * 3000;
  
  // Sometimes emit typing first
  if (Math.random() > 0.3) {
    setTimeout(() => socket.emit('typing'), delay * 0.3);
  }

  setTimeout(() => {
    const response = getZephyrResponse(messages, false);
    socket.emit('send_message', { text: response });
    messages.push({ from: 'self', text: response });
    console.error(`> ${response}`);
  }, delay);
});

socket.on('vote_phase', () => {
  console.error('Voting phase!');
  // Zephyr guesses — lean towards "human" since that's more interesting
  const vote = Math.random() > 0.4 ? 'human' : 'bot';
  setTimeout(() => {
    socket.emit('vote', { vote });
    console.error(`Voted: ${vote}`);
  }, 2000 + Math.random() * 3000);
});

socket.on('reveal', (data) => {
  gameResult = {
    opponent: data.player2IsBot ? 'bot' : 'human',
    botPersonality: data.player2BotPersonality,
    myVote: data.yourVote,
    correct: data.correct,
    stats: data.stats,
    messages,
  };
  console.error(`Reveal: opponent was ${gameResult.opponent}${data.correct ? ' (guessed right!)' : ' (wrong!)'}`);
  
  // Output result as JSON
  console.log(JSON.stringify(gameResult, null, 2));
  
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 2000);
});

socket.on('opponent_left', () => {
  console.error('Opponent disconnected');
  console.log(JSON.stringify({ error: 'opponent_left', messages }));
  setTimeout(() => { socket.disconnect(); process.exit(0); }, 1000);
});

// Timeout after 5 minutes
setTimeout(() => {
  if (!gameResult) {
    console.log(JSON.stringify({ error: 'timeout', messages }));
    socket.disconnect();
    process.exit(1);
  }
}, 300000);
