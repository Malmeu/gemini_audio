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

// Types pour la base de données
export interface Database {
    public: {
        Tables: {
            staffy: {
                Row: {
                    id: string;
                    title: string;
                    nom: string;
                    transcriptions: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    title: string;
                    nom: string;
                    transcriptions: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    title?: string;
                    nom?: string;
                    transcriptions?: string;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            mutuelle: {
                Row: {
                    id: string;
                    title: string;
                    nom: string;
                    transcriptions: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    title: string;
                    nom: string;
                    transcriptions: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    title?: string;
                    nom?: string;
                    transcriptions?: string;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            timeone: {
                Row: {
                    id: string;
                    title: string;
                    nom: string;
                    transcriptions: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    title: string;
                    nom: string;
                    transcriptions: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    title?: string;
                    nom?: string;
                    transcriptions?: string;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            sercure: {
                Row: {
                    id: string;
                    title: string;
                    nom: string;
                    transcriptions: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    title: string;
                    nom: string;
                    transcriptions: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    title?: string;
                    nom?: string;
                    transcriptions?: string;
                    created_at?: string;
                    updated_at?: string;
                };
            };
        };
    };
}

export const TABLE_NAMES: Record<TableName, string> = {
    staffy: 'Staffy',
    mutuelle: 'Mutuelle',
    timeone: 'TimeOne',
    sercure: 'Sercure'
};

export const getTableDisplayName = (tableName: TableName): string => {
    return TABLE_NAMES[tableName];
};
