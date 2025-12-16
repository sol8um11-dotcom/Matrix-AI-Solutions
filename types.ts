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
  error?: string;
}

export enum ContextFileType {
  TheoryConcepts = "TheoryConcepts",
  DiscussionConcepts = "DiscussionConcepts",
  TheoryChapters = "TheoryChapters",
  DiscussionChapters = "DiscussionChapters",
}