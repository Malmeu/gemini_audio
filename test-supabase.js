// Test de connexion rapide
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://myvxcbtauszyycgxydlu.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15dnhjYnRhdXN6eXljZ3h5ZGx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAyOTg0MDAsImV4cCI6MjA0NTg3NDQwMH0.8fX0v3q7v3q7v3q7v3q7v3q7v3q7v3q7v3q7v3q7v3q7'
);

async function test() {
    try {
        // Test simple
        const { data, error } = await supabase.from('staffy').select('*').limit(1);
        console.log('Test staffy:', { data, error });
        
        // Test d'insertion
        const testData = {
            title: 'Test',
            nom: 'Test',
            transcriptions: 'Test de connexion'
        };
        
        const { data: insertData, error: insertError } = await supabase
            .from('staffy')
            .insert([testData])
            .select();
            
        console.log('Test insertion:', { insertData, insertError });
    } catch (err) {
        console.error('Erreur:', err);
    }
}

test();
