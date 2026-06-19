export type StoryTheme =
  | 'space-adventure'
  | 'superhero-mission'
  | 'jungle-quest'
  | 'underwater-adventure'
  | 'detective-mystery'
  | 'birthday-adventure';

export type StoryStatus =
  | 'pending'
  | 'generating-story'
  | 'generating-images'
  | 'generating-audio'
  | 'generating-pdf'
  | 'completed'
  | 'failed';

export interface StoryPage {
  pageNumber: number;
  text: string;
  imageUrl?: string;
  audioUrl?: string;
}

export interface Story {
  id: string;
  userId: string;
  heroId: string;
  theme: StoryTheme;
  title: string;
  status: StoryStatus;
  pages: StoryPage[];
  coverImageUrl?: string;
  pdfUrl?: string;
  creditsUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStoryDto {
  heroId: string;
  theme: StoryTheme;
}

export interface StoryGenerationJob {
  storyId: string;
  heroId: string;
  userId: string;
  theme: StoryTheme;
}
