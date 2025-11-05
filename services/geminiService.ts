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
N'inclus AUCUN texte hors HTML.

Gabarit à respecter (remplace tous les [crochets] par le contenu détecté et n'affiche aucun crochet) :

<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Rapport superviseur – Évaluation d'appel</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @media print {
      body { background: white !important; }
      .wrap { max-width: 100% !important; padding: 20px !important; }
      .card { border: none !important; box-shadow: none !important; }
    }
    :root{ 
      --bg:#0b0f19; --panel:#121829; --fg:#e6e9ef; --muted:#9aa4b2; 
      --accent:#4f8cff; --ok:#22c55e; --warn:#f59e0b; --bad:#ef4444;
      --excellent:#22c55e; --bon:#3b82f6; --moyen:#f59e0b; --faible:#ef4444;
    }
    * { box-sizing: border-box; }
    body{
      margin:0;
      background:var(--bg);
      color:var(--fg);
      font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Arial;
    }
    .wrap{max-width:1100px;margin:0 auto;padding:32px 20px}
    .card{
      background:var(--panel);
      border:1px solid rgba(255,255,255,.08);
      border-radius:16px;
      padding:32px;
      box-shadow:0 4px 24px rgba(0,0,0,0.3);
    }
    h1{
      font-size:28px;
      margin:0 0 24px;
      font-weight:700;
      background:linear-gradient(135deg, var(--accent), #6366f1);
      -webkit-background-clip:text;
      -webkit-text-fill-color:transparent;
      background-clip:text;
    }
    h2{
      font-size:20px;
      margin:28px 0 16px;
      border-bottom:2px solid rgba(79,140,255,0.3);
      padding-bottom:8px;
      font-weight:600;
    }
    h3{
      font-size:16px;
      color:var(--accent);
      margin:16px 0 8px;
      font-weight:600;
    }
    p{margin:10px 0;line-height:1.7}
    ul{padding-left:20px;margin:12px 0}
    li{margin:6px 0}
    .kpi{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
      gap:12px;
      margin:20px 0;
    }
    .chip{
      background:#0f1530;
      border:1px solid rgba(79,140,255,0.2);
      border-radius:10px;
      padding:12px 16px;
      color:var(--fg);
      font-size:14px;
      transition:all 0.2s;
    }
    .chip:hover{
      border-color:var(--accent);
      background:#141b3a;
    }
    .chip strong{
      color:var(--accent);
      display:block;
      margin-bottom:4px;
      font-size:12px;
      text-transform:uppercase;
      letter-spacing:0.5px;
    }
    .score-badge{
      display:inline-block;
      padding:6px 14px;
      border-radius:20px;
      font-weight:700;
      font-size:16px;
    }
    .score-excellent{background:var(--excellent);color:#000}
    .score-bon{background:var(--bon);color:#fff}
    .score-moyen{background:var(--warn);color:#000}
    .score-faible{background:var(--bad);color:#fff}
    
    /* Tableau amélioré */
    .table-container{
      overflow-x:auto;
      margin:16px 0 24px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.08);
    }
    table{
      width:100%;
      border-collapse:collapse;
      background:#0f1530;
    }
    thead tr{
      background:linear-gradient(135deg, #1a2332, #0a1124);
    }
    th{
      padding:14px 16px;
      text-align:left;
      font-weight:600;
      color:#bfd1ff;
      text-transform:uppercase;
      font-size:12px;
      letter-spacing:0.5px;
      border-bottom:2px solid rgba(79,140,255,0.3);
    }
    th:first-child{border-top-left-radius:12px}
    th:last-child{border-top-right-radius:12px}
    td{
      padding:14px 16px;
      border-bottom:1px solid rgba(255,255,255,.05);
      vertical-align:top;
    }
    tbody tr{
      transition:background 0.2s;
    }
    tbody tr:hover{
      background:rgba(79,140,255,0.05);
    }
    tbody tr:last-child td{border-bottom:none}
    tbody tr:last-child td:first-child{border-bottom-left-radius:12px}
    tbody tr:last-child td:last-child{border-bottom-right-radius:12px}
    .note-cell{
      font-weight:700;
      font-size:16px;
      color:var(--accent);
      white-space:nowrap;
      text-align:center;
      min-width:80px;
    }
    .axe-cell{
      font-weight:600;
      color:var(--fg);
    }
    .obs-cell{
      color:var(--muted);
      line-height:1.6;
    }
    
    /* Sections spéciales */
    .priority-item{
      background:rgba(79,140,255,0.05);
      border-left:4px solid var(--accent);
      padding:12px 16px;
      margin:12px 0;
      border-radius:6px;
    }
    .priority-urgent{border-left-color:var(--bad)}
    .priority-moyen{border-left-color:var(--warn)}
    .priority-preventif{border-left-color:var(--ok)}
    
    .confidence-badge{
      display:inline-block;
      padding:4px 10px;
      border-radius:12px;
      font-size:12px;
      font-weight:600;
      margin-left:8px;
    }
    .conf-eleve{background:var(--ok);color:#000}
    .conf-moyen{background:var(--warn);color:#000}
    .conf-faible{background:var(--bad);color:#fff}
    
    .script-box{
      background:#0a0f1a;
      border:1px solid rgba(79,140,255,0.2);
      border-radius:10px;
      padding:20px;
      margin:16px 0;
      font-family:'Courier New',monospace;
      line-height:1.8;
    }
    
    .verdict-box{
      background:linear-gradient(135deg, rgba(79,140,255,0.1), rgba(99,102,241,0.1));
      border:2px solid rgba(79,140,255,0.3);
      border-radius:12px;
      padding:20px;
      margin:16px 0;
      font-weight:500;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>🧾 RAPPORT SUPERVISEUR – ÉVALUATION D'APPEL</h1>

      <div class="kpi">
        <div class="chip"><strong>Agent</strong>[Nom agent]</div>
        <div class="chip"><strong>Prospect</strong>[Nom prospect]</div>
        <div class="chip"><strong>Projet</strong>[Projet détecté]</div>
        <div class="chip"><strong>Secteur</strong>[Secteur détecté]</div>
        <div class="chip"><strong>Score</strong><span class="score-badge score-[classe]">[xx/100]</span></div>
        <div class="chip"><strong>Évaluation</strong>[Niveau]</div>
      </div>

      <h2>🎯 SYNTHÈSE GLOBALE</h2>
      <p>[Résumé en 2–3 phrases, concret et actionnable]</p>

      <h2>📊 ÉVALUATION DÉTAILLÉE</h2>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width:35%">Axe évalué</th>
              <th style="width:12%;text-align:center">Note</th>
              <th style="width:53%">Observations</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="axe-cell">Présentation & Accroche</td>
              <td class="note-cell">[x/15]</td>
              <td class="obs-cell">[Commentaire détaillé]</td>
            </tr>
            <tr>
              <td class="axe-cell">Qualification & Découverte</td>
              <td class="note-cell">[x/20]</td>
              <td class="obs-cell">[Commentaire détaillé]</td>
            </tr>
            <tr>
              <td class="axe-cell">Argumentaire & Adaptation</td>
              <td class="note-cell">[x/20]</td>
              <td class="obs-cell">[Commentaire détaillé]</td>
            </tr>
            <tr>
              <td class="axe-cell">Gestion des Objections</td>
              <td class="note-cell">[x/15]</td>
              <td class="obs-cell">[Commentaire détaillé]</td>
            </tr>
            <tr>
              <td class="axe-cell">Clôture & Conformité</td>
              <td class="note-cell">[x/15]</td>
              <td class="obs-cell">[Commentaire détaillé]</td>
            </tr>
            <tr>
              <td class="axe-cell">Voix, Ton & Attitude</td>
              <td class="note-cell">[x/15]</td>
              <td class="obs-cell">[Commentaire détaillé]</td>
            </tr>
          </tbody>
        </table>
      </div>

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
      <div class="priority-item priority-urgent">
        <strong>🔴 Urgent – [Titre]</strong><br>
        [Description] → <em>[Action recommandée]</em>
      </div>
      <div class="priority-item priority-moyen">
        <strong>🟠 Moyen terme – [Titre]</strong><br>
        [Description] → <em>[Action recommandée]</em>
      </div>
      <div class="priority-item priority-preventif">
        <strong>🟢 Préventif – [Titre]</strong><br>
        [Description] → <em>[Action recommandée]</em>
      </div>

      <h2>🧱 SCRIPT OPTIMAL PROJET [Projet] (VERSION [DISC])</h2>
      <div class="script-box">
        [Script complet : accroche, qualification, argumentaire, objection, clôture]
      </div>

      <h2>🧪 Justification (extraits & confiance)</h2>
      <p><strong>Projet :</strong> [citations/indices courts] <span class="confidence-badge conf-[niveau]">Confiance : [Niveau]</span></p>
      <p><strong>Noms :</strong> [explication + citation] <span class="confidence-badge conf-[niveau]">Confiance : [Niveau]</span></p>
      <p><strong>Secteur :</strong> [indice déclencheur] <span class="confidence-badge conf-[niveau]">Confiance : [Niveau]</span></p>

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
      <div class="verdict-box">
        <strong>Verdict :</strong> [Synthèse finale et recommandation]
      </div>
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
