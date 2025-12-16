import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { FileData } from "../types";

const BATCH_SIZE = 10; // Number of questions to process per API call

// Initialize AI Instance
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please ensure process.env.API_KEY is available.");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to construct context string only once
const buildContextString = (contextFiles: Record<string, FileData | null>) => {
  let contextStr = "Here is the master list of Chapters and Concepts (The Knowledge Graph):\n\n";
  Object.entries(contextFiles).forEach(([key, file]) => {
    if (file) {
      contextStr += `--- START OF FILE ${file.name} ---\n`;
      contextStr += file.content;
      contextStr += "\n";
    }
  });
  return contextStr;
};

// Process a single batch
const processBatch = async (
  ai: GoogleGenAI, 
  contextStr: string, 
  questionsBatch: any[]
): Promise<string> => {
  
  // Format the batch into a clear string representation
  const batchDataStr = JSON.stringify(questionsBatch, null, 2);

  const prompt = `
    ${contextStr}
    
    --- START OF QUESTIONS TO TAG (BATCH) ---
    Analyze the following ${questionsBatch.length} questions.
    
    Input Data:
    ${batchDataStr}
    
    OUTPUT REQUIREMENT:
    Return ONLY a valid **PIPE-SEPARATED** formatted string (use | as delimiter).
    Headers: QuestionID|Original_Text|Subject|Chapter|Concept_Name|Confidence_Score|Reasoning
    Do not include markdown code blocks.
    Do not include any introductory text.
    `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview", 
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.0, // Zero temperature for maximum determinism
    },
  });

  const text = response.text;
  if (!text) return "";

  // Clean markdown
  return text.replace(/^```[a-zA-Z]*\n?/gm, '').replace(/```$/gm, '').trim();
};

// Main Orchestrator
export const tagQuestionsWithGemini = async (
  contextFiles: Record<string, FileData | null>,
  parsedQuestions: any[],
  onProgress: (processed: number, total: number) => void
): Promise<string[]> => {
  
  const ai = getAIClient();
  const contextStr = buildContextString(contextFiles);
  const totalQuestions = parsedQuestions.length;
  const allRawResults: string[] = [];

  // Chunking loop
  for (let i = 0; i < totalQuestions; i += BATCH_SIZE) {
    const batch = parsedQuestions.slice(i, i + BATCH_SIZE);
    
    try {
      const batchResult = await processBatch(ai, contextStr, batch);
      allRawResults.push(batchResult);
      
      // Update progress
      onProgress(Math.min(i + BATCH_SIZE, totalQuestions), totalQuestions);

    } catch (error) {
      console.error(`Error processing batch starting at index ${i}:`, error);
      // We continue to next batch instead of failing everything
      // Optional: Add a placeholder error line for these IDs
    }

    // Optional: Small delay to be nice to rate limits if needed
    // await new Promise(r => setTimeout(r, 500)); 
  }

  return allRawResults;
};