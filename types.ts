export interface FileData {
  name: string;
  content: string;
}

export interface TaggingResult {
  QuestionID: string;
  Original_Text: string;
  Subject: string;
  Chapter: string;
  Concept_Name: string;
  Confidence_Score: string;
  Reasoning: string;
  [key: string]: string; // Allow flexible parsing
}

export interface ProcessingState {
  isLoading: boolean;
  statusMessage: string;
  progress: number; // 0 to 100
  total: number;
  processed: number;
  error?: string;
}

export enum ContextFileType {
  TheoryConcepts = "TheoryConcepts",
  DiscussionConcepts = "DiscussionConcepts",
  TheoryChapters = "TheoryChapters",
  DiscussionChapters = "DiscussionChapters",
}