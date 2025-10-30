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
    console.error('❌ Configuration Supabase manquante !');
    console.error('🔧 Veuillez créer un fichier .env.local avec:');
    console.error('   VITE_SUPABASE_URL=your_supabase_url');
    console.error('   VITE_SUPABASE_ANON_KEY=your_anon_key');
    console.error('📖 Voir le fichier .env.example pour un exemple');
}

// Créer le client Supabase uniquement si la configuration est complète
export const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Types pour les nouvelles tables
type TableName = 'staffy' | 'mutuelle' | 'timeone' | 'sercure';

export interface RecordData {
    id?: string;
    title: string;
    nom: string;
    transcriptions: string;
    is_processed?: boolean;
    created_at?: string;
    updated_at?: string;
}

// Fonction générique pour sauvegarder dans n'importe quelle table
export const saveRecord = async (tableName: TableName, recordData: Omit<RecordData, 'id' | 'created_at' | 'updated_at'>) => {
    if (!supabase) {
        throw new Error('Client Supabase non initialisé. Veuillez vérifier votre configuration.');
    }

    try {
        const { data, error } = await supabase
            .from(tableName)
            .insert([recordData]);

        if (error) {
            console.error(`❌ Erreur lors de la sauvegarde dans ${tableName}:`, error);
            console.error('📊 Détails:', {
                table: tableName,
                data: recordData,
                error: error.message,
                code: error.code
            });
            throw error;
        }

        return data?.[0];
    } catch (error) {
        console.error(`❌ Erreur inattendue lors de la sauvegarde dans ${tableName}:`, error);
        throw error;
    }
};

// Fonction pour récupérer les enregistrements d'une table spécifique
export const getRecords = async (tableName: TableName) => {
    if (!supabase) {
        throw new Error('Client Supabase non initialisé. Veuillez vérifier votre configuration.');
    }

    try {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error(`Erreur lors de la récupération des enregistrements de ${tableName}:`, error);
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error(`Erreur inattendue lors de la récupération des enregistrements de ${tableName}:`, error);
        throw error;
    }
};

// Fonction pour supprimer un enregistrement d'une table spécifique
export const deleteRecord = async (tableName: TableName, id: string) => {
    if (!supabase) {
        throw new Error('Client Supabase non initialisé. Veuillez vérifier votre configuration.');
    }

    try {
        const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('id', id);

        if (error) {
            console.error(`Erreur lors de la suppression dans ${tableName}:`, error);
            throw error;
        }

        return true;
    } catch (error) {
        console.error(`Erreur inattendue lors de la suppression dans ${tableName}:`, error);
        throw error;
    }
};

// Fonction pour récupérer toutes les tables disponibles
export const getAllTables = (): TableName[] => {
    return ['staffy', 'mutuelle', 'timeone', 'sercure'];
};

// Fonction utilitaire pour sauvegarder une transcription avec choix de table
export const saveTranscriptionToTable = async (
    tableName: TableName,
    title: string,
    nom: string,
    transcriptions: string
) => {
    return saveRecord(tableName, {
        title,
        nom,
        transcriptions
    });
};
