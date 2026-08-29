export interface Screening {
  id: string;
  title: string;
  description?: string;
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export type ViewerEventType = 'attention_loss' | 'high_emotion' | 'confusion' | 'scrub' | 'pause';

export interface ViewerEvent {
  id: string;
  screeningId: string;
  timestamp: number; // in seconds within the film
  eventType: ViewerEventType;
  value: number; // intensity or score
  userId: string;
}

export type SeverityType = 'low' | 'medium' | 'high' | 'critical';

export interface Finding {
  id: string;
  screeningId: string;
  title: string;
  description: string;
  severity: SeverityType;
  timestampStart: number;
  timestampEnd: number;
  evidenceIds: string[];
  recommendationIds: string[];
  createdAt: string;
}

export type EvidenceType = 'video_frame' | 'audio_waveform' | 'script_line' | 'attention_graph';

export interface Evidence {
  id: string;
  findingId: string;
  type: EvidenceType;
  description: string;
  mediaUrl?: string; // pointer to video frame, wave, etc.
  scriptQuote?: string; // relevant script snippet
}

export type RecommendationStatus = 'pending' | 'approved' | 'rejected' | 'implemented';
export type RecommendationAction = 'cut' | 'swap' | 'trim' | 'insert_b_roll' | 'audio_mix_adjust';

export interface EditRecommendation {
  id: string;
  findingId: string;
  action: RecommendationAction;
  instruction: string;
  status: RecommendationStatus;
  timestampStart: number;
  timestampEnd: number;
  createdAt: string;
}

export interface MediaSegment {
  id: string;
  screeningId: string;
  videoUrl: string;
  audioUrl?: string;
  startFrame: number;
  endFrame: number;
  fps: number;
}

export interface ScriptSegment {
  id: string;
  screeningId: string;
  sceneNumber: string;
  pageNumber: number;
  characterName?: string;
  dialogueText?: string;
  actionText?: string;
}
