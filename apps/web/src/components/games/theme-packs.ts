import type { QuizQuestion } from "./UniverseQuiz";

/**
 * Games for children who don't have universe history yet (first story, one-off stories): picture
 * cards and a fun quiz matching the theme of the story being made. Ages 4–12, so questions are easy.
 */
export interface ThemePack { emojis: string[]; quiz: QuizQuestion[] }

const q = (question: string, answer: string, wrong: [string, string]): QuizQuestion => ({ q: question, answer, options: [answer, ...wrong] });

export const THEME_PACKS: Record<string, ThemePack> = {
  "space-adventure": {
    emojis: ["🚀", "🪐", "🌙", "⭐", "👽", "☄️"],
    quiz: [
      q("Which planet do we live on?", "Earth", ["Mars", "Jupiter"]),
      q("What is the Sun?", "A star", ["A planet", "A moon"]),
      q("Which planet is called the Red Planet?", "Mars", ["Venus", "Saturn"]),
      q("What do astronauts wear in space?", "A space suit", ["A raincoat", "Pyjamas"]),
      q("Which planet has big beautiful rings?", "Saturn", ["Mercury", "Earth"]),
    ],
  },
  "superhero-mission": {
    emojis: ["🦸", "⚡", "🛡️", "🦹", "💥", "🏙️"],
    quiz: [
      q("What should a hero do when someone needs help?", "Help them", ["Run away", "Laugh at them"]),
      q("Which of these is a super power?", "Flying", ["Yawning", "Sleeping"]),
      q("What do many heroes wear on their back?", "A cape", ["A pillow", "A tray"]),
      q("Being brave means…", "Doing the right thing even when scared", ["Never feeling scared", "Shouting loudly"]),
      q("What makes a super team?", "Sharing and helping", ["Grabbing everything", "Not talking"]),
    ],
  },
  "jungle-quest": {
    emojis: ["🦁", "🐘", "🐒", "🦜", "🐯", "🌴"],
    quiz: [
      q("Which animal is called the King of the Jungle?", "Lion", ["Rabbit", "Cow"]),
      q("Which animal has a long trunk?", "Elephant", ["Giraffe", "Tiger"]),
      q("Which bird can copy words people say?", "Parrot", ["Pigeon", "Owl"]),
      q("What is India's national animal?", "Tiger", ["Peacock", "Lion"]),
      q("What do monkeys love to eat?", "Bananas", ["Pizza", "Ice cream"]),
    ],
  },
  "underwater-adventure": {
    emojis: ["🐠", "🐙", "🐳", "🦀", "🐬", "🐚"],
    quiz: [
      q("What do fish use to breathe underwater?", "Gills", ["Nose", "Ears"]),
      q("How many arms does an octopus have?", "8", ["4", "10"]),
      q("What is the biggest animal in the ocean?", "Blue whale", ["Shark", "Dolphin"]),
      q("Which sea animal walks sideways?", "Crab", ["Jellyfish", "Starfish"]),
      q("Where do starfish live?", "In the sea", ["In the desert", "In trees"]),
    ],
  },
  "detective-mystery": {
    emojis: ["🔍", "🕵️", "👣", "🗝️", "📜", "🔦"],
    quiz: [
      q("What does a detective look for?", "Clues", ["Socks", "Sweets"]),
      q("Which tool helps you see tiny things?", "A magnifying glass", ["A spoon", "An umbrella"]),
      q("Footprints can tell you…", "Where someone walked", ["What time it is", "What's for dinner"]),
      q("A good detective always…", "Asks questions", ["Gives up", "Shouts"]),
      q("Which light helps in a dark room?", "A torch", ["A pillow", "A sock"]),
    ],
  },
  "birthday-adventure": {
    emojis: ["🎂", "🎈", "🎁", "🎉", "🧁", "🕯️"],
    quiz: [
      q("How many candles go on a cake for a 5-year-old?", "5", ["3", "10"]),
      q("Which song do we sing on birthdays?", "Happy Birthday", ["Twinkle Twinkle", "Jingle Bells"]),
      q("What do you do before blowing out the candles?", "Make a wish", ["Sneeze", "Go to sleep"]),
      q("Which is a yummy birthday treat?", "Cake", ["Broccoli", "Soap"]),
      q("How many days are there in a year?", "365", ["100", "52"]),
    ],
  },
};

export const DEFAULT_PACK: ThemePack = {
  emojis: ["🌈", "🦄", "🐉", "⭐", "🧚", "🏰"],
  quiz: [
    q("What colour do you get when you mix blue and yellow?", "Green", ["Red", "Purple"]),
    q("How many days are there in a week?", "7", ["5", "10"]),
    q("Which animal says “moo”?", "Cow", ["Cat", "Duck"]),
    q("How many colours does a rainbow have?", "7", ["3", "12"]),
    q("What comes after Monday?", "Tuesday", ["Sunday", "Friday"]),
  ],
};

export function themePack(theme: string | null | undefined): ThemePack {
  return (theme && THEME_PACKS[theme]) || DEFAULT_PACK;
}
