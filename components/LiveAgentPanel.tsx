import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob as GenAI_Blob } from '@google/genai';
import { MicIcon, StopCircleIcon, BotIcon, UserIcon } from './Icons';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';
import { getGeminiAIInstance } from '../services/geminiService';
import { TranscriptionTurn } from '../types';


// Define global declaration for webkitAudioContext
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext
  }
}

const LiveAgentPanel: React.FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [status, setStatus] = useState('Idle. Click Start to begin.');
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionTurn[]>([]);
  
  const sessionRef = useRef<LiveSession | null>(null);
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  const lastUserTurnRef = useRef<HTMLDivElement | null>(null);

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close();
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
       outputAudioContextRef.current.close();
    }
    
    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();
    
    setIsSessionActive(false);
    setStatus('Session ended. Click Start to begin again.');
    sessionRef.current = null;
    sessionPromiseRef.current = null;
  }, []);

  const startSession = async () => {
    if (isSessionActive) return;
    
    try {
      setTranscriptionHistory([]);
      setStatus('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      setStatus('Initializing audio contexts...');
      inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;

      const ai = getGeminiAIInstance();

      setStatus('Connecting to Gemini Live API...');
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setStatus('Connection open. Start speaking.');
            setIsSessionActive(true);
            
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob: GenAI_Blob = {
                data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Transcription
            if (message.serverContent?.inputTranscription) {
                currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                // update last user turn
                setTranscriptionHistory(prev => {
                    const newHistory = [...prev];
                    if (newHistory.length > 0 && newHistory[newHistory.length - 1].speaker === 'user') {
                        newHistory[newHistory.length - 1].text = currentInputTranscriptionRef.current;
                    } else {
                        newHistory.push({ speaker: 'user', text: currentInputTranscriptionRef.current });
                    }
                    return newHistory;
                });
            } else if (message.serverContent?.outputTranscription) {
                currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                // update last model turn
                setTranscriptionHistory(prev => {
                    const newHistory = [...prev];
                    if (newHistory.length > 0 && newHistory[newHistory.length - 1].speaker === 'model') {
                        newHistory[newHistory.length - 1].text = currentOutputTranscriptionRef.current;
                    } else {
                        newHistory.push({ speaker: 'model', text: currentOutputTranscriptionRef.current });
                    }
                    return newHistory;
                });
            }

            if (message.serverContent?.turnComplete) {
                currentInputTranscriptionRef.current = '';
                currentOutputTranscriptionRef.current = '';
            }

            // Handle Audio
            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64EncodedAudioString && outputAudioContextRef.current) {
              const outputCtx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              
              const audioBuffer = await decodeAudioData(
                decode(base64EncodedAudioString),
                outputCtx, 24000, 1
              );
              
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtx.destination);
              source.addEventListener('ended', () => { audioSourcesRef.current.delete(source); });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              audioSourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              audioSourcesRef.current.forEach(source => source.stop());
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Live API Error:', e);
            setStatus(`Error: ${e.message}. Please try again.`);
            stopSession();
          },
          onclose: (e: CloseEvent) => {
            console.log('Live API session closed');
            stopSession();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: "Vous êtes un coach commercial expert et un partenaire de jeu de rôle. Engagez des conversations de vente réalistes avec l'utilisateur, en vous basant sur des méthodologies comme SPIN et DISC. Fournissez des retours constructifs. Soyez amical et encourageant.",
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      });

      sessionPromiseRef.current = sessionPromise;
      sessionPromise.then(session => sessionRef.current = session);

    } catch (error) {
      console.error("Failed to start session:", error);
      setStatus(`Error starting session: ${(error as Error).message}`);
      stopSession();
    }
  };
  
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col h-[600px]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">Live Role-Play Agent</h2>
        <button
          onClick={isSessionActive ? stopSession : startSession}
          className={`px-4 py-2 rounded-md font-semibold flex items-center gap-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${
            isSessionActive 
            ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500' 
            : 'bg-cyan-500 hover:bg-cyan-600 text-white focus:ring-cyan-400'
          }`}
        >
          {isSessionActive ? <StopCircleIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
          {isSessionActive ? 'Stop Session' : 'Start Session'}
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-4 h-5">{status}</p>
      
      <div className="flex-grow bg-gray-900/50 rounded-md p-4 overflow-y-auto space-y-4">
        {transcriptionHistory.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-500">
                <p>Conversation will appear here...</p>
            </div>
        )}
        {transcriptionHistory.map((turn, index) => (
            <div key={index} className={`flex gap-3 ${turn.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                {turn.speaker === 'model' && <BotIcon className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-1" />}
                <div className={`max-w-[80%] p-3 rounded-lg ${turn.speaker === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700'}`}>
                    <p>{turn.text}</p>
                </div>
                 {turn.speaker === 'user' && <UserIcon className="w-6 h-6 text-gray-300 flex-shrink-0 mt-1" />}
            </div>
        ))}
        <div ref={lastUserTurnRef} />
      </div>
    </div>
  );
};

export default LiveAgentPanel;
