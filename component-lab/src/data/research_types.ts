export type ResearchTopic = "Tech" | "Islamic Studies & Finance" | "Career & Productivity";

export type ResearchPaper = {
  id: string;
  doi: string;
  title: string;
  publicationDate: string;
  venue: string;
  leadAuthor?: string;
  institution?: string;
  topics: ResearchTopic[];
  summary: string;
  practicalUseCase: string;
  limitation: string;
  fullTextUrl: string;
  codeUrl?: string;
};

export type ResearchData = {
  lastUpdated: string;
  papers: ResearchPaper[];
};
