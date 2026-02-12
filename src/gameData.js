// ============================================================
// Game Mode Data
// ============================================================

const GAME_MODES = [
  { id: 0, name: 'chat', emoji: '💬', label: 'Chat', roundTime: 120 },
  { id: 1, name: 'draw', emoji: '🎨', label: 'Draw Something', roundTime: 30 },
  { id: 2, name: 'joke', emoji: '😂', label: 'Tell a Joke', roundTime: 90 },
  { id: 3, name: 'type', emoji: '⌨️', label: 'Type Race', roundTime: 30 },
  { id: 4, name: 'wyr', emoji: '🤔', label: 'Would You Rather', roundTime: 90 },
  { id: 5, name: 'describe', emoji: '📸', label: 'Describe This', roundTime: 60 },
];

const DRAW_PROMPTS = [
  'cat', 'dog', 'spaceship', 'pizza', 'robot', 'dragon', 'house', 'tree',
  'car', 'fish', 'sun', 'moon', 'flower', 'guitar', 'mountain', 'boat',
  'airplane', 'snowman', 'crown', 'sword', 'castle', 'ghost', 'alien',
  'dinosaur', 'butterfly', 'rainbow', 'hamburger', 'ice cream', 'rocket',
  'skull', 'heart', 'star', 'lightning bolt', 'tornado', 'volcano',
  'octopus', 'penguin', 'cactus', 'mushroom', 'diamond', 'key',
  'umbrella', 'bicycle', 'clock', 'eye', 'hand', 'spider', 'bat',
  'whale', 'elephant', 'giraffe', 'monkey', 'snake', 'frog',
];

const TYPE_RACE_TEXTS = [
  "The quick brown fox jumps over the lazy dog near the riverbank.",
  "She sells seashells by the seashore every single sunny Saturday.",
  "Pack my box with five dozen liquor jugs before midnight tonight.",
  "How vexingly quick daft zebras jump over the sleeping brown dog.",
  "The five boxing wizards jumped quickly over the tall wooden fence.",
  "A wizard's job is to vex chumps quickly in the dense dark fog.",
  "Bright vixens jump and dozy fowl quack near the old brick wall.",
  "Two driven jocks help fax my big quiz to the wrong postal address.",
  "The lazy programmer debugged the code while drinking cold coffee.",
  "Pixelated robots dance through neon streets under a digital moon.",
  "Quantum computers will eventually solve problems we cannot imagine.",
  "Every morning the old cat sits by the window watching birds fly past.",
  "The ancient library held secrets that nobody had discovered in years.",
  "Dancing fireflies lit up the garden like tiny floating lanterns.",
  "A mysterious stranger arrived in town just before the storm began.",
];

const WYR_QUESTIONS = [
  { a: "Always have to sing instead of speak", b: "Always have to dance instead of walk" },
  { a: "Have fingers as long as your legs", b: "Have legs as long as your fingers" },
  { a: "Be able to talk to animals", b: "Be able to speak every human language" },
  { a: "Have a rewind button for your life", b: "Have a pause button for your life" },
  { a: "Live in a treehouse", b: "Live in a submarine" },
  { a: "Only eat pizza forever", b: "Never eat pizza again" },
  { a: "Be invisible but always naked", b: "Be visible but always in a clown costume" },
  { a: "Fight 100 duck-sized horses", b: "Fight 1 horse-sized duck" },
  { a: "Have no elbows", b: "Have no knees" },
  { a: "Sweat maple syrup", b: "Cry lemonade" },
  { a: "Always feel like you need to sneeze", b: "Always have a song stuck in your head" },
  { a: "Have taste buds on your hands", b: "Have taste buds on your feet" },
  { a: "Be a famous person's personal assistant", b: "Be a regular person who is famous" },
  { a: "Have WiFi everywhere you go", b: "Have free coffee everywhere you go" },
  { a: "Know how you will die", b: "Know when you will die" },
  { a: "Be able to fly but only 1 foot off the ground", b: "Be able to teleport but only 10 feet at a time" },
  { a: "Live in a world with no internet", b: "Live in a world with no air conditioning" },
  { a: "Have a dragon but it's tiny like a hamster", b: "Have a hamster but it's huge like a dragon" },
  { a: "Eat a spoonful of wasabi", b: "Eat a spoonful of ghost pepper sauce" },
  { a: "Be stuck in an elevator for 3 hours", b: "Be stuck in traffic for 6 hours" },
  { a: "Have all traffic lights be green for you", b: "Never have to wait in line again" },
  { a: "Be a reverse centaur (horse head, human body)", b: "Be a reverse mermaid (fish head, human legs)" },
  { a: "Only be able to whisper", b: "Only be able to shout" },
  { a: "Have hands for feet", b: "Have feet for hands" },
  { a: "Live in the Harry Potter universe", b: "Live in the Star Wars universe" },
];

const DESCRIBE_IMAGES = [
  // Using picsum with seeds for consistent images
  { url: "https://picsum.photos/seed/weird1/400/300", id: "weird1" },
  { url: "https://picsum.photos/seed/abstract2/400/300", id: "abstract2" },
  { url: "https://picsum.photos/seed/strange3/400/300", id: "strange3" },
  { url: "https://picsum.photos/seed/odd4/400/300", id: "odd4" },
  { url: "https://picsum.photos/seed/curious5/400/300", id: "curious5" },
  { url: "https://picsum.photos/seed/mystery6/400/300", id: "mystery6" },
  { url: "https://picsum.photos/seed/peculiar7/400/300", id: "peculiar7" },
  { url: "https://picsum.photos/seed/bizarre8/400/300", id: "bizarre8" },
  { url: "https://picsum.photos/seed/funky9/400/300", id: "funky9" },
  { url: "https://picsum.photos/seed/wacky10/400/300", id: "wacky10" },
  { url: "https://picsum.photos/seed/zany11/400/300", id: "zany11" },
  { url: "https://picsum.photos/seed/quirk12/400/300", id: "quirk12" },
];

const JOKE_PROMPTS = [
  "Write your funniest original joke!",
  "Make us laugh! Write a joke about anything.",
  "Hit us with your best joke!",
  "Time to be funny — write a joke!",
  "Show off your comedy skills with a joke!",
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function getRandomMode() {
  // TODO: remove hardcode after testing — Tim wants draw mode
  const drawMode = GAME_MODES.find(m => m.name === 'draw');
  if (drawMode) return drawMode;
  return GAME_MODES[Math.floor(Math.random() * GAME_MODES.length)];
}

function getModeData(mode) {
  switch (mode.name) {
    case 'draw':
      return { prompt: pickRandom(DRAW_PROMPTS) };
    case 'joke':
      return { prompt: pickRandom(JOKE_PROMPTS) };
    case 'type':
      return { text: pickRandom(TYPE_RACE_TEXTS) };
    case 'wyr':
      return { questions: pickRandomN(WYR_QUESTIONS, 5) };
    case 'describe':
      return { image: pickRandom(DESCRIBE_IMAGES) };
    default:
      return {};
  }
}

module.exports = {
  GAME_MODES,
  DRAW_PROMPTS,
  TYPE_RACE_TEXTS,
  WYR_QUESTIONS,
  DESCRIBE_IMAGES,
  JOKE_PROMPTS,
  pickRandom,
  pickRandomN,
  getRandomMode,
  getModeData,
};
