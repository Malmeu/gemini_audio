import React, { useState, useCallback, useRef, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import { startTranscriptionSession, transcribeAudioFile, analyzeTranscription, exportTranscriptionToTxt, copyTranscriptionToClipboard, exportAnalysisToTxt, copyAnalysisToClipboard } from './services/geminiService';
import { MicrophoneIcon, StopIcon, ExclamationTriangleIcon, UploadIcon, SpinnerIcon, DocumentDownloadIcon, ClipboardIcon, CloudArrowUpIcon } from './components/Icons';
import Header from './components/Header';
import CriteriaPanel from './components/CriteriaPanel';
import LiveAgentPanel from './components/LiveAgentPanel';
import AnalysisPanel from './components/AnalysisPanel';
import { SaveForm } from './components/SaveForm';

const TABLE_NAMES = ['staffy', 'mutuelle', 'timeone', 'sercure'] as const;
type TableName = typeof TABLE_NAMES[number];

const TABLE_DISPLAY_NAMES: Record<TableName, string> = {
    staffy: 'Staffy',
    mutuelle: 'Mutuelle',
    timeone: 'TimeOne',
    sercure: 'Sercure'
};

const getTableDisplayName = (tableName: TableName): string => {
    return TABLE_DISPLAY_NAMES[tableName];
};

type TranscriptionEntry = {
  id: number;
  text: string;
};

type TranscriptionMode = 'live' | 'file';

const App: React.FC = () => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionEntry[]>([]);
  const [currentTranscription, setCurrentTranscription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [transcriptionMode, setTranscriptionMode] = useState<TranscriptionMode>('live');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<string>('');
  const [showAnalysis, setShowAnalysis] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [selectedTable, setSelectedTable] = useState<TableName>('staffy');
  const [customName, setCustomName] = useState<string>('');
  const [showSaveForm, setShowSaveForm] = useState<boolean>(false);

  // Fonction pour afficher un message de succès temporaire
  const showCopySuccess = (message: string) => {
    setCopySuccess(message);
    setTimeout(() => setCopySuccess(''), 3000);
  };

  // FIX: The `LiveSession` type is not an exported member of '@google/genai'.
  // The session type is inferred from the return value of `startTranscriptionSession` for type safety.
  const sessionRef = useRef<Awaited<ReturnType<typeof startTranscriptionSession>>['session'] | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTranscriptionUpdate = useCallback((textChunk: string, isFinal: boolean) => {
    if (isFinal) {
      setTranscriptionHistory(prev => {
        const newEntry = { id: Date.now(), text: currentTranscription + textChunk };
        // Avoid adding empty transcriptions
        if (newEntry.text.trim().length === 0) {
            return prev;
        }
        return [...prev, newEntry];
      });
      setCurrentTranscription('');
    } else {
      setCurrentTranscription(prev => prev + textChunk);
    }
  }, [currentTranscription]);

  const stopRecording = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsRecording(false);
  }, []);
  
  const handleSessionError = useCallback((errorMessage: string) => {
      setError(errorMessage);
      stopRecording();
  }, [stopRecording]);

  const handleToggleRecording = useCallback(async () => {
    setError(null);
    if (isRecording) {
      stopRecording();
    } else {
      try {
        const { session, audioContext, streamSource, processor, stream } = await startTranscriptionSession({
          onTranscriptionUpdate: handleTranscriptionUpdate,
          onError: handleSessionError,
        });

        sessionRef.current = session;
        audioContextRef.current = audioContext;
        mediaStreamSourceRef.current = streamSource;
        scriptProcessorRef.current = processor;
        mediaStreamRef.current = stream;

        setIsRecording(true);
      } catch (err) {
        if (err instanceof Error) {
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                 setError("L'accès au microphone est requis. Veuillez autoriser l'accès dans les paramètres de votre navigateur.");
            } else {
                setError(`Erreur lors du démarrage de l'enregistrement : ${err.message}`);
            }
        } else {
            setError('Une erreur inconnue est survenue.');
        }
        setIsRecording(false);
      }
    }
  }, [isRecording, handleTranscriptionUpdate, handleSessionError, stopRecording]);

  const handleModeChange = (mode: TranscriptionMode) => {
    if (isRecording) {
      stopRecording();
    }
    setSelectedFile(null);
    setError(null);
    setTranscriptionMode(mode);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setError(null);
      setSelectedFile(file);
    }
  };

  const handleStartFileTranscription = async () => {
    if (!selectedFile) return;

    setError(null);
    setIsProcessingFile(true);

    try {
      const transcription = await transcribeAudioFile(selectedFile);
      setTranscriptionHistory(prev => [...prev, { id: Date.now(), text: transcription }]);
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        setError(`Erreur lors de la transcription du fichier : ${err.message}`);
      } else {
        setError("Une erreur inconnue est survenue lors de la transcription du fichier.");
      }
    } finally {
      setIsProcessingFile(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAnalyzeTranscription = async () => {
    const fullTranscription = transcriptionHistory.map(entry => entry.text).join('\n\n') + 
                              (currentTranscription ? '\n\n' + currentTranscription : '');
    
    if (!fullTranscription.trim()) {
      setError("Aucune transcription à analyser.");
      return;
    }

    setError(null);
    setIsAnalyzing(true);

    try {
      const analysis = await analyzeTranscription(fullTranscription);
      setCurrentAnalysis(analysis);
      setShowAnalysis(true);
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        setError(`Erreur lors de l'analyse : ${err.message}`);
      } else {
        setError("Une erreur inconnue est survenue lors de l'analyse.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportTranscription = () => {
    exportTranscriptionToTxt(transcriptionHistory, currentTranscription);
    showCopySuccess('Transcription exportée avec succès !');
  };

  const handleCopyTranscription = async () => {
    const success = await copyTranscriptionToClipboard(transcriptionHistory, currentTranscription);
    if (success) {
      showCopySuccess('Transcription copiée dans le presse-papiers !');
    } else {
      setError('Erreur lors de la copie de la transcription.');
    }
  };

  const handleExportAnalysis = () => {
    exportAnalysisToTxt(currentAnalysis, transcriptionHistory);
    showCopySuccess('Analyse exportée avec succès !');
  };

  const handleCopyAnalysis = async () => {
    const success = await copyAnalysisToClipboard(currentAnalysis, transcriptionHistory);
    if (success) {
      showCopySuccess('Analyse copiée dans le presse-papiers !');
    } else {
      setError('Erreur lors de la copie de l\'analyse.');
    }
  };

  const handleExportAnalysisPDF = async () => {
    if (!currentAnalysis) return;
    
    try {
      // Créer un élément temporaire pour contenir le HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = currentAnalysis;
      document.body.appendChild(tempDiv);
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '1100px';
      
      // Attendre que le DOM soit prêt
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const opt = {
        margin: 10,
        filename: `rapport_analyse_appel_${new Date().toISOString().slice(0,10)}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          backgroundColor: '#0b0f19',
          logging: false
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };
      
      const element = tempDiv.querySelector('.card') as HTMLElement || tempDiv;
      await html2pdf().set(opt).from(element).save();
      
      // Nettoyer
      document.body.removeChild(tempDiv);
      showCopySuccess('PDF exporté avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      setError('Erreur lors de l\'export du PDF.');
    }
  };

  const handleSaveTranscription = async () => {
    const fullTranscription = transcriptionHistory.map(entry => entry.text).join('\n\n---\n\n') + 
                              (currentTranscription ? '\n\n---\n\n' + currentTranscription : '');
    
    if (!fullTranscription.trim()) {
      setError("Aucune transcription à sauvegarder.");
      return;
    }

    if (!customName.trim()) {
      setError("Veuillez entrer un nom pour la transcription.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const title = `Transcription du ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`;
      const { saveTranscriptionToTable: saveFunc } = await import('./services/newSupabaseService');
      await saveFunc(
        selectedTable,
        title,
        customName,
        fullTranscription
      );
      showCopySuccess(`Transcription sauvegardée dans ${getTableDisplayName(selectedTable)} !`);
      setShowSaveForm(false);
      setCustomName('');
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.message.includes('Client Supabase non initialisé')) {
        setError('Configuration Supabase manquante. Veuillez configurer VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local');
      } else {
        setError('Erreur lors de la sauvegarde de la transcription.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAnalysis = async () => {
    if (!currentAnalysis.trim()) {
      setError("Aucune analyse à sauvegarder.");
      return;
    }

    const fullTranscription = transcriptionHistory.map(entry => entry.text).join('\n\n---\n\n') + 
                              (currentTranscription ? '\n\n---\n\n' + currentTranscription : '');
    
    if (!fullTranscription.trim()) {
      setError("Aucune transcription associée à sauvegarder.");
      return;
    }

    if (!customName.trim()) {
      setError("Veuillez entrer un nom pour la session.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const title = `Session du ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`;
      const combinedContent = `TRANSCRIPTION:\n${fullTranscription}\n\nANALYSE:\n${currentAnalysis}`;
      
      const { saveTranscriptionToTable: saveFunc } = await import('./services/newSupabaseService');
      await saveFunc(
        selectedTable,
        title,
        customName,
        combinedContent
      );
      
      showCopySuccess(`Session sauvegardée dans ${getTableDisplayName(selectedTable)} !`);
      setShowSaveForm(false);
      setCustomName('');
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la sauvegarde de la session.');
    } finally {
      setIsSaving(false);
    }
  };
  
  useEffect(() => {
    const transcriptionContainer = document.getElementById('transcription-container');
    if (transcriptionContainer) {
      transcriptionContainer.scrollTop = transcriptionContainer.scrollHeight;
    }
  }, [transcriptionHistory, currentTranscription]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Section Transcription */}
            <div className="bg-gray-800 rounded-lg p-6 flex flex-col" style={{ minHeight: '400px' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-sky-400">Transcription Audio</h2>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => handleModeChange('live')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      transcriptionMode === 'live' ? 'bg-sky-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    En direct
                  </button>
                  <button
                    onClick={() => handleModeChange('file')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      transcriptionMode === 'file' ? 'bg-sky-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    Fichier
                  </button>
                  {(transcriptionHistory.length > 0 || currentTranscription) && (
                    <>
                      <button
                        onClick={handleCopyTranscription}
                        className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                        title="Copier la transcription"
                      >
                        <ClipboardIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleExportTranscription}
                        className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                        title="Exporter en TXT"
                      >
                        <DocumentDownloadIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowSaveForm(true)}
                        disabled={isSaving}
                        className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Sauvegarder dans Supabase"
                      >
                        {isSaving ? (
                          <SpinnerIcon className="w-4 h-4" />
                        ) : (
                          <CloudArrowUpIcon className="w-4 h-4" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div id="transcription-container" className="flex-grow overflow-y-auto mb-4 space-y-3">
                {transcriptionHistory.map((entry) => (
                  <div key={entry.id} className="bg-gray-700 rounded-lg p-4">
                    <p className="text-gray-300 whitespace-pre-wrap">{entry.text}</p>
                  </div>
                ))}
                {isProcessingFile && (
                  <div className="bg-gray-700/50 rounded-lg p-4 flex items-center justify-center space-x-3 text-gray-300">
                    <SpinnerIcon className="w-6 h-6" />
                    <span>Transcription du fichier en cours...</span>
                  </div>
                )}
                {currentTranscription && (
                  <div className="bg-gray-700/50 rounded-lg p-4 border border-dashed border-sky-500">
                    <p className="text-gray-200 whitespace-pre-wrap">
                      {currentTranscription}
                      <span className="inline-block w-2 h-4 bg-sky-400 ml-1 animate-pulse"></span>
                    </p>
                  </div>
                )}
                {!isRecording && transcriptionHistory.length === 0 && !selectedFile && !isProcessingFile && (
                  <div className="text-center text-gray-500 py-20">
                    <p>
                      {transcriptionMode === 'live'
                        ? 'Cliquez sur le bouton ci-dessous pour commencer la transcription.'
                        : 'Sélectionnez un fichier audio ci-dessous pour le transcrire.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Contrôles de transcription */}
              <div className="border-t border-gray-700 pt-4">
                {error && (
                  <div className="mb-4 flex items-center p-3 rounded-md bg-red-900/50 text-red-300 border border-red-700">
                    <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}
                {copySuccess && (
                  <div className="mb-4 flex items-center p-3 rounded-md bg-green-900/50 text-green-300 border border-green-700">
                    <p className="text-sm">{copySuccess}</p>
                  </div>
                )}

                {transcriptionMode === 'live' && (
                  <div className="flex flex-col items-center">
                    {isRecording && (
                      <div className="flex items-center space-x-2 text-red-400 mb-4 animate-pulse">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span>Enregistrement en cours...</span>
                      </div>
                    )}
                    <button
                      onClick={handleToggleRecording}
                      className={`flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-4 focus:ring-opacity-50 ${
                        isRecording 
                        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-400 text-white' 
                        : 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-400 text-white'
                      }`}
                      aria-label={isRecording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
                    >
                      {isRecording ? <StopIcon className="w-8 h-8" /> : <MicrophoneIcon className="w-8 h-8" />}
                    </button>
                  </div>
                )}

                {transcriptionMode === 'file' && (
                  <div className="flex flex-col items-center space-y-4">
                    <input
                      type="file"
                      id="audio-upload"
                      ref={fileInputRef}
                      hidden
                      accept="audio/*"
                      onChange={handleFileChange}
                      disabled={isProcessingFile}
                    />
                    <label 
                      htmlFor="audio-upload" 
                      className={`w-full flex items-center justify-center px-4 py-3 rounded-lg border-2 border-dashed bg-gray-700/50 transition-colors ${
                        isProcessingFile ? 'cursor-not-allowed opacity-50' : 'cursor-pointer border-gray-600 hover:border-sky-500 hover:bg-gray-700'
                      }`}
                    >
                      <UploadIcon className="w-6 h-6 mr-3 text-gray-400" />
                      <span className="text-gray-300 truncate">{selectedFile ? selectedFile.name : 'Sélectionner un fichier audio'}</span>
                    </label>
                    {selectedFile && (
                      <button
                        onClick={handleStartFileTranscription}
                        disabled={isProcessingFile || !selectedFile}
                        className="w-full flex items-center justify-center px-6 py-3 rounded-lg bg-sky-600 text-white font-semibold shadow-md transition-colors hover:bg-sky-700 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
                      >
                        {isProcessingFile ? (
                          <>
                            <SpinnerIcon className="w-5 h-5 mr-3" />
                            <span>Transcription en cours...</span>
                          </>
                        ) : (
                          'Transcrire le fichier'
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Section Analyse */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-sky-400">Analyse Commerciale</h2>
                <div className="flex items-center space-x-3">
                  {showAnalysis && currentAnalysis && (
                    <>
                      <div className="flex flex-col items-center">
                        <button
                          onClick={handleCopyAnalysis}
                          className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                          title="Copier l'analyse"
                        >
                          <ClipboardIcon className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-gray-400 mt-1">Copier</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <button
                          onClick={handleExportAnalysis}
                          className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                          title="Exporter l'analyse en TXT"
                        >
                          <DocumentDownloadIcon className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-gray-400 mt-1">TXT</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <button
                          onClick={handleExportAnalysisPDF}
                          className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                          title="Exporter l'analyse en PDF"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6" />
                          </svg>
                        </button>
                        <span className="text-xs text-gray-400 mt-1">PDF</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <button
                          onClick={handleSaveAnalysis}
                          disabled={isSaving}
                          className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Sauvegarder la session complète dans Supabase"
                        >
                          {isSaving ? (
                            <SpinnerIcon className="w-4 h-4" />
                          ) : (
                            <CloudArrowUpIcon className="w-4 h-4" />
                          )}
                        </button>
                        <span className="text-xs text-gray-400 mt-1">Cloud</span>
                      </div>
                    </>
                  )}
                  <button
                    onClick={handleAnalyzeTranscription}
                    disabled={isAnalyzing || transcriptionHistory.length === 0}
                    className="flex items-center px-4 py-2 rounded-lg bg-sky-600 text-white font-medium shadow-md transition-colors hover:bg-sky-700 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    {isAnalyzing ? (
                      <>
                        <SpinnerIcon className="w-4 h-4 mr-2" />
                        <span>Analyse en cours...</span>
                      </>
                    ) : (
                      'Analyser la transcription'
                    )}
                  </button>
                </div>
              </div>

              {showAnalysis && currentAnalysis && (
                <div className="bg-gray-700 rounded-lg p-4 overflow-y-auto max-h-96">
                  <div className="prose prose-invert max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: currentAnalysis.replace(/\n/g, '<br />') }} />
                  </div>
                </div>
              )}

              {!showAnalysis && transcriptionHistory.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <p>Commencez par transcrire un audio pour pouvoir l'analyser.</p>
                </div>
              )}

              {!showAnalysis && transcriptionHistory.length > 0 && !isAnalyzing && (
                <div className="text-center text-gray-500 py-8">
                  <p>Cliquez sur "Analyser la transcription" pour obtenir une analyse commerciale détaillée.</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <CriteriaPanel />
          </div>
        </div>
      </main>
      {showSaveForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-sky-400">Sélectionner la table et le nom</h3>
              <button
                onClick={() => setShowSaveForm(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              handleSaveTranscription();
            }}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom de l'enregistrement
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Entrez un nom pour cette transcription..."
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Table de destination
                </label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value as TableName)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {TABLE_NAMES.map(table => (
                    <option key={table} value={table}>
                      {getTableDisplayName(table as TableName)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowSaveForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <SpinnerIcon className="w-4 h-4 mr-2" />
                  ) : (
                    'Sauvegarder'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
