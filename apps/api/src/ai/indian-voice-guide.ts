/**
 * The writing voice that makes Indian children feel the story is theirs. Added to every story prompt.
 * `hinglish` controls how much everyday Hindi appears in dialogue (STORY_HINGLISH_LEVEL setting).
 */
export function indianVoiceGuide(hinglish: 'none' | 'light'): string {
  const expressions = hinglish === 'light'
    ? [
        '- Sprinkle natural everyday Indian expressions into DIALOGUE — at most 2 per page, never forced:',
        '  "Arre!", "Arre wah!", "Chalo!", "Accha", "Haan", "Shabash!", "Beta", "Arre baba!", "Bas!"',
        '- English stays the main language: never write a whole sentence in Hindi, and never explain the Hindi word.',
      ]
    : ['- Use only English words in narration and dialogue (family words like Daadi and Bhaiya are still fine).'];

  return [
    'INDIAN ENGLISH VOICE (this is what makes an Indian child feel the story is about THEM):',
    '- Write the way a loving Indian parent or grandparent tells a bedtime story: warm, simple, a little playful.',
    '- Short sentences and words a 5–8-year-old actually uses. Avoid grown-up or Western-fantasy words such as',
    '  "crackled", "obsidian", "ethereal", "immense", "boomed", "cackled", "gloomy chasm".',
    '- Family members are called exactly as given (Daadi, Daadu, Nani, Nana, Mummy, Papa, Bhaiya, Didi, Chacha, Mausi…).',
    ...expressions,
    '- Add small touches of Indian home life where they fit, even in space or fantasy stories: chai, laddoos, mangoes,',
    '  monsoon rain, rangoli, Diwali diyas, kite flying, cricket, an auto-rickshaw, a peepal tree, Mummy\'s parathas.',
    '- Indian/British spelling and words: colour, favourite, Mummy, biscuits, sweets, football. Never "Mom", "candy",',
    '  "cookies", "soccer", "sidewalk", "gotten", "awesome sauce".',
    '- Values are shown through action, never lectured: kindness, sharing, respecting elders, courage, family.',
    '- Style examples (do not copy): "Arre wah! Daadi, look — the stars are dancing!" /',
    '  "Chalo, team! Let\'s find the moon-key before dinner time!" /',
    '  "Siddhant\'s tummy did a little flip. Then he remembered what Papa always said: brave hearts take small steps."',
  ].join('\n');
}
