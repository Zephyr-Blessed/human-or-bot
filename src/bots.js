// ============================================================
// Bot personalities for the Turing test game
// ============================================================

const PERSONALITIES = [
  {
    name: 'casual',
    displayNames: ['Alex', 'Jordan', 'Sam', 'Riley', 'Casey', 'Morgan'],
    style: 'casual, uses lowercase, occasional typos, short messages',
    greetings: [
      'hey! whats up',
      'hii how are you',
      'yo! nice to meet you',
      'heyyy',
      'hi there! hows your day going',
      'sup!',
    ],
    responses: {
      weather: ['its been pretty nice here lately tbh', 'ugh rainy all week lol', 'honestly i dont go outside enough to know haha'],
      hobbies: ['i play guitar sometimes, nothing serious tho', 'mostly just watching stuff on youtube lol', 'been getting into cooking lately, still terrible at it', 'video games mostly, u?'],
      work: ['i do some freelance stuff, nothing crazy', 'student life lol', 'office job, pretty boring honestly', 'working from home which is nice i guess'],
      music: ['been listening to a lot of indie stuff lately', 'honestly i listen to everything', 'currently obsessed with this one playlist lol'],
      food: ['im a pizza person 100%', 'anything spicy honestly', 'just had the best ramen of my life last week'],
      generic: ['haha yeah', 'lol true', 'oh nice', 'yeah for sure', 'hmm idk', 'thats cool', 'oh really?', 'haha wait what', 'makes sense', 'oh interesting'],
      questions: ['what about you?', 'wbu?', 'how about u?', 'u?', 'what do you think?', 'and you?'],
    },
  },
  {
    name: 'formal',
    displayNames: ['Professor_K', 'Victoria', 'Theodore', 'Eleanor', 'Sebastian'],
    style: 'proper grammar, thoughtful, longer messages',
    greetings: [
      'Hello! Pleased to meet you.',
      'Good day! How are you doing?',
      'Hi there! I hope you\'re having a good day.',
      'Hello! This is quite an interesting concept, isn\'t it?',
    ],
    responses: {
      weather: ['The weather has been quite pleasant lately, though I do miss the cooler months.', 'I actually enjoy rainy days — perfect for reading.'],
      hobbies: ['I\'m an avid reader, mostly non-fiction. Currently working through a book on behavioral economics.', 'I enjoy hiking when I can. There\'s something restorative about being in nature.', 'Photography has been a recent interest of mine. Still learning the basics.'],
      work: ['I work in education, which I find quite rewarding.', 'I\'m in research, which can be tedious but fascinating.'],
      music: ['Classical music, primarily. Though I\'ve been exploring jazz lately.', 'I appreciate a wide range of genres, but I tend to gravitate toward folk music.'],
      food: ['I\'ve been trying to cook more Mediterranean dishes lately.', 'I have a weakness for good sushi. Do you enjoy cooking?'],
      generic: ['That\'s an interesting point.', 'I see what you mean.', 'Indeed.', 'That\'s quite fascinating.', 'I hadn\'t thought of it that way.', 'How thought-provoking.'],
      questions: ['What are your thoughts on that?', 'I\'d love to hear your perspective.', 'What about yourself?', 'Do you have similar interests?'],
    },
  },
  {
    name: 'enthusiastic',
    displayNames: ['Sparky', 'Luna', 'Max', 'Ziggy', 'Pepper'],
    style: 'energetic, uses exclamation marks, very friendly',
    greetings: [
      'OMG HI!! This is so fun!',
      'Heyyy!! Super excited to chat with you!',
      'Hi hi hi! Whats good?? 😄',
      'HELLOOO! I love meeting new people!',
    ],
    responses: {
      weather: ['I LOVE sunny days!! Makes me want to go on adventures!', 'Rain is actually so cozy though!! Perfect for blanket forts haha'],
      hobbies: ['I am SO into painting right now!! Like everything is a canvas to me lol', 'Dancing!! I take classes and theyre the BEST part of my week!', 'Hiking and exploring new places!! Just discovered this amazing trail!'],
      work: ['I work at a coffee shop and honestly I love it!! Meeting people all day!', 'Im studying design and its SO COOL learning about color theory and stuff!'],
      music: ['Oh man I listen to EVERYTHING!! But pop-punk has my heart forever!', 'Currently cannot stop listening to this one song on repeat lol!!'],
      food: ['TACOS. The answer is always tacos!! 🌮', 'I just tried making homemade pasta and it was INCREDIBLE!!'],
      generic: ['OMG YES!!', 'hahaha thats amazing!!', 'NO WAY!!', 'I love that so much!', 'thats literally the best thing ever!', 'wait thats awesome!!', 'SO COOL!'],
      questions: ['What about you?? Tell me everything!!', 'OMG what do YOU like??', 'Your turn your turn!!', 'I wanna know about you!!'],
    },
  },
  {
    name: 'chill',
    displayNames: ['Zen', 'Mellow', 'River', 'Sage', 'Ocean'],
    style: 'relaxed, philosophical, uses ellipsis, minimal punctuation',
    greetings: [
      'hey... nice to meet you',
      'hi there. hows life treating you',
      'hey. hope youre having a good one',
      'yo... whats on your mind today',
    ],
    responses: {
      weather: ['honestly i just vibe with whatever the weather does... cant control it right', 'sunsets have been wild lately... like nature is showing off'],
      hobbies: ['been meditating a lot lately... its changed how i see everything', 'i surf when the waves are good... theres nothing like it', 'mostly just reading and thinking... trying to figure life out you know'],
      work: ['i do some freelance design stuff... pays the bills and i get to be creative', 'working on a passion project right now... cant say too much about it yet'],
      music: ['lo-fi beats mostly... helps me focus', 'been into ambient stuff lately... brian eno type vibes'],
      food: ['simple food done well... like a perfect bowl of rice', 'just got into fermentation... making my own kimchi'],
      generic: ['yeah...', 'hmm i feel that', 'interesting...', 'true true', 'i get you', 'makes sense...', 'deep...', 'yeah thats real'],
      questions: ['what about you... what drives you', 'how do you spend your time', 'curious... what matters most to you'],
    },
  },
  {
    name: 'skeptic',
    displayNames: ['Dave', 'Karen', 'Mike', 'Janet', 'Bob'],
    style: 'suspicious, asks probing questions, tries to seem very human',
    greetings: [
      'alright lets see who I got matched with',
      'hi. so are you a real person or what',
      'ok let me just ask... are you actually human lol',
      'hey. im already suspicious of you haha',
    ],
    responses: {
      weather: ['why do bots always ask about weather lol... but yeah its cold here', 'the weather is fine. more importantly, what did you have for breakfast'],
      hobbies: ['i watch too much netflix honestly. just binged that new show... you know the one', 'i coach my kids soccer team on weekends. theyre terrible but its fun'],
      work: ['IT stuff. its as boring as it sounds trust me', 'retail. dont get me started lol'],
      music: ['i still listen to stuff from like 2010 and im not ashamed', 'whatever comes on the radio honestly'],
      food: ['my wife makes the best lasagna. fight me on that', 'fast food. im not proud of it'],
      generic: ['hmm thats exactly what a bot would say', 'ok that sounds human enough i guess', 'suspicious...', 'alright alright', 'thats what they all say', 'prove it lol'],
      questions: ['what year were you born', 'whats your favorite smell', 'tell me something a robot would never say', 'quick whats 7 times 8', 'what did you eat today'],
    },
  },
];

let botCounter = 0;

function createBot() {
  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  const name = personality.displayNames[Math.floor(Math.random() * personality.displayNames.length)];
  const id = `bot_${++botCounter}`;

  let messageCount = 0;
  let lastCategory = null;

  function getResponse(history) {
    messageCount++;
    const lastPlayerMsg = [...history].reverse().find(m => m.from !== 'bot');
    const text = (lastPlayerMsg?.text || '').toLowerCase();

    // First message: greeting
    if (messageCount === 1 && history.filter(m => m.from === 'bot').length === 0) {
      return pick(personality.greetings);
    }

    // Detect topic
    let category = 'generic';
    if (/weather|rain|sun|cold|hot|snow|warm|outside/.test(text)) category = 'weather';
    else if (/hobby|hobbies|fun|free time|weekend|do for fun/.test(text)) category = 'hobbies';
    else if (/work|job|career|study|school|college/.test(text)) category = 'work';
    else if (/music|song|listen|band|playlist|spotify/.test(text)) category = 'music';
    else if (/food|eat|cook|restaurant|hungry|lunch|dinner|breakfast/.test(text)) category = 'food';
    else if (/\?/.test(text)) category = pickFrom(['generic', 'questions']) ;

    // Avoid repeating same category
    if (category === lastCategory && Math.random() > 0.5) {
      category = pickFrom(['generic', 'questions']);
    }
    lastCategory = category;

    const responses = personality.responses[category] || personality.responses.generic;
    let response = pick(responses);

    // Sometimes add a follow-up question
    if (Math.random() > 0.6 && category !== 'questions') {
      response += ' ' + pick(personality.responses.questions);
    }

    // Sometimes add typo-like behaviors for casual bots
    if (personality.name === 'casual' && Math.random() > 0.7) {
      response = addTypo(response);
    }

    return response;
  }

  return { id, name, personality: personality.name, getResponse };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function addTypo(text) {
  const typos = [
    [/the /g, 'teh '],
    [/you/g, 'u'],
    [/\. /g, '.. '],
    [/!/, '!!'],
  ];
  const typo = pick(typos);
  return Math.random() > 0.5 ? text.replace(typo[0], typo[1]) : text;
}

module.exports = { createBot };
