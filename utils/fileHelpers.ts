import { TaggingResult } from '../types';

export const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(event.target?.result as string);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};

export const parseCSVToJSON = (rawText: string): TaggingResult[] => {
  // Normalize newlines and clean up
  const cleanText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l);

  if (lines.length === 0) return [];

  const defaultHeaders = ["QuestionID", "Original_Text", "Subject", "Chapter", "Concept_Name", "Confidence_Score", "Reasoning"];
  let headers = defaultHeaders;
  let dataStartIndex = 0;

  // 1. Attempt to find a header row
  // Regex looks for 'Question' followed eventually by 'ID', case insensitive. 
  // Matches "QuestionID", "Question ID", "Question_ID"
  const headerRowIndex = lines.findIndex(line => 
    /question[\s_]*id/i.test(line) && line.includes('|')
  );

  if (headerRowIndex !== -1) {
      // Header found
      const headerLine = lines[headerRowIndex].replace(/^\||\|$/g, '');
      headers = headerLine.split('|').map(h => h.trim().replace(/^"|"$/g, ''));
      dataStartIndex = headerRowIndex + 1;
  } else {
      // No header found. 
      // Check if we have data that looks like it fits (contains pipes).
      const hasPipes = lines.some(l => l.includes('|'));
      if (!hasPipes) {
          console.error("Parser Error: No pipe delimiters found in response.");
          return [];
      }
      console.warn("No header row found. Assuming default headers.");
      // Start from index 0
      dataStartIndex = 0;
  }

  const data: TaggingResult[] = [];

  // 2. Parse Data Rows
  for (let i = dataStartIndex; i < lines.length; i++) {
    let line = lines[i];
    
    // Skip divider lines (e.g. "---|---|---" or "|---|")
    // If line only contains |, -, and whitespace
    if (/^[|\-\s]+$/.test(line)) continue;
    
    // Also skip if it looks like a repeated header row
    if (/question[\s_]*id/i.test(line)) continue;

    // Remove starting/ending pipes
    line = line.replace(/^\||\|$/g, '');
    
    const values = line.split('|').map(v => v.trim());

    // Basic validation: ensure we have at least 2 columns to consider it a data row
    // (e.g. QuestionID and Text)
    if (values.length < 2) continue;

    const entry: any = {};
    headers.forEach((header, index) => {
      let val = values[index] || '';
      // Clean up common issues:
      // 1. Leading/trailing quotes if the model wrapped the cell content
      val = val.replace(/^"|"$/g, '');
      entry[header] = val;
    });

    data.push(entry as TaggingResult);
  }

  return data;
};

export const downloadCSV = (data: TaggingResult[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  
  // Convert back to standard Comma Separated Values for the user download
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(fieldName => {
        const val = row[fieldName] || '';
        // Escape quotes by doubling them
        const stringVal = String(val).replace(/"/g, '""');
        // Wrap in quotes
        return `"${stringVal}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};