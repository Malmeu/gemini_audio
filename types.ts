export interface Criterion {
  id: string;
  title: string;
  summary: string;
  content: string;
}

export interface TranscriptionTurn {
  speaker: 'user' | 'model';
  text: string;
}
