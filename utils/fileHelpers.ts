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

// Robust CSV Parser for Input Files
// Handles quoted fields with delimiters and newlines
export const parseRawQuestions = (rawText: string, fileName: string): any[] => {
  if (fileName.endsWith('.json')) {
    try {
      const data = JSON.parse(rawText);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error("JSON Parse Error", e);
      return [];
    }
  }

  // Detect delimiter
  const detectDelimiter = (text: string) => {
    const firstLine = text.substring(0, text.indexOf('\n') > -1 ? text.indexOf('\n') : text.length);
    const commas = (firstLine.match(/,/g) || []).length;
    const pipes = (firstLine.match(/\|/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    if (pipes > commas && pipes > tabs) return '|';
    if (tabs > commas && tabs > pipes) return '\t';
    return ',';
  };

  const delimiter = detectDelimiter(rawText);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  // State machine parser
  for (let i = 0; i < rawText.length; i++) {
    const char = rawText[i];
    const nextChar = rawText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote: "" -> "
        currentField += '"';
        i++; // skip next quote
      } else {
        // Toggle quotes
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      // End of field
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      // End of row
      if (char === '\r' && nextChar === '\n') i++; // Handle CRLF
      
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  // Handle last row if no newline at EOF
  if (currentRow.length > 0 || currentField.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // Filter out empty rows (often caused by trailing newlines)
  const validRows = rows.filter(r => r.length > 0 && r.some(c => c.trim().length > 0));

  if (validRows.length < 2) return [];

  // Extract headers
  const headers = validRows[0].map(h => h.trim());
  
  // Map rows to objects
  return validRows.slice(1).map(row => {
    const obj: any = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] || '';
    });
    return obj;
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
  const headerRowIndex = lines.findIndex(line => 
    /question[\s_]*id/i.test(line) && line.includes('|')
  );

  if (headerRowIndex !== -1) {
      const headerLine = lines[headerRowIndex].replace(/^\||\|$/g, '');
      headers = headerLine.split('|').map(h => h.trim().replace(/^"|"$/g, ''));
      dataStartIndex = headerRowIndex + 1;
  } else {
      const hasPipes = lines.some(l => l.includes('|'));
      if (!hasPipes) {
          console.warn("Parser Warning: No pipe delimiters found in response chunk.");
          return [];
      }
      dataStartIndex = 0;
  }

  const data: TaggingResult[] = [];

  // 2. Parse Data Rows
  for (let i = dataStartIndex; i < lines.length; i++) {
    let line = lines[i];
    
    // Skip divider lines
    if (/^[|\-\s]+$/.test(line)) continue;
    if (/question[\s_]*id/i.test(line)) continue;

    // Remove starting/ending pipes
    line = line.replace(/^\||\|$/g, '');
    
    // We assume the AI respects the "no pipes in content" rule, so simple split is safe enough for the output format
    // However, we handle potential extra spaces
    const values = line.split('|').map(v => v.trim());

    if (values.length < 2) continue;

    const entry: any = {};
    headers.forEach((header, index) => {
      let val = values[index] || '';
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
  
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(fieldName => {
        const val = row[fieldName] || '';
        const stringVal = String(val).replace(/"/g, '""');
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