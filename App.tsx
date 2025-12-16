import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { ContextFileType, FileData, TaggingResult, ProcessingState } from './types';
import { readFileContent, parseCSVToJSON, downloadCSV, parseRawQuestions } from './utils/fileHelpers';
import { tagQuestionsWithGemini } from './services/geminiService';
import { BrainCircuit, Download, RefreshCw, AlertTriangle, Play, FileJson, Layers } from 'lucide-react';

const App: React.FC = () => {
  // Context Files State
  const [contextFiles, setContextFiles] = useState<Record<string, FileData | null>>({
    [ContextFileType.TheoryConcepts]: null,
    [ContextFileType.DiscussionConcepts]: null,
    [ContextFileType.TheoryChapters]: null,
    [ContextFileType.DiscussionChapters]: null,
  });

  // Questions File State
  const [questionsFile, setQuestionsFile] = useState<FileData | null>(null);

  // Results State
  const [results, setResults] = useState<TaggingResult[]>([]);
  const [processing, setProcessing] = useState<ProcessingState>({
    isLoading: false,
    statusMessage: '',
    progress: 0,
    total: 0,
    processed: 0
  });

  // Handlers for Context Files
  const handleContextUpload = (type: ContextFileType) => async (file: File) => {
    try {
      const content = await readFileContent(file);
      setContextFiles(prev => ({
        ...prev,
        [type]: { name: file.name, content }
      }));
    } catch (error) {
      console.error(`Error reading ${type}:`, error);
      alert("Failed to read file.");
    }
  };

  // Handler for Questions File
  const handleQuestionsUpload = async (file: File) => {
    try {
      const content = await readFileContent(file);
      setQuestionsFile({ name: file.name, content });
    } catch (error) {
      console.error("Error reading questions file:", error);
      alert("Failed to read file.");
    }
  };

  // Main Action: Run Tagging
  const startTagging = async () => {
    // Validation
    if (!questionsFile) {
      alert("Please upload a Questions file.");
      return;
    }
    if (!contextFiles[ContextFileType.TheoryConcepts]) {
      alert("Please upload at least TheoryConcepts.csv to provide context.");
      return;
    }

    // 1. Parse Input First
    setProcessing({ 
      isLoading: true, 
      statusMessage: 'Parsing input data...', 
      progress: 0,
      total: 0,
      processed: 0
    });

    const parsedQuestions = parseRawQuestions(questionsFile.content, questionsFile.name);
    
    if (parsedQuestions.length === 0) {
      setProcessing({ 
        isLoading: false, 
        statusMessage: '', 
        progress: 0, total: 0, processed: 0,
        error: "Could not parse any questions from the input file. Check format." 
      });
      return;
    }

    setResults([]);
    
    try {
      const total = parsedQuestions.length;
      setProcessing({ 
        isLoading: true, 
        statusMessage: 'Initializing batch processing with Gemini 3 Pro...',
        progress: 0,
        total,
        processed: 0
      });

      // 2. Run Batch Processing
      const rawBatchResults = await tagQuestionsWithGemini(
        contextFiles, 
        parsedQuestions,
        (processed, total) => {
          setProcessing(prev => ({
            ...prev,
            processed,
            total,
            progress: Math.round((processed / total) * 100),
            statusMessage: `Processing batch: ${processed}/${total} questions...`
          }));
        }
      );
      
      setProcessing(prev => ({ ...prev, statusMessage: 'Aggregating and parsing results...' }));
      
      // 3. Aggregate Results
      let allParsedRows: TaggingResult[] = [];
      rawBatchResults.forEach(raw => {
        const rows = parseCSVToJSON(raw);
        allParsedRows = [...allParsedRows, ...rows];
      });
      
      if (allParsedRows.length === 0) {
        throw new Error("AI processed the data but returned no valid rows. Try a smaller dataset.");
      }

      setResults(allParsedRows);
      setProcessing({ 
        isLoading: false, 
        statusMessage: 'Done!',
        progress: 100, total, processed: total 
      });

    } catch (error: any) {
      console.error("Tagging failed:", error);
      setProcessing({ 
        isLoading: false, 
        statusMessage: '', 
        progress: 0, total: 0, processed: 0,
        error: error.message || "An unexpected error occurred." 
      });
    }
  };

  const handleDownload = () => {
    downloadCSV(results, 'tagged_questions.csv');
  };

  const getConfidenceColor = (scoreStr: string | undefined) => {
    if (!scoreStr) return "bg-slate-100 text-slate-600 border-slate-200";
    const cleaned = String(scoreStr).replace('%', '').trim();
    const score = parseInt(cleaned, 10);
    if (isNaN(score)) return "bg-slate-100 text-slate-600 border-slate-200";
    if (score >= 90) return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (score >= 70) return "bg-yellow-100 text-yellow-700 border-yellow-200";
    return "bg-red-100 text-red-700 border-red-200";
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar: Knowledge Graph */}
      <aside className="w-full md:w-80 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col h-auto md:h-screen overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center space-x-2 text-indigo-600 mb-1">
            <BrainCircuit size={24} />
            <h1 className="text-xl font-bold tracking-tight">Concept Tagger</h1>
          </div>
          <p className="text-xs text-slate-500">AI-Powered Academic Semantic Engine</p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">1. Knowledge Graph</h2>
            <div className="space-y-3">
              <FileUpload 
                label="TheoryConcepts.csv" 
                required
                selectedFileName={contextFiles[ContextFileType.TheoryConcepts]?.name}
                onFileSelect={handleContextUpload(ContextFileType.TheoryConcepts)}
              />
              <FileUpload 
                label="DiscussionConcepts.csv" 
                selectedFileName={contextFiles[ContextFileType.DiscussionConcepts]?.name}
                onFileSelect={handleContextUpload(ContextFileType.DiscussionConcepts)}
              />
              <FileUpload 
                label="TheoryChapters.csv" 
                selectedFileName={contextFiles[ContextFileType.TheoryChapters]?.name}
                onFileSelect={handleContextUpload(ContextFileType.TheoryChapters)}
              />
              <FileUpload 
                label="DiscussionChapters.csv" 
                selectedFileName={contextFiles[ContextFileType.DiscussionChapters]?.name}
                onFileSelect={handleContextUpload(ContextFileType.DiscussionChapters)}
              />
            </div>
          </div>
        </div>
        
        <div className="mt-auto p-6 bg-slate-50 border-t border-slate-200">
          <p className="text-xs text-slate-400">
            Powered by Gemini 3 Pro
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Area */}
        <header className="bg-white border-b border-slate-200 p-6 shadow-sm z-10">
          <div className="max-w-5xl mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">2. Upload & Process Questions</h2>
                <p className="text-sm text-slate-500">Upload your JSON or CSV question bank (Supports 1000+ items).</p>
              </div>
              
              <div className="flex items-center gap-3">
                 <div className="w-full md:w-64">
                    <FileUpload 
                      label="Question Bank" 
                      accept=".json,.csv"
                      selectedFileName={questionsFile?.name}
                      onFileSelect={handleQuestionsUpload}
                    />
                 </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-6 flex flex-col md:flex-row items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 gap-4">
               
               {/* Status Area with Progress Bar */}
               <div className="flex-1 w-full">
                 <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                   {processing.isLoading ? (
                      <span className="flex items-center gap-2 text-indigo-600 font-medium">
                        <RefreshCw className="animate-spin" size={16} />
                        {processing.statusMessage}
                      </span>
                   ) : processing.error ? (
                      <span className="flex items-center gap-2 text-red-600 font-medium">
                        <AlertTriangle size={16} />
                        {processing.error}
                      </span>
                   ) : results.length > 0 ? (
                      <span className="flex items-center gap-2 text-emerald-600 font-medium">
                        <BrainCircuit size={16} />
                        Processed {results.length} questions successfully.
                      </span>
                   ) : (
                     <span className="flex items-center gap-2">
                       <Layers size={16} />
                       Ready to process.
                     </span>
                   )}
                 </div>
                 
                 {/* Progress Bar */}
                 {processing.isLoading && (
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                      <div 
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
                        style={{ width: `${processing.progress}%` }}
                      ></div>
                    </div>
                 )}
               </div>

               <div className="flex gap-3">
                 {results.length > 0 && (
                   <button
                     onClick={handleDownload}
                     className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors shadow-sm font-medium text-sm"
                   >
                     <Download size={16} />
                     Download CSV
                   </button>
                 )}
                 <button
                   onClick={startTagging}
                   disabled={processing.isLoading || !questionsFile}
                   className={`
                     flex items-center gap-2 px-6 py-2 rounded-md text-white font-medium shadow-md transition-all whitespace-nowrap
                     ${processing.isLoading || !questionsFile 
                       ? 'bg-slate-400 cursor-not-allowed' 
                       : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg'
                     }
                   `}
                 >
                   <Play size={16} fill="currentColor" />
                   {processing.isLoading ? 'Processing...' : 'Start Tagging'}
                 </button>
               </div>
            </div>
          </div>
        </header>

        {/* Results Table Area */}
        <div className="flex-1 overflow-auto bg-slate-50/50 p-6 custom-scrollbar">
          <div className="max-w-6xl mx-auto">
            {results.length > 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-4 w-16">ID</th>
                        <th className="p-4 w-64 min-w-[200px]">Question</th>
                        <th className="p-4 w-24">Subject</th>
                        <th className="p-4 w-32">Chapter</th>
                        <th className="p-4 w-40">Concept</th>
                        <th className="p-4 w-24">Accuracy</th>
                        <th className="p-4 min-w-[250px]">Reasoning</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 font-mono text-xs text-slate-500">{row.QuestionID}</td>
                          <td className="p-4 text-slate-700 text-xs line-clamp-3" title={row.Original_Text}>
                            {row.Original_Text && row.Original_Text.length > 150 
                              ? `${row.Original_Text.substring(0, 150)}...` 
                              : row.Original_Text}
                          </td>
                          <td className="p-4 text-slate-700">{row.Subject}</td>
                          <td className="p-4 text-slate-700">{row.Chapter}</td>
                          <td className="p-4">
                            <span className="font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 block w-fit">
                              {row.Concept_Name}
                            </span>
                          </td>
                           <td className="p-4">
                            <span className={`text-xs font-bold px-2 py-1 rounded border ${getConfidenceColor(row.Confidence_Score)}`}>
                              {row.Confidence_Score || 'N/A'}
                            </span>
                          </td>
                          <td className="p-4 text-slate-600 leading-relaxed text-xs">{row.Reasoning}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              // Empty State
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                <div className="bg-white p-8 rounded-full shadow-sm mb-4">
                  <FileJson size={48} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-medium text-slate-600">No Results Yet</h3>
                <p className="max-w-md text-center mt-2">
                  Upload your files and click "Start Tagging".<br/>
                  <span className="text-xs text-slate-400">Supports batch processing for large datasets.</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;