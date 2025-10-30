// FIX: The `LiveSession` type is not an exported member of '@google/genai'.
import { GoogleGenAI, Modality } from '@google/genai';
import type { LiveServerMessage, GenerateContentResponse, Blob } from '@google/genai';
import { ANALYSIS_CRITERIA } from '../constants';
import { encode } from '../utils/audioUtils';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface SessionCallbacks {
  onTranscriptionUpdate: (textChunk: string, isFinal: boolean) => void;
  onError: (error: string) => void;
}

const createBlob = (data: Float32Array): Blob => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
};

export const startTranscriptionSession = async (callbacks: SessionCallbacks) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: () => {
        console.log('Session ouverte.');
      },
      onmessage: (message: LiveServerMessage) => {
        if (message.serverContent?.inputTranscription) {
          const { text } = message.serverContent.inputTranscription;
          callbacks.onTranscriptionUpdate(text, false);
        }
        if (message.serverContent?.turnComplete) {
            callbacks.onTranscriptionUpdate('', true);
        }
      },
      onerror: (e: ErrorEvent) => {
        console.error('Erreur de session:', e);
        callbacks.onError(`Une erreur de connexion est survenue: ${e.message}`);
      },
      onclose: (e: CloseEvent) => {
        console.log('Session fermée.');
      },
    },
    config: {
      responseModalities: [Modality.AUDIO], // Requis par l'API Live, même pour la transcription uniquement.
      inputAudioTranscription: {},
      systemInstruction: "Tu es un assistant de transcription ultra-précis. Ta seule tâche est de transcrire ce que dit l'utilisateur en français. Ne réponds pas, ne commente pas, transcris simplement.",
    },
  });

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const streamSource = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (audioProcessingEvent) => {
    const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
    const pcmBlob = createBlob(inputData);
    sessionPromise.then((session) => {
      session.sendRealtimeInput({ media: pcmBlob });
    }).catch(err => {
        console.error("Erreur lors de l'envoi des données audio:", err);
        callbacks.onError("Impossible d'envoyer les données audio au serveur.");
    });
  };

  streamSource.connect(processor);
  processor.connect(audioContext.destination);

  const session = await sessionPromise;
  
  return { session, audioContext, streamSource, processor, stream };
};

const fileToGenerativePart = (file: File): Promise<{ inlineData: { data: string; mimeType: string; } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const data = result.split(',')[1];
      resolve({
        inlineData: {
          data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = error => reject(error);
  });
};

export const transcribeAudioFile = async (file: File): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const audioPart = await fileToGenerativePart(file);
    const textPart = { text: "Transcris cet audio en français. Fournis uniquement la transcription textuelle, sans aucun commentaire ou phrase supplémentaire." };
    
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [audioPart, textPart] },
    });

    return response.text;
};

export async function analyzeTranscription(transcription: string) {
    const model = 'gemini-2.5-flash';

    const fullCriteriaText = ANALYSIS_CRITERIA.map(c => `
--- CRITERE : ${c.title} ---
${c.content}
`).join('\n');

    const prompt = `
Vous êtes un coach commercial expert, spécialisé dans l'analyse des appels de vente B2C et conseille en mutuelle santé.
Votre mission est d'analyser la transcription d'appel suivante en vous basant sur les critères et méthodologies de vente fournis.

TRANSCRIPTION DE L'APPEL :
\`\`\`
${transcription}
\`\`\`

CRITÈRES D'ANALYSE DÉTAILLÉS :
${fullCriteriaText}

INSTRUCTIONS :
Pour chaque critère listé ci-dessous, fournissez une évaluation détaillée :
1.  **Respect du script et structure**: Note sur 10. L'agent a-t-il suivi les étapes clés (introduction, découverte, qualification, conclusion) ?
2.  **Méthode SPIN Selling**: Note sur 10. Comment l'agent a-t-il utilisé les questions S, P, I, N ? Donnez des exemples.
3.  **Adaptation (Méthode DISC)**: Note sur 10. L'agent a-t-il adapté son style de communication au prospect ? Quel profil DISC le prospect semble-t-il avoir ?
4.  **Courbe de la Confiance**: Note sur 10. L'agent a-t-il réussi à établir une confiance personnelle et professionnelle ?
5.  **Communication Top-Down**: Note sur 10. Le message de l'agent était-il clair, concis et bien structuré ?
6.  **Gestion des Objections**: Note sur 10. Comment l'agent a-t-il géré les objections ?

En plus des notes, fournissez un **Résumé Global** avec les points forts, les axes d'amélioration, et un conseil pratique principal.
Structurez votre réponse en Markdown pour une lecture facile.
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error analyzing transcription:", error);
        throw new Error("Failed to get analysis from Gemini API.");
    }
}

export function getGeminiAIInstance() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

// Fonction pour exporter la transcription en fichier TXT
export const exportTranscriptionToTxt = (transcriptionHistory: Array<{ id: number; text: string }>, currentTranscription: string = '') => {
    const fullTranscription = transcriptionHistory.map(entry => entry.text).join('\n\n---\n\n') + 
                              (currentTranscription ? '\n\n---\n\n' + currentTranscription : '');
    
    const blob = new Blob([fullTranscription], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcription_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// Fonction pour copier la transcription dans le presse-papiers
export const copyTranscriptionToClipboard = async (transcriptionHistory: Array<{ id: number; text: string }>, currentTranscription: string = '') => {
    const fullTranscription = transcriptionHistory.map(entry => entry.text).join('\n\n---\n\n') + 
                              (currentTranscription ? '\n\n---\n\n' + currentTranscription : '');
    
    try {
        await navigator.clipboard.writeText(fullTranscription);
        return true;
    } catch (err) {
        console.error('Erreur lors de la copie dans le presse-papiers:', err);
        return false;
    }
};

// Fonction pour exporter l'analyse en fichier TXT
export const exportAnalysisToTxt = (analysis: string, transcriptionHistory: Array<{ id: number; text: string }>) => {
    const fullTranscription = transcriptionHistory.map(entry => entry.text).join('\n\n---\n\n');
    const content = `TRANSCRIPTION DE L'APPEL:\n${'='.repeat(50)}\n\n${fullTranscription}\n\n${'='.repeat(50)}\n\nANALYSE COMMERCIALE:\n${'='.repeat(50)}\n\n${analysis}`;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analyse_appel_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// Fonction pour copier l'analyse dans le presse-papiers
export const copyAnalysisToClipboard = async (analysis: string, transcriptionHistory: Array<{ id: number; text: string }>) => {
    const fullTranscription = transcriptionHistory.map(entry => entry.text).join('\n\n---\n\n');
    const content = `TRANSCRIPTION DE L'APPEL:\n${'='.repeat(50)}\n\n${fullTranscription}\n\n${'='.repeat(50)}\n\nANALYSE COMMERCIALE:\n${'='.repeat(50)}\n\n${analysis}`;
    
    try {
        await navigator.clipboard.writeText(content);
        return true;
    } catch (err) {
        console.error('Erreur lors de la copie dans le presse-papiers:', err);
        return false;
    }
};
