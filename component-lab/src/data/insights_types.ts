export type MediumItem = {
  title: string;
  pubDate: string;
  link: string;
  guid: string;
  author: string;
  content: string;
  categories: string[];
};

export type LearningItem = {
  question: string;
  options: string[];
  correctIndex: number;
  learning: string;
  articleTitle: string;
  articleUrl: string;
  category?: string;
};
