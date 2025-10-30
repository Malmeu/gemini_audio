import { createClient } from '@supabase/supabase-js';

// Configuration détaillée
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 Configuration Supabase:');
console.log('URL:', supabaseUrl);
console.log('Key présente:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
    throw new Error(`
❌ Configuration Supabase manquante!

🔧 Vérifiez votre fichier .env.local:
- VITE_SUPABASE_URL: ${supabaseUrl || 'MANQUANT'}
- VITE_SUPABASE_ANON_KEY: ${supabaseKey ? 'CONFIGURÉ' : 'MANQUANT'}

📖 URL attendue: https://votre-projet.supabase.co
📖 Exemple: https://myvxcbtauszyycgxydlu.supabase.co
        `.trim());
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Types
type TableName = 'staffy' | 'mutuelle' | 'timeone' | 'sercure';

export interface RecordData {
    title: string;
    nom: string;
    transcriptions: string;
}

// Fonction de test de connexion
export async function testConnection() {
    try {
        const { data, error } = await supabase.from('staffy').select('*').limit(1);
        
        if (error) {
            console.error('❌ Erreur détaillée:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            return { success: false, error };
        }
        
        console.log('✅ Connexion réussie!');
        return { success: true, data };
    } catch (err) {
        console.error('💥 Erreur de connexion:', err);
        return { success: false, error: err };
    }
}

// Fonction de sauvegarde avec débogage
export async function saveTranscriptionToTable(
    tableName: TableName,
    title: string,
    nom: string,
    transcriptions: string
) {
    console.log(`📝 Tentative de sauvegarde dans ${tableName}:`, {
        title,
        nom,
        transcriptionsLength: transcriptions.length
    });

    try {
        const { data, error } = await supabase
            .from(tableName)
            .insert([{ title, nom, transcriptions }]);

        if (error) {
            console.error(`❌ Erreur ${tableName}:`, {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });
            throw error;
        }

        console.log(`✅ Sauvegarde réussie dans ${tableName}:`, data);
        return data;
    } catch (err) {
        console.error(`💥 Erreur critique ${tableName}:`, err);
        throw err;
    }
}

// Fonction pour lister toutes les tables
export async function listTables() {
    try {
        const tables = ['staffy', 'mutuelle', 'timeone', 'sercure'];
        const results = {};
        
        for (const table of tables) {
            try {
                const { data, error } = await supabase.from(table).select('*').limit(1);
                results[table] = { exists: !error, error: error?.message, count: data?.length || 0 };
            } catch (err) {
                results[table] = { exists: false, error: err.message };
            }
        }
        
        console.log('📊 État des tables:', results);
        return results;
    } catch (err) {
        console.error('❌ Erreur lors de la vérification des tables:', err);
        return {};
    }
}
