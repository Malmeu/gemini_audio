import React, { useState, useRef } from 'react';
import { analyzeTranscription } from '../services/geminiService';
import { UploadIcon, LoaderIcon, SparklesIcon } from './Icons';

// Simple markdown to HTML renderer
const MarkdownRenderer = ({ content }: { content: string }) => {
    const htmlContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br />');

    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};


const AnalysisPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
      setAnalysis(null);
      setError(null);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      setFile(event.dataTransfer.files[0]);
      setAnalysis(null);
      setError(null);
      // To allow re-dropping the same file
      event.dataTransfer.clearData();
    }
  };

  const handleAnalyzeClick = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setIsLoading(true);
    setAnalysis(null);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        if (!content) {
          throw new Error('Could not read file content.');
        }
        const result = await analyzeTranscription(content);
        setAnalysis(result);
      };
      reader.onerror = () => {
        throw new Error('Error reading file.');
      };
      reader.readAsText(file);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-4">Transcription Analysis</h2>
      <div 
        className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-cyan-500 transition-colors"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={triggerFileInput}
      >
        <input
          type="file"
          accept=".txt, .md"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <UploadIcon className="w-12 h-12 mx-auto text-gray-500 mb-4" />
        {file ? (
          <p className="text-gray-300">Selected file: <span className="font-semibold">{file.name}</span></p>
        ) : (
          <p className="text-gray-400">Drag & drop a .txt transcription file here, or click to select.</p>
        )}
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={handleAnalyzeClick}
          disabled={!file || isLoading}
          className="bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-cyan-600 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto mx-auto"
        >
          {isLoading ? (
            <>
              <LoaderIcon className="w-5 h-5 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <SparklesIcon className="w-5 h-5" />
              Analyze Transcription
            </>
          )}
        </button>
      </div>

      {error && <div className="mt-6 bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">{error}</div>}

      {analysis && (
        <div className="mt-8 pt-6 border-t border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-white">Analysis Results</h3>
          <div className="bg-gray-900/50 p-6 rounded-lg prose prose-invert max-w-none prose-p:text-gray-300 prose-headings:text-white prose-strong:text-cyan-400 prose-ul:text-gray-300">
            <MarkdownRenderer content={analysis} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisPanel;
