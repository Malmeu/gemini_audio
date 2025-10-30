-- Ajout de la colonne is_processed dans toutes les tables

-- 1. Ajouter la colonne dans staffy
ALTER TABLE staffy 
ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT false;

-- 2. Ajouter la colonne dans mutuelle
ALTER TABLE mutuelle 
ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT false;

-- 3. Ajouter la colonne dans timeone
ALTER TABLE timeone 
ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT false;

-- 4. Ajouter la colonne dans sercure
ALTER TABLE sercure 
ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT false;

-- Vérification des colonnes ajoutées
SELECT 
    'staffy' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'staffy' AND column_name = 'is_processed'

UNION ALL

SELECT 
    'mutuelle' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'mutuelle' AND column_name = 'is_processed'

UNION ALL

SELECT 
    'timeone' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'timeone' AND column_name = 'is_processed'

UNION ALL

SELECT 
    'sercure' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sercure' AND column_name = 'is_processed';
