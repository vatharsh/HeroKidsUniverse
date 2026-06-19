export type HeroGender = 'boy' | 'girl' | 'non-binary';
export type HeroAge = 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface Hero {
  id: string;
  userId: string;
  name: string;
  age: HeroAge;
  gender: HeroGender;
  photoUrl: string;
  characterSheetPrompt: string; // Persistent AI prompt for character consistency
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateHeroDto {
  name: string;
  age: HeroAge;
  gender: HeroGender;
  photoBase64?: string;
}
