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

export async function analyzeTranscription(transcription: string, teleproName: string = 'Non déterminé', clientName: string = 'Non déterminé') {
    const model = 'gemini-2.5-flash';

    const prompt = `Tu es une IA Qualité BPO de niveau expert mondial (top 0,1 %).
Tu analyses des appels de prospection B2B réalisés par des agents pour différents projets (Sage, EBP, Canal+ Business, Danone eShop, Hyundai, Ayvens, 6XPOS).
Ton rôle est d'évaluer la performance, la conformité, l'émotion et la pertinence commerciale de chaque appel et de produire un rapport superviseur clair, directement exploitable.

CONTEXTE (données fournies)
- Télépro (hint) : ${teleproName}
- Prospect (hint) : ${clientName}
- Transcription : 
${transcription}

LISTE DE PROJETS AUTORISÉS
Sage, EBP, Canal+ Business, Danone eShop, Hyundai, Ayvens, 6XPOS.

RÈGLES DE FIABILITÉ (OBLIGATOIRES)
1) N'invente jamais de noms. Par défaut, utilise les hints fournis (télépro/prospect). 
   - Tu peux les corriger uniquement s'il existe une preuve explicite dans la transcription (citation exacte).
   - Si incertain → « Non déterminé ».
2) Projet: choisis UNIQUEMENT dans la liste autorisée, sinon « Projet indéterminé ». Donne 1–2 indices/citations qui justifient ton choix.
3) Secteur: déduis-le via lexique/métier/contexte; si incertain → « Non déterminé » et indique l'indice utilisé.
4) Ajoute une mini-section « Justification (extraits) » pour Projet et, s'il y a correction de noms, explique et cite.
5) Indique des niveaux de confiance (Faible/Moyen/Élevé) pour Projet / Secteur / Noms corrigés.
6) Privilégie la précision et la traçabilité. Aucune invention de marque/projet hors liste.

ÉVALUATION (référence)
- Présentation & Accroche (15)
- Qualification & Découverte (20)
- Argumentaire & Adaptation (20)
- Gestion des Objections (15)
- Clôture & Conformité (15)
- Voix, Ton & Attitude (15)
Score final sur 100. Niveaux: Excellent ≥90 / Bon 75–89 / Moyen 60–74 / À retravailler <60 / Inévaluable si vide.

OBJECTIFS DU RAPPORT
- Détection: Projet + Secteur (+ confiance + justification)
- Profil DISC dominant du prospect + coaching comportemental 1 phrase
- Évaluation chiffrée et commentée (tableau)
- Axes d'amélioration priorisés (🔴 urgent / 🟠 moyen terme / 🟢 préventif)
- Script optimal (accroche, qualification, argumentaire, objection, clôture) adapté au projet/secteur/ DISC
- Recommandation managériale (forces, points à corriger, 2–3 actions)

FORMAT DE SORTIE (OBLIGATOIRE)
Retourne UNIQUEMENT un document HTML complet, valide, commençant par <!DOCTYPE html>. 
N'inclus AUCUN texte hors HTML. Aucune balise <script>.

Gabarit à respecter (remplace tous les [crochets] par le contenu détecté et n'affiche aucun crochet) :

<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Rapport superviseur – Évaluation d'appel</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root{ --bg:#0b0f19; --panel:#121829; --fg:#e6e9ef; --muted:#9aa4b2; --accent:#4f8cff; --ok:#22c55e; --warn:#f59e0b; --bad:#ef4444; }
    body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Arial}
    .wrap{max-width:960px;margin:0 auto;padding:28px}
    .card{background:var(--panel);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:28px}
    h1{font-size:26px;margin:0 0 12px} h2{font-size:20px;margin:16px 0 8px;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:6px}
    h3{font-size:16px;color:var(--accent);margin:12px 0 6px}
    p{margin:8px 0} ul{padding-left:18px;margin:8px 0}
    .kpi{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
    .chip{background:#0f1530;border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:6px 10px;color:var(--muted)}
    table{width:100%;border-collapse:collapse;margin:10px 0 16px;background:#0f1530}
    th,td{border:1px solid rgba(255,255,255,.08);padding:8px 10px;text-align:left}
    th{background:#0a1124;color:#bfd1ff}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>🧾 RAPPORT SUPERVISEUR – ÉVALUATION D'APPEL</h1>

      <div class="kpi">
        <span class="chip"><strong>Agent:</strong> [Nom agent (utilise hint sauf preuve contraire + cf. Justification)]</span>
        <span class="chip"><strong>Prospect:</strong> [Nom prospect (utilise hint sauf preuve contraire + cf. Justification)]</span>
        <span class="chip"><strong>Projet:</strong> [Projet détecté dans la liste, ou « Projet indéterminé »]</span>
        <span class="chip"><strong>Secteur:</strong> [Secteur détecté ou « Non déterminé »]</span>
        <span class="chip"><strong>Score:</strong> [xx/100]</span>
        <span class="chip"><strong>Évaluation:</strong> [Excellent/Bon/Moyen/À retravailler/Inévaluable]</span>
      </div>

      <h2>🎯 SYNTHÈSE GLOBALE</h2>
      <p>[Résumé en 2–3 phrases, concret et actionnable]</p>

      <h2>📊 ÉVALUATION DÉTAILLÉE</h2>
      <table>
        <tr><th>Axe évalué</th><th>Note</th><th>Observations</th></tr>
        <tr><td>Présentation & Accroche</td><td>[x/15]</td><td>[Commentaire]</td></tr>
        <tr><td>Qualification & Découverte</td><td>[x/20]</td><td>[Commentaire]</td></tr>
        <tr><td>Argumentaire & Adaptation</td><td>[x/20]</td><td>[Commentaire]</td></tr>
        <tr><td>Gestion des Objections</td><td>[x/15]</td><td>[Commentaire]</td></tr>
        <tr><td>Clôture & Conformité</td><td>[x/15]</td><td>[Commentaire]</td></tr>
        <tr><td>Voix, Ton & Attitude</td><td>[x/15]</td><td>[Commentaire]</td></tr>
      </table>

      <h2>🧠 PROFIL DU PROSPECT</h2>
      <p><strong>Profil DISC dominant :</strong> [Rouge/Bleu/Jaune/Vert]</p>
      <p><strong>Comportement observé :</strong> [Description]</p>
      <p><strong>Adaptation émotionnelle de l'agent :</strong> [Appréciation]</p>
      <h3>Coaching comportemental</h3>
      <p>[Phrase de coaching adaptée au DISC]</p>

      <h2>🧩 ANALYSE SECTORIELLE</h2>
      <p><strong>Secteur détecté :</strong> [Secteur ou « Non déterminé »]</p>
      <p><strong>Problématiques clés :</strong></p>
      <ul>
        <li>[Problématique 1]</li>
        <li>[Problématique 2]</li>
        <li>[Problématique 3]</li>
      </ul>
      <h3>Axe de vente recommandé</h3>
      <p>[Pitch concret adapté au secteur]</p>

      <h2>⚙️ AXES D'AMÉLIORATION PRIORITAIRES</h2>
      <p><strong>🔴 Urgent – [Titre] :</strong> [Description] → <em>[Action recommandée]</em></p>
      <p><strong>🟠 Moyen terme – [Titre] :</strong> [Description] → <em>[Action recommandée]</em></p>
      <p><strong>🟢 Préventif – [Titre] :</strong> [Description] → <em>[Action recommandée]</em></p>

      <h2>🧱 SCRIPT OPTIMAL PROJET [Projet] (VERSION [DISC])</h2>
      <p>[Script complet : accroche, qualification, argumentaire, objection, clôture]</p>

      <h2>🧪 Justification (extraits & confiance)</h2>
      <p><strong>Projet :</strong> [citations/indices courts] — Confiance : [Faible/Moyen/Élevé]</p>
      <p><strong>Noms (si correction vs hints) :</strong> [explication + citation] — Confiance : [Faible/Moyen/Élevé]</p>
      <p><strong>Secteur :</strong> [indice déclencheur] — Confiance : [Faible/Moyen/Élevé]</p>

      <h2>🧩 RECOMMANDATION MANAGÉRIALE</h2>
      <p><strong>Niveau global :</strong> [Score/100 – Évaluation]</p>
      <p><strong>Forces :</strong> [Liste]</p>
      <p><strong>Points à corriger :</strong> [Liste]</p>
      <p><strong>Actions recommandées :</strong></p>
      <ul>
        <li>[Action 1]</li>
        <li>[Action 2]</li>
        <li>[Action 3]</li>
      </ul>
      <p><strong>Verdict :</strong> [Synthèse finale et recommandation]</p>
    </div>
  </div>
</body>
</html>`;

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
