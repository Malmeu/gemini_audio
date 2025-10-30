import { createClient } from '@supabase/supabase-js';

// Configuration Supabase avec déclaration des types Vite
declare global {
    interface ImportMeta {
        env: {
            VITE_SUPABASE_URL?: string;
            VITE_SUPABASE_ANON_KEY?: string;
        };
    }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.warn('Configuration Supabase manquante. Les fonctionnalités de sauvegarde ne seront pas disponibles.');
    console.warn('Veuillez définir VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans votre fichier .env.local');
}

// Créer le client Supabase uniquement si la configuration est complète
export const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Types pour la base de données
export interface TranscriptionRecord {
    id?: string;
    title: string;
    content: string;
    audio_file_name?: string;
    duration?: number;
    created_at?: string;
    updated_at?: string;
}

export interface AnalysisRecord {
    id?: string;
    transcription_id?: string; // transcription_id est maintenant optionnel
    content: string;
    score_global?: number;
    created_at?: string;
    updated_at?: string;
}

// Fonction pour sauvegarder une transcription
export const saveTranscription = async (transcriptionData: Omit<TranscriptionRecord, 'id' | 'created_at' | 'updated_at'>) => {
    if (!supabase) {
        throw new Error('Client Supabase non initialisé. Veuillez vérifier votre configuration.');
    }

    try {
        const { data, error } = await supabase
            .from('transcriptions')
            .insert([transcriptionData])
            .select();

        if (error) {
            console.error('Erreur lors de la sauvegarde de la transcription:', error);
            throw error;
        }

        return data?.[0];
    } catch (error) {
        console.error('Erreur inattendue lors de la sauvegarde de la transcription:', error);
        throw error;
    }
};

// Fonction pour sauvegarder une analyse
export const saveAnalysis = async (analysisData: Omit<AnalysisRecord, 'id' | 'created_at' | 'updated_at'>) => {
    if (!supabase) {
        throw new Error('Client Supabase non initialisé. Veuillez vérifier votre configuration.');
    }

    try {
        const { data, error } = await supabase
            .from('analyses')
            .insert([analysisData])
            .select();

        if (error) {
            console.error('Erreur lors de la sauvegarde de l\'analyse:', error);
            throw error;
        }

        return data?.[0];
    } catch (error) {
        console.error('Erreur inattendue lors de la sauvegarde de l\'analyse:', error);
        throw error;
    }
};

// Fonction pour sauvegarder une transcription et son analyse associée
export const saveTranscriptionWithAnalysis = async (
    transcriptionData: Omit<TranscriptionRecord, 'id' | 'created_at' | 'updated_at'>,
    analysisData: Omit<AnalysisRecord, 'id' | 'created_at' | 'updated_at' | 'transcription_id'>
) => {
    if (!supabase) {
        throw new Error('Client Supabase non initialisé. Veuillez vérifier votre configuration.');
    }

    try {
        // D'abord sauvegarder la transcription
        const transcription = await saveTranscription(transcriptionData);
        
        if (!transcription?.id) {
            throw new Error('Impossible de récupérer l\'ID de la transcription sauvegardée');
        }

        // Puis sauvegarder l'analyse avec l'ID de la transcription
        const analysis = await saveAnalysis({
            ...analysisData,
            transcription_id: transcription.id
        });

        return { transcription, analysis };
    } catch (error) {
        console.error('Erreur lors de la sauvegarde complète:', error);
        throw error;
    }
};

// Fonction pour récupérer toutes les transcriptions
export const getTranscriptions = async () => {
    if (!supabase) {
        throw new Error('Client Supabase non initialisé. Veuillez vérifier votre configuration.');
    }

    try {
        const { data, error } = await supabase
            .from('transcriptions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erreur lors de la récupération des transcriptions:', error);
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('Erreur inattendue lors de la récupération des transcriptions:', error);
        throw error;
    }
};

// Fonction pour récupérer les analyses d'une transcription
export const getAnalysesByTranscriptionId = async (transcriptionId: string) => {
    if (!supabase) {
        throw new Error('Client Supabase non initialisé. Veuillez vérifier votre configuration.');
    }

    try {
        const { data, error } = await supabase
            .from('analyses')
            .select('*')
            .eq('transcription_id', transcriptionId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erreur lors de la récupération des analyses:', error);
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('Erreur inattendue lors de la récupération des analyses:', error);
        throw error;
    }
};

// Fonction pour supprimer une transcription et ses analyses
export const deleteTranscriptionWithAnalyses = async (transcriptionId: string) => {
    if (!supabase) {
        throw new Error('Client Supabase non initialisé. Veuillez vérifier votre configuration.');
    }

    try {
        // D'abord supprimer les analyses associées
        const { error: analysesError } = await supabase
            .from('analyses')
            .delete()
            .eq('transcription_id', transcriptionId);

        if (analysesError) {
            console.error('Erreur lors de la suppression des analyses:', analysesError);
            throw analysesError;
        }

        // Puis supprimer la transcription
        const { error: transcriptionError } = await supabase
            .from('transcriptions')
            .delete()
            .eq('id', transcriptionId);

        if (transcriptionError) {
            console.error('Erreur lors de la suppression de la transcription:', transcriptionError);
            throw transcriptionError;
        }

        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression complète:', error);
        throw error;
    }
};
