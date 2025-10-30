-- Suppression des anciennes tables
DROP TABLE IF EXISTS analyses CASCADE;
DROP TABLE IF EXISTS transcriptions CASCADE;

-- Création des nouvelles tables
CREATE TABLE IF NOT EXISTS staffy (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    nom VARCHAR(255) NOT NULL,
    transcriptions TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mutuelle (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    nom VARCHAR(255) NOT NULL,
    transcriptions TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timeone (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    nom VARCHAR(255) NOT NULL,
    transcriptions TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sercure (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    nom VARCHAR(255) NOT NULL,
    transcriptions TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Création des indexes pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_staffy_created_at ON staffy(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mutuelle_created_at ON mutuelle(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeone_created_at ON timeone(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sercure_created_at ON sercure(created_at DESC);

-- Création des triggers pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Application des triggers aux 4 tables
CREATE TRIGGER update_staffy_updated_at BEFORE UPDATE ON staffy 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mutuelle_updated_at BEFORE UPDATE ON mutuelle 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_timeone_updated_at BEFORE UPDATE ON timeone 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sercure_updated_at BEFORE UPDATE ON sercure 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Activer Row Level Security (RLS) pour la sécurité
ALTER TABLE staffy ENABLE ROW LEVEL SECURITY;
ALTER TABLE mutuelle ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeone ENABLE ROW LEVEL SECURITY;
ALTER TABLE sercure ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité (à adapter selon vos besoins)
CREATE POLICY "Enable all operations on staffy" ON staffy FOR ALL USING (true);
CREATE POLICY "Enable all operations on mutuelle" ON mutuelle FOR ALL USING (true);
CREATE POLICY "Enable all operations on timeone" ON timeone FOR ALL USING (true);
CREATE POLICY "Enable all operations on sercure" ON sercure FOR ALL USING (true);
