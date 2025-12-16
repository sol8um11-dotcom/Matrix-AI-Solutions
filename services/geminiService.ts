import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { FileData } from "../types";

export const tagQuestionsWithGemini = async (
  contextFiles: Record<string, FileData | null>,
  questionsData: string
): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please ensure process.env.API_KEY is available.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // 1. Prepare Context String
  let contextStr = "Here is the master list of Chapters and Concepts (The Knowledge Graph):\n\n";
  Object.entries(contextFiles).forEach(([key, file]) => {
    if (file) {
      contextStr += `--- START OF FILE ${file.name} ---\n`;
      contextStr += file.content;
      contextStr += "\n";
    }
  });

  // 2. Construct Prompt
  const prompt = `
    ${contextStr}
    
    --- START OF QUESTIONS TO TAG ---
    Here are the questions that need tagging. 
    Analyze each one based on the Chapter provided. 
    Find the best matching concept from the files above.
    
    Input Data:
    ${questionsData}
    
    OUTPUT REQUIREMENT:
    Return ONLY a valid **PIPE-SEPARATED** formatted string (use | as delimiter).
    Headers: QuestionID|Original_Text|Subject|Chapter|Concept_Name|Confidence_Score|Reasoning
    Do not include markdown code blocks.
    `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Using Gemini 3 Pro for advanced reasoning
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1, // Low temperature for deterministic tagging
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text received from Gemini.");
    }

    // Clean up markdown formatting (```csv, ```psv, ```, etc.)
    // This regex matches a start block (``` + optional word + newline) and an end block (```)
    // It also handles cases where text is just plain text with no blocks, essentially passing it through.
    let cleanText = text.replace(/^```[a-zA-Z]*\n?/gm, '').replace(/```$/gm, '').trim();
    
    return cleanText;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};