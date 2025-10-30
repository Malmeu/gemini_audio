-- Schéma final avec la colonne is_processed

-- Suppression des anciennes tables si nécessaire
DROP TABLE IF EXISTS staffy CASCADE;
DROP TABLE IF EXISTS mutuelle CASCADE;
DROP TABLE IF EXISTS timeone CASCADE;
DROP TABLE IF EXISTS sercure CASCADE;

-- Création des tables avec la colonne is_processed
CREATE TABLE IF NOT EXISTS staffy (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    nom VARCHAR(255) NOT NULL,
    transcriptions TEXT NOT NULL,
    is_processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mutuelle (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    nom VARCHAR(255) NOT NULL,
    transcriptions TEXT NOT NULL,
    is_processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timeone (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    nom VARCHAR(255) NOT NULL,
    transcriptions TEXT NOT NULL,
    is_processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sercure (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    nom VARCHAR(255) NOT NULL,
    transcriptions TEXT NOT NULL,
    is_processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Création des indexes
CREATE INDEX IF NOT EXISTS idx_staffy_created_at ON staffy(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staffy_processed ON staffy(is_processed);

CREATE INDEX IF NOT EXISTS idx_mutuelle_created_at ON mutuelle(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mutuelle_processed ON mutuelle(is_processed);

CREATE INDEX IF NOT EXISTS idx_timeone_created_at ON timeone(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeone_processed ON timeone(is_processed);

CREATE INDEX IF NOT EXISTS idx_sercure_created_at ON sercure(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sercure_processed ON sercure(is_processed);

-- Fonction et triggers pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers avec la nouvelle colonne
CREATE TRIGGER update_staffy_updated_at BEFORE UPDATE ON staffy 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mutuelle_updated_at BEFORE UPDATE ON mutuelle 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_timeone_updated_at BEFORE UPDATE ON timeone 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sercure_updated_at BEFORE UPDATE ON sercure 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS et permissions
ALTER TABLE staffy ENABLE ROW LEVEL SECURITY;
ALTER TABLE mutuelle ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeone ENABLE ROW LEVEL SECURITY;
ALTER TABLE sercure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations on staffy" ON staffy FOR ALL USING (true);
CREATE POLICY "Enable all operations on mutuelle" ON mutuelle FOR ALL USING (true);
CREATE POLICY "Enable all operations on timeone" ON timeone FOR ALL USING (true);
CREATE POLICY "Enable all operations on sercure" ON sercure FOR ALL USING (true);
