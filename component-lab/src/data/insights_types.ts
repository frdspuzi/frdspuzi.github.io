export type MediumItem = {
  title: string;
  pubDate: string;
  link: string;
  guid: string;
  author: string;
  content: string;
  categories: string[];
};

// Category the learning routine gives trivia questions made from Bookshelf insights. Their
// articleUrl is the reader route (/books/:slug/) and articleTitle is the book's title.
export const BOOKS_CATEGORY = "Books";

export type LearningItem = {
  question: string;
  options: string[];
  correctIndex: number;
  learning: string;
  articleTitle: string;
  articleUrl: string;
  category?: string;
};
