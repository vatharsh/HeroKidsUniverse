import type { QuizQuestion } from "./UniverseQuiz";

/**
 * Games content for while a story is being made: picture cards per story theme and a large bank of
 * easy quiz questions (ages 4–12) — about 20 per theme plus a general pool — so children rarely see
 * a repeat. Recently asked questions are remembered on the device and skipped (see pickQuizQuestions).
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
      q("What goes around the Earth and shines at night?", "The Moon", ["The Sun", "A cloud"]),
      q("Which is the biggest planet?", "Jupiter", ["Earth", "Mars"]),
      q("What do we call a person who travels to space?", "An astronaut", ["A pilot", "A sailor"]),
      q("Which planet is closest to the Sun?", "Mercury", ["Neptune", "Earth"]),
      q("What is a shooting star really?", "A space rock burning up", ["A falling star", "A firework"]),
      q("What pulls things down to the ground?", "Gravity", ["Wind", "Magic"]),
      q("Which country's space agency is ISRO?", "India", ["Japan", "Brazil"]),
      q("What did Chandrayaan-3 land on?", "The Moon", ["Mars", "The Sun"]),
      q("How many planets go around our Sun?", "8", ["5", "12"]),
      q("What do you call a group of stars that makes a picture?", "A constellation", ["A comet", "A rocket"]),
      q("What makes day and night?", "The Earth spinning", ["The Moon hiding", "Clouds moving"]),
      q("What is the Milky Way?", "Our galaxy", ["A chocolate river", "A planet"]),
      q("Which has a long glowing tail in space?", "A comet", ["A planet", "A moon"]),
      q("What do rockets need to fly up?", "Fuel", ["Feathers", "Water"]),
      q("Is the Sun hot or cold?", "Very hot", ["Very cold", "Just warm"]),
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
      q("A hero keeps their promises. True or false?", "True", ["False", "Only on Sundays"]),
      q("What should you say when you make a mistake?", "Sorry", ["Nothing", "It's your fault"]),
      q("Who helps keep everyone safe in a city?", "Police and firefighters", ["Pirates", "Dragons"]),
      q("Which number do you call in India for emergencies?", "112", ["999", "101010"]),
      q("What do heroes use to protect themselves?", "A shield", ["A sandwich", "A balloon"]),
      q("If a friend is sad, a hero…", "Cheers them up", ["Ignores them", "Teases them"]),
      q("What is a hero's secret weapon?", "Kindness", ["Grumpiness", "Laziness"]),
      q("Which helps heroes stay strong?", "Healthy food and sleep", ["Only sweets", "Staying up all night"]),
      q("What do you call a hero's helper?", "A sidekick", ["A sidewalk", "A side dish"]),
      q("What does a mask help a hero do?", "Keep a secret identity", ["See in the dark", "Fly faster"]),
      q("If you see litter, a hero…", "Puts it in the bin", ["Kicks it", "Adds more"]),
      q("Which is a good hero rule?", "Never give up", ["Always win", "Never share"]),
      q("Super speed means being very…", "Fast", ["Slow", "Sleepy"]),
      q("What should heroes do before crossing a road?", "Look both ways", ["Close their eyes", "Run quickly"]),
      q("Who is the hero of your story?", "You!", ["Your toy", "Nobody"]),
    ],
  },
  "jungle-quest": {
    emojis: ["🦁", "🐘", "🐒", "🦜", "🐯", "🌴"],
    quiz: [
      q("Which animal is called the King of the Jungle?", "Lion", ["Rabbit", "Cow"]),
      q("Which animal has a long trunk?", "Elephant", ["Giraffe", "Tiger"]),
      q("Which bird can copy words people say?", "Parrot", ["Pigeon", "Owl"]),
      q("What is India's national animal?", "Tiger", ["Peacock", "Lion"]),
      q("What is India's national bird?", "Peacock", ["Crow", "Eagle"]),
      q("What do monkeys love to eat?", "Bananas", ["Pizza", "Ice cream"]),
      q("Which animal has the longest neck?", "Giraffe", ["Zebra", "Bear"]),
      q("Which animal has black and white stripes?", "Zebra", ["Lion", "Monkey"]),
      q("What do caterpillars turn into?", "Butterflies", ["Snakes", "Frogs"]),
      q("Which animal sleeps upside down?", "Bat", ["Cow", "Fish"]),
      q("What does a frog say?", "Ribbit", ["Moo", "Quack"]),
      q("Which animal changes colour to hide?", "Chameleon", ["Elephant", "Horse"]),
      q("Which is the fastest land animal?", "Cheetah", ["Turtle", "Cow"]),
      q("What do bees make?", "Honey", ["Milk", "Bread"]),
      q("Where does a bird live?", "In a nest", ["In a cave of ice", "In a shoe"]),
      q("Which animal carries its baby in a pouch?", "Kangaroo", ["Dog", "Duck"]),
      q("What do plants need to grow?", "Water and sunlight", ["Chocolate", "Toys"]),
      q("Which animal has a mane?", "Lion", ["Snake", "Fish"]),
      q("Which snake is famous in India for its hood?", "Cobra", ["Python", "Worm"]),
      q("What do you call a baby elephant?", "A calf", ["A kitten", "A chick"]),
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
      q("Is sea water salty or sweet?", "Salty", ["Sweet", "Spicy"]),
      q("Which sea animal is very clever and loves to jump?", "Dolphin", ["Snail", "Clam"]),
      q("What do turtles carry on their back?", "A shell", ["A bag", "A crown"]),
      q("Which fish is orange and white with stripes?", "Clownfish", ["Goldfish", "Catfish"]),
      q("What makes ocean waves?", "Wind", ["Fish swimming", "Boats only"]),
      q("Which sea animal can squirt ink?", "Octopus", ["Crab", "Seahorse"]),
      q("What do you call a group of fish swimming together?", "A school", ["A class", "A party"]),
      q("Which ocean is to the south of India?", "Indian Ocean", ["Arctic Ocean", "Pacific Ocean"]),
      q("Coral reefs are made by…", "Tiny sea animals", ["Rocks falling", "Mermaids"]),
      q("Which sea creature has no bones and wobbles?", "Jellyfish", ["Shark", "Whale"]),
      q("Whales breathe air through a…", "Blowhole", ["Straw", "Mouth only"]),
      q("Which is a sea animal with a horse-like head?", "Seahorse", ["Sea cow", "Sea lion"]),
      q("Pearls are found inside…", "Oysters", ["Fish", "Crabs"]),
      q("What do sharks have lots of?", "Teeth", ["Feathers", "Legs"]),
      q("Divers carry what to breathe underwater?", "Oxygen tanks", ["Balloons", "Umbrellas"]),
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
      q("If the floor is wet and there's a wet umbrella, it was probably…", "Raining", ["Sunny", "Snowing indoors"]),
      q("What comes next: 2, 4, 6, …?", "8", ["7", "10"]),
      q("What opens a locked door?", "A key", ["A spoon", "A leaf"]),
      q("Which is the odd one out: apple, banana, carrot?", "Carrot", ["Apple", "Banana"]),
      q("What comes next: red, blue, red, blue, …?", "Red", ["Green", "Yellow"]),
      q("What do you write clues in?", "A notebook", ["A sandwich", "A shoe"]),
      q("If the cookie jar is empty and Tommy has crumbs, who ate the cookies?", "Tommy", ["The jar", "Nobody"]),
      q("Which has keys but can't open locks?", "A piano", ["A door", "A car"]),
      q("Which shape has 3 sides?", "Triangle", ["Square", "Circle"]),
      q("What has hands but can't clap?", "A clock", ["A monkey", "A glove"]),
      q("Which is heavier: a kilo of feathers or a kilo of stones?", "Same weight", ["Feathers", "Stones"]),
      q("A secret message written in symbols is called a…", "Code", ["Cake", "Cloud"]),
      q("Where would you find fingerprints?", "On fingertips", ["On hair", "On shoes"]),
      q("Which is the odd one out: cat, dog, car?", "Car", ["Cat", "Dog"]),
      q("What comes next: Monday, Tuesday, …?", "Wednesday", ["Friday", "Sunday"]),
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
      q("How many months are there in a year?", "12", ["10", "7"]),
      q("What do we fill balloons with?", "Air", ["Water only", "Sand"]),
      q("What do you say when you get a present?", "Thank you", ["Go away", "Nothing"]),
      q("What is wrapped around a gift?", "Wrapping paper", ["A blanket", "A towel"]),
      q("Which month comes after March?", "April", ["June", "January"]),
      q("If you are 7 today, how old will you be next year?", "8", ["6", "10"]),
      q("What do party poppers throw out?", "Confetti", ["Water", "Rocks"]),
      q("What sweet do we often share in India to celebrate?", "Laddoos", ["Chillies", "Salt"]),
      q("Which shape is a birthday balloon usually?", "Round", ["Square", "Flat"]),
      q("How many legs does a party table usually have?", "4", ["1", "9"]),
      q("Which month is the last month of the year?", "December", ["October", "January"]),
      q("A birthday comes how many times a year?", "Once", ["Twice", "Every day"]),
      q("What do we light on a birthday cake?", "Candles", ["Torches", "Lamps"]),
      q("Which game has a blindfold and a tail?", "Pin the tail", ["Chess", "Cricket"]),
      q("What do you do with a gift box?", "Open it", ["Eat it", "Wear it"]),
    ],
  },
};

/** General questions mixed into every quiz, whatever the theme. */
export const GENERAL_QUIZ: QuizQuestion[] = [
  q("What colour do you get when you mix blue and yellow?", "Green", ["Red", "Purple"]),
  q("What colour do you get when you mix red and white?", "Pink", ["Black", "Blue"]),
  q("How many days are there in a week?", "7", ["5", "10"]),
  q("Which animal says “moo”?", "Cow", ["Cat", "Duck"]),
  q("How many colours does a rainbow have?", "7", ["3", "12"]),
  q("What comes after Monday?", "Tuesday", ["Sunday", "Friday"]),
  q("How many legs does a spider have?", "8", ["6", "4"]),
  q("Which fruit is yellow and curved?", "Banana", ["Apple", "Grapes"]),
  q("What is frozen water called?", "Ice", ["Steam", "Sand"]),
  q("Which is the national fruit of India?", "Mango", ["Apple", "Orange"]),
  q("Which festival is called the festival of lights?", "Diwali", ["Holi", "Christmas"]),
  q("Which festival is played with colours?", "Holi", ["Diwali", "Eid"]),
  q("What is 2 + 3?", "5", ["4", "6"]),
  q("What is 10 − 4?", "6", ["5", "7"]),
  q("How many fingers are on one hand?", "5", ["4", "10"]),
  q("Which season is the hottest?", "Summer", ["Winter", "Spring"]),
  q("What falls from clouds when it rains?", "Water", ["Milk", "Stones"]),
  q("Which animal gives us wool?", "Sheep", ["Hen", "Fish"]),
  q("Which bird is a symbol of peace?", "Dove", ["Crow", "Vulture"]),
  q("What do cows eat?", "Grass", ["Meat", "Chocolate"]),
  q("Which is the capital of India?", "New Delhi", ["Mumbai", "Goa"]),
  q("Which river is the longest in India?", "Ganga", ["Yamuna", "Narmada"]),
  q("What shape is a ball?", "Round", ["Square", "Triangle"]),
  q("Which animal is known for being slow?", "Tortoise", ["Rabbit", "Horse"]),
  q("What do you use to brush your teeth?", "A toothbrush", ["A comb", "A fork"]),
  q("How many wheels does a bicycle have?", "2", ["3", "4"]),
  q("What gives us light in the day?", "The Sun", ["The Moon", "A torch"]),
  q("Which vegetable is orange and good for your eyes?", "Carrot", ["Potato", "Onion"]),
  q("Which instrument has black and white keys?", "Piano", ["Drum", "Flute"]),
  q("What do you call a baby dog?", "A puppy", ["A kitten", "A cub"]),
];

export function themePack(theme: string | null | undefined): ThemePack {
  return (theme && THEME_PACKS[theme]) || { emojis: ["🌈", "🦄", "🐉", "⭐", "🧚", "🏰"], quiz: [] };
}

const SEEN_KEY = "hk_quiz_seen";
const SEEN_MAX = 80;

/**
 * Picks `count` questions, about two thirds from the story's theme and the rest general, skipping
 * ones asked recently on this device. When everything has been seen, the history starts over.
 */
export function pickQuizQuestions(theme: string | null | undefined, count: number): QuizQuestion[] {
  if (count <= 0) return [];
  let seen: string[] = [];
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"); } catch { /* fresh */ }
  const shuffle = <T,>(xs: T[]) => [...xs].sort(() => Math.random() - 0.5);
  const themed = themePack(theme).quiz;
  const fresh = (xs: QuizQuestion[]) => shuffle(xs.filter((x) => !seen.includes(x.q)));
  let fromTheme = fresh(themed);
  let fromGeneral = fresh(GENERAL_QUIZ);
  if (fromTheme.length + fromGeneral.length < count) { seen = []; fromTheme = shuffle(themed); fromGeneral = shuffle(GENERAL_QUIZ); }
  const themeCount = Math.min(fromTheme.length, themed.length ? Math.ceil((count * 2) / 3) : 0);
  const picked = [...fromTheme.slice(0, themeCount), ...fromGeneral.slice(0, count - themeCount)];
  if (picked.length < count) picked.push(...fromTheme.slice(themeCount, themeCount + count - picked.length));
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, ...picked.map((x) => x.q)].slice(-SEEN_MAX))); } catch { /* fine */ }
  return shuffle(picked).map((x) => ({ ...x, options: shuffle(x.options) }));
}
