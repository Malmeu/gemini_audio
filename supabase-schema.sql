-- Création de la table des transcriptions
CREATE TABLE IF NOT EXISTS transcriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    audio_file_name VARCHAR(255),
    duration INTEGER, -- en secondes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Création de la table des analyses
CREATE TABLE IF NOT EXISTS analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transcription_id UUID REFERENCES transcriptions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    score_global DECIMAL(3,2), -- note globale sur 10
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Création des indexes pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON transcriptions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_transcription_id ON analyses(transcription_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);

-- Création d'une fonction pour mettre à jour le champ updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Création des triggers pour mettre à jour updated automatiquement
CREATE TRIGGER update_transcriptions_updated_at BEFORE UPDATE ON transcriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analyses_updated_at BEFORE UPDATE ON analyses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Activer Row Level Security (RLS) pour la sécurité
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité (à adapter selon vos besoins)
-- Pour l'instant, autoriser toutes les opérations (à restreindre en production)
CREATE POLICY "Enable all operations on transcriptions" ON transcriptions
    FOR ALL USING (true);

CREATE POLICY "Enable all operations on analyses" ON analyses
    FOR ALL USING (true);
