// Types pour les tables Supabase
export interface Database {
    public: {
        Tables: {
            transcriptions: {
                Row: {
                    id: string;
                    title: string;
                    content: string;
                    audio_file_name?: string;
                    duration?: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    title: string;
                    content: string;
                    audio_file_name?: string;
                    duration?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    title?: string;
                    content?: string;
                    audio_file_name?: string;
                    duration?: number;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            analyses: {
                Row: {
                    id: string;
                    transcription_id: string;
                    content: string;
                    score_global?: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    transcription_id: string;
                    content: string;
                    score_global?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    transcription_id?: string;
                    content?: string;
                    score_global?: number;
                    created_at?: string;
                    updated_at?: string;
                };
            };
        };
    };
}

// Types pour les enregistrements
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
    transcription_id: string;
    content: string;
    score_global?: number;
    created_at?: string;
    updated_at?: string;
}

export interface SavedSession {
    transcription: TranscriptionRecord;
    analysis?: AnalysisRecord;
}
