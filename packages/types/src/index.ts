export type EventType =
  | 'PLAY'
  | 'PAUSE'
  | 'PROGRESS'
  | 'EXIT'
  | 'SEEK_FORWARD'
  | 'SEEK_BACKWARD'
  | 'REPLAY'
  | 'VOLUME_CHANGE'
  | 'TAB_HIDDEN'
  | 'TAB_VISIBLE'
  | 'COMPLETE';

export interface ViewerEvent {
  event_id: string;
  screening_id: string;
  session_id: string;
  anonymous_viewer_id: string;
  video_id: string;
  event_type: EventType;
  video_timecode_sec: number;
  client_timestamp: string;
  server_timestamp?: string;
}

export interface Screening {
  id: string;
  title: string;
  description?: string;
  media_url?: string;
  media_duration?: number;
  created_at?: string;
  updated_at?: string;
}

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AnomalyDomain =
  | 'RETENTION'
  | 'COGNITIVE'
  | 'EMOTIONAL'
  | 'PACING'
  | 'PERCEPTUAL'
  | 'PSYCHOLOGICAL';

export interface TrajectorySignals {
  unique_exposed: number;
  unique_permanent_exits: number;
  unique_replayed_and_continued: number;
  unique_replayed: number;
  unique_paused: number;
  unique_continued: number;
  unique_completed: number;
  permanent_exit_rate: number;
  continuation_rate: number;
}

export interface Anomaly {
  anomaly_id: string;
  screening_id: string;
  start_time_sec: number;
  end_time_sec?: number;
  peak_time_sec?: number;
  window_duration_sec?: number;
  title: string;
  domain: AnomalyDomain;
  severity: Severity;
  confidence_score?: number;
  evidence: string[];
  signals?: Record<string, number>;
  trajectory_signals?: TrajectorySignals;
}

export interface EditCue {
  id: string;
  anomaly_id: string;
  timecode_start: string;
  timecode_end: string;
  time_start_sec: number;
  time_end_sec: number;
  peak_sec: number;
  category: 'TRIM_PACING' | 'SCENE_CUT' | 'NARRATIVE_BROLL' | 'AUDIO_DUCKING';
  category_label: string;
  editing_action: string;
  editorial_tip: string;
  rationale: string;
  retention_recovery_pct: string;
  severity: Severity;
  evidence: string[];
  extracted_frames?: string[];
  elaborated_report?: string;
  markedForEdl: boolean;
}

export interface SavedInvestigation {
  investigation_id: string;
  anomaly_id: string;
  screening_id: string;
  investigation_report: string;
  elaborated_report?: string;
  extracted_frames?: string[];
  created_at?: string;
}

export interface AudienceOverview {
  screening_id: string;
  unique_viewers: number;
  real_viewers: number;
  synthetic_viewers: number;
  total_events: number;
  unique_sessions: number;
  completion_rate: number;
}

