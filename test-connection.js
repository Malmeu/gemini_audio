// Test de connexion Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 Test de connexion Supabase');
console.log('URL:', supabaseUrl);
console.log('Clé configurée:', !!supabaseKey);

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

async function testConnection() {
  try {
    // Test de lecture
    const { data, error } = await supabase.from('staffy').select('*').limit(1);
    
    if (error) {
      console.error('❌ Erreur:', error);
    } else {
      console.log('✅ Connexion réussie!');
      console.log('Données:', data);
    }
  } catch (err) {
    console.error('💥 Erreur de connexion:', err);
  }
}

testConnection();
