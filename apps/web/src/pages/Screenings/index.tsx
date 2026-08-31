import { useEffect, useState } from 'react';
import {
  Plus, Film, Link as LinkIcon, BarChart2, X, ClipboardCheck,
  Clock, AlertTriangle, Trash2, TrendingDown, Zap, Eye,
  Activity, ChevronDown, ChevronRight, FlaskConical, Users,
  CircleDot, BarChart, RotateCcw, History, CheckCircle2, ExternalLink, MessageSquare
} from 'lucide-react';

interface Screening {
  screening_id: string;
  media_id: string;
  title: string;
  description: string | null;
  media_filename: string;
  media_duration: number;
  created_at: string;
  status: string;
  public_token: string;
  share_url: string;
}

interface Reliability {
  status: 'INSUFFICIENT_DATA' | 'PRELIMINARY_SIGNAL' | 'STRONG_SIGNAL';
  label: string;
}

interface Overview {
  screening_id: string;
  unique_viewers: number;
  real_viewers?: number;
  synthetic_viewers?: number;
  unique_sessions: number;
  total_events: number;
  completed_sessions: number;
  completion_rate: number | null;
  reliability: Reliability;
}

interface RetentionPoint {
  time_sec: number;
  viewers: number;
  retention_rate: number;
}

interface RetentionData {
  curve: RetentionPoint[];
  total_starters: number;
  bucket_sec: number;
}

interface SignalBucket {
  time_sec: number;
  sessions_active: number;
  pauses: number;
  rewinds: number;
  skips: number;
  replays: number;
  exits: number;
  completions: number;
  pause_rate: number;
  rewind_rate: number;
  skip_rate: number;
  replay_rate: number;
  exit_rate: number;
}

interface AnomalySignals {
  [key: string]: number;
}

interface Anomaly {
  anomaly_id: string;
  screening_id: string;
  start_time_sec: number;
  end_time_sec: number;
  peak_time_sec?: number;
  window_duration_sec?: number;
  title?: string;
  domain?: 'COGNITIVE' | 'PSYCHOLOGICAL' | 'PACING' | 'PERCEPTUAL' | 'EMOTIONAL' | 'RETENTION';
  type: 'BEHAVIORAL_ANOMALY' | 'EXCEPTIONAL_ENGAGEMENT';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  signals: AnomalySignals;
  evidence: string[];
}

interface AnomalyData {
  unique_viewers: number;
  reliability: Reliability;
  anomalies: Anomaly[];
  exceptional_engagement: Anomaly[];
  baseline_methodology: string;
}

interface CommentInfo {
  comment_id: string;
  screening_id: string;
  viewer_id: string;
  display_name: string;
  video_timecode_sec: number;
  content: string;
  created_at: string;
  updated_at: string;
}

type AITab = 'overview' | 'retention' | 'signals' | 'anomalies' | 'feedback';

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function RetentionChart({ data }: { data: RetentionData }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const W = 560, H = 220;
  const PAD = { top: 20, right: 24, bottom: 40, left: 48 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const curve = data.curve.filter(p => p.time_sec >= 0);

  if (curve.length === 0) return <div className="text-xs text-muted-foreground italic text-center py-8">No retention telemetry recorded yet.</div>;

  const maxT = curve[curve.length - 1].time_sec || 1;
  const xS = (t: number) => (t / maxT) * plotW;
  const yS = (r: number) => plotH - r * plotH;

  const points = curve.map(p => ({ x: xS(p.time_sec), y: yS(p.retention_rate), point: p }));

  const getSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) * 0.45;
      const cp1y = p0.y;
      const cp2x = p1.x - (p1.x - p0.x) * 0.45;
      const cp2y = p1.y;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
  };

  const smoothLinePath = getSmoothPath(points);
  const fillPath = `${smoothLinePath} L ${plotW.toFixed(1)} ${plotH.toFixed(1)} L 0 ${plotH.toFixed(1)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];
  const xTicks = Array.from({ length: 6 }, (_, i) => Math.round((maxT / 5) * i));

  const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative w-full group/ret">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto overflow-visible select-none"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="ret-fill-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#0284c7" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0.0" />
          </linearGradient>
          <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${PAD.left}, ${PAD.top})`}>
          {yTicks.map(t => (
            <line
              key={t}
              x1={0}
              y1={yS(t).toFixed(1)}
              x2={plotW}
              y2={yS(t).toFixed(1)}
              stroke="#ffffff12"
              strokeDasharray={t === 0 ? 'none' : '3 3'}
              strokeWidth="1"
            />
          ))}

          <path d={fillPath} fill="url(#ret-fill-grad)" />

          <path
            d={smoothLinePath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#neon-glow)"
          />

          {yTicks.map(t => (
            <text
              key={t}
              x={-10}
              y={yS(t) + 3}
              textAnchor="end"
              fontSize="9"
              className="fill-muted-foreground font-mono font-medium"
            >
              {Math.round(t * 100)}%
            </text>
          ))}

          {xTicks.map(t => (
            <text
              key={t}
              x={xS(t)}
              y={plotH + 20}
              textAnchor="middle"
              fontSize="9"
              className="fill-muted-foreground font-mono font-medium"
            >
              {fmtTime(t)}
            </text>
          ))}

          <line x1={0} y1={0} x2={0} y2={plotH} stroke="#ffffff20" strokeWidth="1" />
          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="#ffffff20" strokeWidth="1" />

          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1={0}
                x2={hoveredPoint.x}
                y2={plotH}
                stroke="#38bdf8"
                strokeWidth="1"
                strokeDasharray="4 4"
                className="opacity-80"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="5"
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth="2"
                className="drop-shadow-lg"
              />
            </g>
          )}

          {points.map((pt, idx) => {
            const colW = plotW / Math.max(1, points.length);
            return (
              <rect
                key={idx}
                x={pt.x - colW / 2}
                y={0}
                width={colW}
                height={plotH}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(idx)}
              />
            );
          })}
        </g>
      </svg>

      {hoveredPoint && (
        <div
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-studio-950/95 border border-sky-500/30 rounded-lg p-2.5 shadow-2xl backdrop-blur-md space-y-1 font-mono text-[11px]"
          style={{
            left: `${PAD.left + hoveredPoint.x}px`,
            top: `${PAD.top + hoveredPoint.y - 12}px`,
          }}
        >
          <div className="flex items-center justify-between gap-3 text-muted-foreground border-b border-white/10 pb-1 text-[10px]">
            <span>Time: <strong className="text-foreground">{fmtTime(hoveredPoint.point.time_sec)}</strong></span>
            <span className="text-sky-400 font-semibold">{fmtPct(hoveredPoint.point.retention_rate)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-foreground font-semibold pt-0.5">
            <span className="text-[10px] text-muted-foreground font-normal">Active Viewers:</span>
            <span className="text-sky-300">{hoveredPoint.point.viewers.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

type SignalKey = 'exit_rate' | 'rewind_rate' | 'pause_rate' | 'skip_rate' | 'replay_rate';
const SIGNAL_ROWS: { key: SignalKey; label: string; color: string }[] = [
  { key: 'exit_rate',   label: 'Exit',   color: '#ef4444' },
  { key: 'rewind_rate', label: 'Rewind', color: '#f97316' },
  { key: 'pause_rate',  label: 'Pause',  color: '#eab308' },
  { key: 'skip_rate',   label: 'Skip',   color: '#a78bfa' },
  { key: 'replay_rate', label: 'Replay', color: '#22c55e' },
];

function SignalHeatmap({ signals }: { signals: SignalBucket[] }) {
  if (!signals.length) return <div className="text-xs text-muted-foreground italic text-center py-6">No signal data.</div>;
  const maxes: Record<SignalKey, number> = {} as Record<SignalKey, number>;
  for (const row of SIGNAL_ROWS) maxes[row.key] = Math.max(...signals.map(s => s[row.key]), 0.001);

  return (
    <div className="space-y-3 w-full pt-1">
      {SIGNAL_ROWS.map(row => (
        <div key={row.key} className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground w-14 shrink-0 text-right">{row.label}</span>
          <div className="flex-1 flex gap-1 h-9 bg-studio-900/60 border border-white/5 rounded-md p-1 items-end">
            {signals.map(s => {
              const val = s[row.key];
              const intensity = val / maxes[row.key];
              const hasValue = val > 0;
              const fillPct = hasValue ? Math.max(12, Math.round(intensity * 100)) : 4;
              const opacity = hasValue ? Math.max(0.35, intensity) : 0.12;

              return (
                <div
                  key={s.time_sec}
                  title={`${fmtTime(s.time_sec)} – ${row.label}: ${fmtPct(val)}`}
                  className="flex-1 h-full flex items-end justify-center group/bar relative cursor-pointer"
                >
                  <div
                    className="w-full rounded-t-sm transition-all duration-200 group-hover/bar:brightness-125"
                    style={{
                      height: `${fillPct}%`,
                      backgroundColor: row.color,
                      opacity: opacity,
                      boxShadow: hasValue && intensity > 0.4 ? `0 -2px 8px ${row.color}55` : 'none',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <span className="w-14 shrink-0" />
        <div className="flex-1 flex justify-between text-[10px] text-muted-foreground font-mono px-1">
          {signals.map((s, i) => {
            const step = Math.max(1, Math.floor(signals.length / 8));
            if (i % step === 0 || i === signals.length - 1) {
              return <span key={s.time_sec}>{fmtTime(s.time_sec)}</span>;
            }
            return <span key={s.time_sec} className="opacity-0">{fmtTime(s.time_sec)}</span>;
          })}
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const s = { HIGH: 'bg-rose-500/15 text-rose-400 border-rose-500/30', MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/30', LOW: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
  return <span className={`text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded ${s[severity]}`}>{severity}</span>;
}

function ReliabilityBadge({ reliability }: { reliability: Reliability }) {
  const s = { INSUFFICIENT_DATA: 'bg-rose-500/10 text-rose-400 border-rose-500/20', PRELIMINARY_SIGNAL: 'bg-amber-500/10 text-amber-400 border-amber-500/20', STRONG_SIGNAL: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  return (
    <div className={`flex items-center gap-1.5 text-[10px] border px-2.5 py-1 rounded-full w-fit ${s[reliability.status]}`}>
      <CircleDot className="h-3 w-3" /><span>{reliability.label}</span>
    </div>
  );
}

function AnomalyCard({ anomaly, isEngagement = false }: { anomaly: Anomaly; isEngagement?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const border = isEngagement ? 'border-emerald-500/25 hover:border-emerald-500/50'
    : anomaly.severity === 'HIGH' ? 'border-rose-500/25 hover:border-rose-500/50'
    : anomaly.severity === 'MEDIUM' ? 'border-amber-500/25 hover:border-amber-500/50' : 'border-blue-500/25 hover:border-blue-500/50';
  const Icon = isEngagement ? Zap : TrendingDown;
  const ic = isEngagement ? 'text-emerald-400' : 'text-rose-400';

  const peakSec = anomaly.peak_time_sec !== undefined ? anomaly.peak_time_sec : anomaly.start_time_sec;
  const windowDur = anomaly.window_duration_sec !== undefined ? anomaly.window_duration_sec : (anomaly.end_time_sec - anomaly.start_time_sec);
  const cardTitle = anomaly.title || (isEngagement ? 'Emotional Scene Replay Hotspot' : 'Behavioral Anomaly');

  const domain = anomaly.domain || (isEngagement ? 'EMOTIONAL' : 'COGNITIVE');
  const domainCls = 
    domain === 'COGNITIVE' ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' :
    domain === 'PSYCHOLOGICAL' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' :
    domain === 'PACING' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
    domain === 'PERCEPTUAL' ? 'bg-sky-500/10 text-sky-300 border-sky-500/30' :
    domain === 'EMOTIONAL' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
    'bg-rose-500/10 text-rose-300 border-rose-500/30';

  return (
    <div className={`border rounded-lg overflow-hidden cursor-pointer ${border} bg-studio-900/30 transition-all`} onClick={() => setExpanded(e => !e)}>
      <div className="flex items-center gap-3 px-4 py-3">
        <Icon className={`h-4 w-4 shrink-0 ${ic}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-foreground">{fmtTime(anomaly.start_time_sec)} &ndash; {fmtTime(anomaly.end_time_sec)}</span>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-studio-950/90 border border-cyan-500/30 text-cyan-300">
              {windowDur}s window &middot; Peak at {fmtTime(peakSec)}
            </span>
            <SeverityBadge severity={anomaly.severity} />
            <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded border uppercase tracking-wider ${domainCls}`}>
              {domain}
            </span>
            <span className="text-[11px] font-semibold text-sky-200">{cardTitle}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 truncate">{anomaly.evidence[0]}</p>
        </div>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </div>
      {expanded && (
        <div className="border-t border-white/5 px-4 py-3 space-y-3 bg-studio-950/40">
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Observed Micro-Burst Evidence</div>
            {anomaly.evidence.map((ev, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground/90 font-mono">
                <span className="text-sky-400 mt-0.5">&bull;</span><span>{ev}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(anomaly.signals).filter(([k]) => !k.startsWith('baseline_') && !k.endsWith('_ratio')).map(([key, val]) => {
              const ratio = anomaly.signals[`${key}_ratio`], base = anomaly.signals[`baseline_${key}`];
              return (
                <div key={key} className="bg-studio-900 border rounded p-2 space-y-0.5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{key.replace(/_/g, ' ')}</div>
                  <div className="text-sm font-bold text-foreground">{fmtPct(val as number)}</div>
                  {base !== undefined && (
                    <div className="text-[10px] text-muted-foreground">
                      Baseline: {fmtPct(base as number)}
                      {ratio !== undefined && <span className="ml-1 font-semibold text-amber-400">{(ratio as number).toFixed(1)}x</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Screenings() {
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [screeningToDelete, setScreeningToDelete] = useState<Screening | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [aiScreening, setAiScreening] = useState<Screening | null>(null);
  const [aiTab, setAiTab] = useState<AITab>('overview');
  const [aiOverview, setAiOverview] = useState<Overview | null>(null);
  const [aiRetention, setAiRetention] = useState<RetentionData | null>(null);
  const [aiSignals, setAiSignals] = useState<SignalBucket[] | null>(null);
  const [aiAnomalies, setAiAnomalies] = useState<AnomalyData | null>(null);
  const [aiComments, setAiComments] = useState<CommentInfo[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [simViewers, setSimViewers] = useState(1000);
  const [simMode, setSimMode] = useState('AUTO');
  const [simVariation, setSimVariation] = useState('MEDIUM');
  const [simInjectGroundTruth, setSimInjectGroundTruth] = useState(false);
  const [simSeed, setSimSeed] = useState('');
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [simError, setSimError] = useState<string | null>(null);
interface ToastNotification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resettingAudience, setResettingAudience] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastNotification | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast(prev => (prev?.id === id ? null : prev));
    }, 4500);
  };

  const fetchScreenings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/screenings');
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Failed to load screenings.'); }
      setScreenings(await res.json()); setError(null);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleDeleteScreening = async () => {
    if (!screeningToDelete || deleteConfirmText !== 'DELETE') return;
    try {
      setDeletingId(screeningToDelete.screening_id);
      const res = await fetch(`/api/v1/screenings/${screeningToDelete.screening_id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Failed to delete'); }
      setScreenings(prev => prev.filter(s => s.screening_id !== screeningToDelete.screening_id));
      setScreeningToDelete(null);
      setDeleteConfirmText('');
      triggerToast('Screening room deleted successfully.', 'info');
    } catch (err: any) { triggerToast(err.message, 'error'); } finally { setDeletingId(null); }
  };

  useEffect(() => { fetchScreenings(); }, []);

  const loadAIData = async (sid: string) => {
    const [ovR, retR, sigR, anmR, cmtR] = await Promise.all([
      fetch(`/api/v1/screenings/${sid}/audience/overview`),
      fetch(`/api/v1/screenings/${sid}/audience/retention`),
      fetch(`/api/v1/screenings/${sid}/audience/signals`),
      fetch(`/api/v1/screenings/${sid}/audience/anomalies`),
      fetch(`/api/v1/screenings/${sid}/comments`),
    ]);
    if (ovR.ok) setAiOverview(await ovR.json());
    if (retR.ok) setAiRetention(await retR.json());
    if (sigR.ok) { const d = await sigR.json(); setAiSignals(d.signals); }
    if (anmR.ok) setAiAnomalies(await anmR.json());
    if (cmtR.ok) setAiComments(await cmtR.json());
  };

  const handleAdminDeleteComment = async (commentId: string) => {
    if (!aiScreening) return;
    try {
      const res = await fetch(`/api/v1/screenings/comments/${commentId}?is_admin=true`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setAiComments(prev => (prev ? prev.filter((c: CommentInfo) => c.comment_id !== commentId) : null));
        triggerToast('Viewer comment deleted by admin.', 'info');
      }
    } catch (e: any) {
      triggerToast('Failed to delete comment.', 'error');
    }
  };

  const openAI = async (s: Screening, defaultTab: AITab = 'overview') => {
    setAiScreening(s); setAiTab(defaultTab);
    setAiOverview(null); setAiRetention(null); setAiSignals(null); setAiAnomalies(null); setAiComments(null);
    setAiError(null); setSimResult(null); setSimError(null); setAiLoading(true);
    try { await loadAIData(s.screening_id); } catch (e: any) { setAiError(e.message); } finally { setAiLoading(false); }
  };

  const runSimulation = async () => {
    if (!aiScreening) return;
    setSimRunning(true); setSimResult(null); setSimError(null);
    try {
      const url = `/api/v1/screenings/${aiScreening.screening_id}/dev/simulate?num_viewers=${simViewers}&mode=${simMode}&variation=${simVariation}&inject_ground_truth=${simInjectGroundTruth}${simSeed ? `&seed=${simSeed}` : ''}`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Simulation failed');
      setSimResult(data);
      await loadAIData(aiScreening.screening_id);
    } catch (e: any) { setSimError(e.message); } finally { setSimRunning(false); }
  };

  const handleResetAudience = async () => {
    if (!aiScreening || resetConfirmText !== 'RESET') return;
    setResettingAudience(true);
    try {
      const res = await fetch(`/api/v1/screenings/${aiScreening.screening_id}/audience`, { method: 'DELETE' });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || 'Failed to reset audience telemetry.');
      }
      setSimResult(null);
      setShowResetConfirmModal(false);
      setResetConfirmText('');
      await loadAIData(aiScreening.screening_id);
      triggerToast('All audience telemetry reset successfully.', 'success');
    } catch (err: any) {
      triggerToast(err.message, 'error');
    } finally {
      setResettingAudience(false);
    }
  };

  const handleRollbackAudience = async () => {
    if (!aiScreening) return;
    setRollingBack(true);
    try {
      const res = await fetch(`/api/v1/screenings/${aiScreening.screening_id}/audience/rollback`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to roll back latest run.');
      setSimResult(null);
      setShowResetConfirmModal(false);
      setResetConfirmText('');
      await loadAIData(aiScreening.screening_id);
      triggerToast(data.message || 'Latest run rolled back successfully.', 'info');
    } catch (err: any) {
      triggerToast(err.message, 'error');
    } finally {
      setRollingBack(false);
    }
  };

  const getVideoDuration = (file: File): Promise<number> =>
    new Promise(resolve => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => { window.URL.revokeObjectURL(v.src); resolve(v.duration); };
      v.onerror = () => resolve(0);
      v.src = URL.createObjectURL(file);
    });

  const uploadMediaWithProgress = (file: File): Promise<any> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const fd = new FormData();
      fd.append('file', file);
      xhr.open('POST', '/api/v1/screenings/upload');
      xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded * 100) / ev.total)); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('Parse error')); }
        } else {
          try { reject(new Error(JSON.parse(xhr.responseText).detail || 'Upload failed')); } catch { reject(new Error(`Upload failed: ${xhr.status}`)); }
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(fd);
    });

  const handleCreateScreening = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !title) return;
    try {
      setUploadProgress(0); setUploadStatus('Ingesting video metadata...');
      const duration = await getVideoDuration(selectedFile);
      setUploadStatus('Uploading media cut...');
      const { media_filename } = await uploadMediaWithProgress(selectedFile);
      setUploadStatus('Finalizing screening room...');
      const r = await fetch('/api/v1/screenings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, media_filename, media_duration: duration }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || 'Failed'); }
      setUploadProgress(null); setUploadStatus(''); setTitle(''); setDescription('');
      setSelectedFile(null); setShowCreateModal(false); fetchScreenings();
    } catch (err: any) { setUploadProgress(null); setUploadStatus(''); alert(err.message); }
  };

  const handleCopyLink = (tok: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/screening/${tok}`)
      .then(() => { setCopiedToken(tok); setTimeout(() => setCopiedToken(null), 2000); })
      .catch(() => alert(`Link: ${window.location.origin}/screening/${tok}`));
  };

  const totalAnm = (aiAnomalies?.anomalies.length ?? 0) + (aiAnomalies?.exceptional_engagement.length ?? 0);

  const tabContent = () => {
    if (aiLoading) return (
      <div className="flex flex-col items-center justify-center py-14 gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-xs text-muted-foreground">Querying ClickHouse analytics...</p>
      </div>
    );
    if (aiError) return <div className="text-xs text-rose-500 bg-rose-500/5 p-4 border border-rose-500/20 rounded">{aiError}</div>;

    if (aiTab === 'overview') return (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {aiOverview?.reliability && <ReliabilityBadge reliability={aiOverview.reliability} />}
          {simResult && (
            <div className="flex items-center gap-2 text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1 rounded-full font-mono font-semibold">
              <FlaskConical className="h-3 w-3" />
              <span>SIMULATION MODE: {simResult.simulation_mode}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="p-4 bg-studio-900 border rounded-lg space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              <Users className="h-3 w-3" />Unique Viewers
            </div>
            <div className="text-xl font-bold text-foreground">
              {aiOverview?.unique_viewers != null ? aiOverview.unique_viewers.toLocaleString() : '—'}
            </div>
            {aiOverview && (
              <div className="text-[10px] font-mono text-muted-foreground">
                {(aiOverview.synthetic_viewers ?? 0) > 0 ? (
                  <span className="text-amber-400 font-medium">
                    {aiOverview.real_viewers?.toLocaleString()} real &middot; {aiOverview.synthetic_viewers?.toLocaleString()} synthetic
                  </span>
                ) : (
                  <span className="text-emerald-400 font-medium">100% Real Audience</span>
                )}
              </div>
            )}
          </div>

          {[
            { label: 'Sessions',        val: aiOverview?.unique_sessions?.toLocaleString() ?? '—',                    Icon: Activity },
            { label: 'Total Events',    val: aiOverview?.total_events?.toLocaleString() ?? '—',                       Icon: BarChart },
            { label: 'Completions',     val: aiOverview?.completed_sessions?.toLocaleString() ?? '—',                 Icon: CircleDot },
            { label: 'Completion Rate', val: aiOverview?.completion_rate != null ? fmtPct(aiOverview.completion_rate) : '—', Icon: TrendingDown },
            { label: 'Anomalies Found', val: totalAnm,                                                                Icon: AlertTriangle },
          ].map(({ label, val, Icon }) => (
            <div key={label} className="p-4 bg-studio-900 border rounded-lg space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                <Icon className="h-3 w-3" />{label}
              </div>
              <div className="text-xl font-bold text-foreground">{val}</div>
            </div>
          ))}
        </div>

        {simResult && (
          <div className="bg-amber-500/[0.04] border border-amber-500/20 rounded-lg p-3 text-[11px] text-amber-300/90 leading-relaxed flex items-start gap-2.5">
            <FlaskConical className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-400">Real-Anchored Simulation Active: </span>
              {simResult.simulation_mode === 'REAL_ANCHORED' && `Behavioral fingerprint derived from ${simResult.real_viewers_analyzed} real viewer(s) with ${simResult.variation_strength.toLowerCase()} controlled variation.`}
              {simResult.simulation_mode === 'HYBRID' && `Blended fingerprint derived from ${simResult.real_viewers_analyzed} real viewer(s) and generic priors.`}
              {simResult.simulation_mode === 'COLD_START' && `Cold-start synthetic model (0 real viewers).`}
            </div>
          </div>
        )}

        {aiAnomalies && totalAnm > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Top Findings</div>
            {[...aiAnomalies.anomalies.slice(0, 2), ...aiAnomalies.exceptional_engagement.slice(0, 1)].map(a => (
              <AnomalyCard key={a.anomaly_id} anomaly={a} isEngagement={a.type === 'EXCEPTIONAL_ENGAGEMENT'} />
            ))}
          </div>
        )}
      </div>
    );

    if (aiTab === 'retention') return (
      <div className="space-y-4">
        {aiOverview?.reliability && <ReliabilityBadge reliability={aiOverview.reliability} />}
        <div className="text-[10px] text-muted-foreground">% of viewers remaining at each point. Based on maximum watched timecode per viewer.</div>
        {aiRetention ? <RetentionChart data={aiRetention} /> : <div className="text-xs text-muted-foreground italic text-center py-6">No retention data yet.</div>}
        {aiRetention && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-studio-900 border rounded-lg text-center"><div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Starters</div><div className="text-lg font-bold">{aiRetention.total_starters}</div></div>
            <div className="p-3 bg-studio-900 border rounded-lg text-center"><div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">50% Reached</div><div className="text-lg font-bold">{(() => { const h = aiRetention.curve.find(p => p.retention_rate <= 0.5); return h ? fmtTime(h.time_sec) : '—'; })()}</div></div>
            <div className="p-3 bg-studio-900 border rounded-lg text-center"><div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Final Retention</div><div className="text-lg font-bold">{aiRetention.curve.length > 0 ? fmtPct(aiRetention.curve[aiRetention.curve.length - 1].retention_rate) : '—'}</div></div>
          </div>
        )}
      </div>
    );

    if (aiTab === 'signals') return (
      <div className="space-y-4">
        {aiOverview?.reliability && <ReliabilityBadge reliability={aiOverview.reliability} />}
        <div className="text-[10px] text-muted-foreground">Intensity heatmap across the timeline. Darker = higher rate relative to max observed. Hover for details.</div>
        {aiSignals && aiSignals.length > 0 ? <SignalHeatmap signals={aiSignals} /> : <div className="text-xs text-muted-foreground italic text-center py-6">No signal data yet.</div>}
        <div className="flex flex-wrap gap-3">
          {SIGNAL_ROWS.map(r => (
            <div key={r.key} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: r.color }} />
              <span className="text-[10px] text-muted-foreground">{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    );

    if (aiTab === 'anomalies') return (
      <div className="space-y-4">
        {aiAnomalies?.reliability && <ReliabilityBadge reliability={aiAnomalies.reliability} />}
        {!aiAnomalies || totalAnm === 0 ? (
          <div className="text-xs text-muted-foreground italic bg-studio-900 p-6 border rounded text-center">No statistically significant behavioral anomalies detected.</div>
        ) : (
          <div className="space-y-4">
            {aiAnomalies.exceptional_engagement.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-emerald-400" /><span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Exceptional Engagement ({aiAnomalies.exceptional_engagement.length})</span></div>
                {aiAnomalies.exceptional_engagement.map(a => <AnomalyCard key={a.anomaly_id} anomaly={a} isEngagement />)}
              </div>
            )}
            {aiAnomalies.anomalies.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-rose-400" /><span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">Behavioral Anomalies ({aiAnomalies.anomalies.length})</span></div>
                {aiAnomalies.anomalies.map(a => <AnomalyCard key={a.anomaly_id} anomaly={a} />)}
              </div>
            )}
            {aiAnomalies.baseline_methodology && (
              <div className="text-[10px] text-muted-foreground bg-studio-900/40 border rounded p-3 leading-relaxed">
                <span className="font-semibold">Methodology: </span>{aiAnomalies.baseline_methodology}
              </div>
            )}
          </div>
        )}
      </div>
    );

    if (aiTab === 'feedback') return (
      <div className="space-y-4">
        {aiOverview?.reliability && <ReliabilityBadge reliability={aiOverview.reliability} />}
        <div className="text-[10px] text-muted-foreground">
          Audience feedback and timecode notes submitted by focus group viewers.
        </div>
        {!aiComments || aiComments.length === 0 ? (
          <div className="text-xs text-muted-foreground italic bg-studio-900 p-6 border rounded text-center">
            No audience feedback notes submitted for this screening cut yet.
          </div>
        ) : (
          <div className="space-y-3">
            {aiComments.map(cmt => (
              <div key={cmt.comment_id} className="bg-studio-900 border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{cmt.display_name}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-studio-950 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded">
                      <Clock className="h-3 w-3" />
                      <span>{fmtTime(cmt.video_timecode_sec)}</span>
                    </span>
                  </div>
                  <button
                    onClick={() => handleAdminDeleteComment(cmt.comment_id)}
                    className="flex items-center gap-1 text-[10px] text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:bg-rose-500/10 px-2.5 py-1 rounded transition-colors cursor-pointer"
                    title="Delete viewer comment"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete</span>
                  </button>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed font-sans">{cmt.content}</p>
                <div className="text-[9px] text-muted-foreground font-mono">
                  Submitted: {new Date(cmt.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Studio Screening Room Manager</h1>
          <p className="text-sm text-muted-foreground">Provision private screenings, upload cut sequences, and collect ClickHouse telemetry.</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded text-sm hover:bg-primary/95 transition-all shadow-md">
          <Plus className="h-4 w-4" /> Provision Screening
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : error ? (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 flex items-center gap-3 text-rose-500"><AlertTriangle className="h-5 w-5" /><span className="text-sm">{error}</span></div>
      ) : screenings.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-studio-900 flex items-center justify-center"><Film className="h-6 w-6 text-primary/80" /></div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="font-semibold text-sm">No screenings provisioned</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">Create a screening room, upload a video cut, and share the link to collect audience telemetry.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b bg-studio-950/50 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                <th className="p-4">Film Screening</th><th className="p-4">Duration</th><th className="p-4">Created</th><th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {screenings.map(s => (
                <tr key={s.screening_id} className="hover:bg-studio-900/10 transition-colors">
                  <td className="p-4 font-medium">
                    <a
                      href={`/screening/${s.public_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open Targeted Audience Screening Room"
                      className="group inline-flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer"
                    >
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{s.title}</span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 text-primary transition-opacity shrink-0" />
                    </a>
                    {s.description && <div className="text-xs text-muted-foreground mt-0.5 max-w-md truncate">{s.description}</div>}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /><span>{Math.floor(s.media_duration/60)}m {Math.round(s.media_duration%60)}s</span></div>
                  </td>
                  <td className="p-4 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-right space-x-2">
                    <button onClick={() => handleCopyLink(s.public_token)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border hover:text-foreground rounded px-3 py-1.5 transition-all">
                      {copiedToken === s.public_token ? (<><ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" /><span className="text-emerald-500">Copied!</span></>) : (<><LinkIcon className="h-3.5 w-3.5" /><span>Get Share Link</span></>)}
                    </button>
                    <button onClick={() => openAI(s, 'feedback')} className="inline-flex items-center gap-1.5 text-xs text-sky-400 border border-sky-500/20 hover:bg-sky-500/10 rounded px-3 py-1.5 transition-all">
                      <MessageSquare className="h-3.5 w-3.5" /><span>Feedback</span>
                    </button>
                    <button onClick={() => openAI(s)} className="inline-flex items-center gap-1.5 text-xs text-primary border border-primary/20 hover:bg-primary/10 rounded px-3 py-1.5 transition-all">
                      <Eye className="h-3.5 w-3.5" /><span>Audience Intelligence</span>
                    </button>
                    <button onClick={() => setScreeningToDelete(s)} className="inline-flex items-center gap-1.5 text-xs text-rose-500 border border-rose-500/20 hover:bg-rose-500/10 rounded px-3 py-1.5 transition-all">
                      <Trash2 className="h-3.5 w-3.5" /><span>Delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-studio-950 border rounded-xl shadow-2xl p-6 relative space-y-4">
            <button onClick={() => setShowCreateModal(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            <div><h2 className="text-sm font-semibold uppercase tracking-wider">Provision Screening Room</h2><p className="text-xs text-muted-foreground mt-0.5">Upload a video file under 150MB.</p></div>
            <form onSubmit={handleCreateScreening} className="space-y-4">
              <div className="space-y-1"><label className="text-xs text-muted-foreground">Film Title</label><input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Horizon Line - Fine Cut v2" className="w-full bg-studio-900 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" /></div>
              <div className="space-y-1"><label className="text-xs text-muted-foreground">Description (Optional)</label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Focus group notes..." rows={3} className="w-full bg-studio-900 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" /></div>
              <div className="space-y-1"><label className="text-xs text-muted-foreground">Upload Video Cut</label><input type="file" required accept="video/mp4,video/webm,video/quicktime" onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-studio-900 file:text-primary file:cursor-pointer hover:file:bg-studio-800" /></div>
              {uploadProgress !== null && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[10px] text-muted-foreground"><span className="animate-pulse">{uploadStatus}</span><span>{uploadProgress}%</span></div>
                  <div className="w-full bg-studio-900 h-1.5 rounded-full overflow-hidden border"><div className="bg-primary h-full transition-all duration-150" style={{ width: `${uploadProgress}%` }} /></div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 border rounded text-xs hover:bg-studio-900">Cancel</button>
                <button type="submit" disabled={uploadProgress !== null} className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded text-xs hover:bg-primary/95 disabled:opacity-50">Create Screening</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audience Intelligence Modal */}
      {aiScreening && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl bg-studio-950 border rounded-xl shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-start justify-between p-6 border-b shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider">Audience Intelligence</h2>
                </div>
                <a
                  href={`/screening/${aiScreening.public_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open Targeted Audience Screening Room"
                  className="group inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-0.5 cursor-pointer"
                >
                  <span>{aiScreening.title}</span>
                  <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
                </a>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowResetConfirmModal(true)}
                  title="Reset Audience Telemetry"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 rounded-md transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Data</span>
                </button>
                <button onClick={() => setAiScreening(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex border-b shrink-0 bg-studio-950">
              {([
                { key: 'overview' as AITab,  label: 'Overview',                                                Icon: BarChart2 },
                { key: 'retention' as AITab, label: 'Retention',                                              Icon: TrendingDown },
                { key: 'signals' as AITab,   label: 'Signal Map',                                             Icon: Activity },
                { key: 'anomalies' as AITab, label: `Anomalies${totalAnm > 0 ? ` (${totalAnm})` : ''}`,      Icon: AlertTriangle },
                { key: 'feedback' as AITab,  label: `Feedback${(aiComments?.length ?? 0) > 0 ? ` (${aiComments?.length})` : ''}`, Icon: MessageSquare },
              ]).map(({ key, label, Icon }) => (
                <button key={key} onClick={() => setAiTab(key)}
                  className={`flex items-center gap-1.5 px-5 py-3 text-xs font-medium border-b-2 transition-all ${aiTab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-6">{tabContent()}</div>
            <div className="border-t shrink-0">
              <details className="group">
                <summary className="flex items-center gap-2 px-6 py-3 cursor-pointer list-none hover:bg-studio-900/30 transition-colors">
                  <FlaskConical className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Developer Tool</span>
                  <span className="text-[10px] text-muted-foreground ml-1">Synthetic Audience Simulator</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-6 pb-5 pt-3 border-t border-amber-500/10 bg-amber-500/[0.03] space-y-4">
                  <p className="text-[10px] text-amber-400/70 leading-relaxed">
                    Generates real-anchored synthetic telemetry using the exact same ViewerEvent contract as real viewers.
                    <strong className="text-amber-400"> Developer & Demo tool only.</strong>
                  </p>
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Mode</label>
                      <select value={simMode} onChange={e => setSimMode(e.target.value)} className="bg-studio-900 border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500">
                        <option value="AUTO">Auto (Detect)</option>
                        <option value="REAL_ANCHORED">Real-Anchored (10+ Real)</option>
                        <option value="HYBRID">Hybrid (1-9 Real)</option>
                        <option value="COLD_START">Cold Start (0 Real)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Viewers</label>
                      <select value={simViewers} onChange={e => setSimViewers(Number(e.target.value))} className="bg-studio-900 border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500">
                        <option value={100}>100 viewers</option>
                        <option value={500}>500 viewers</option>
                        <option value={1000}>1,000 viewers</option>
                        <option value={5000}>5,000 viewers</option>
                        <option value={10000}>10,000 viewers</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Variation</label>
                      <select value={simVariation} onChange={e => setSimVariation(e.target.value)} className="bg-studio-900 border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500">
                        <option value="LOW">Low (5% Jitter)</option>
                        <option value="MEDIUM">Medium (15% Jitter)</option>
                        <option value="HIGH">High (25% Jitter)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Seed (optional)</label>
                      <input type="number" placeholder="e.g. 42" value={simSeed} onChange={e => setSimSeed(e.target.value)} className="w-24 bg-studio-900 border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500" />
                    </div>
                    <button onClick={runSimulation} disabled={simRunning} className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600/80 hover:bg-amber-600 text-white font-semibold rounded text-xs disabled:opacity-50">
                      {simRunning ? (<><div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /><span>Generating...</span></>) : (<><FlaskConical className="h-3.5 w-3.5" /><span>Run Simulation</span></>)}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="injectGT"
                      checked={simInjectGroundTruth}
                      onChange={e => setSimInjectGroundTruth(e.target.checked)}
                      className="rounded border-studio-700 bg-studio-900 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5"
                    />
                    <label htmlFor="injectGT" className="text-[10px] text-muted-foreground cursor-pointer">
                      Inject synthetic demo ground-truth windows (for stress/anomaly testing)
                    </label>
                  </div>
                  {simResult && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded p-3 text-[10px] text-emerald-400 space-y-0.5">
                      <div className="font-semibold">Simulation complete (Mode: {simResult.simulation_mode})</div>
                      <div>{simResult.num_viewers.toLocaleString()} viewers &middot; {simResult.total_events_generated.toLocaleString()} events generated</div>
                      <div className="text-muted-foreground">Fingerprint analyzed: {simResult.real_viewers_analyzed} real viewer(s)</div>
                    </div>
                  )}
                  {simError && <div className="bg-rose-500/5 border border-rose-500/20 rounded p-3 text-[10px] text-rose-400">{simError}</div>}
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {screeningToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-studio-950 border border-rose-500/20 rounded-xl shadow-2xl p-6 relative space-y-4">
            <button onClick={() => { setScreeningToDelete(null); setDeleteConfirmText(''); }} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-rose-500/10 text-rose-500 mt-1"><AlertTriangle className="h-6 w-6" /></div>
              <div><h2 className="text-sm font-semibold uppercase tracking-wider text-rose-500">Delete Screening Room?</h2><p className="text-xs text-muted-foreground mt-0.5">Permanently deletes <strong>{screeningToDelete.title}</strong>.</p></div>
            </div>
            <div className="bg-studio-900/50 rounded-lg p-3.5 border border-rose-500/10 text-xs text-rose-400 space-y-2">
              <p className="font-semibold">Permanently destroys:</p>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground"><li>Screening room and access links</li><li>Uploaded video file from disk</li><li>All ClickHouse telemetry records</li></ul>
            </div>
            <div className="space-y-1.5 pt-1 select-none">
              <label className="text-[11px] text-muted-foreground block select-none">
                Type <strong className="text-rose-400 font-mono select-none">DELETE</strong> to confirm deletion:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
                onPaste={e => e.preventDefault()}
                placeholder="DELETE"
                className="w-full bg-studio-900 border border-rose-500/20 rounded px-3 py-1.5 text-xs text-foreground font-mono uppercase focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <p className="text-xs text-muted-foreground italic">* This action cannot be undone.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setScreeningToDelete(null); setDeleteConfirmText(''); }} disabled={deletingId !== null} className="px-4 py-2 border rounded text-xs hover:bg-studio-900 disabled:opacity-50">Cancel</button>
              <button onClick={handleDeleteScreening} disabled={deletingId !== null || deleteConfirmText !== 'DELETE'} className="px-4 py-2 bg-rose-600 text-white font-semibold rounded text-xs hover:bg-rose-500 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                {deletingId ? (<><div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /><span>Deleting...</span></>) : <span>Permanently Delete</span>}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Reset Confirmation Modal */}
      {showResetConfirmModal && aiScreening && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-studio-950 border border-rose-500/30 rounded-xl shadow-2xl p-6 relative space-y-4">
            <button onClick={() => { setShowResetConfirmModal(false); setResetConfirmText(''); }} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 mt-0.5">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400">Reset or Rollback Telemetry</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{aiScreening.title}</p>
              </div>
            </div>

            {/* SAFE OPTION: Rollback Last Generation */}
            <div className="bg-amber-500/[0.04] border border-amber-500/20 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <History className="h-4 w-4 text-amber-400" />
                <span>Option 1: Safe Rollback (Undo Last Run)</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Rolls back ONLY the most recent simulation run or viewer batch. Brings audience telemetry back to its state before that run, leaving earlier real viewers intact.
              </p>
              <button
                type="button"
                onClick={handleRollbackAudience}
                disabled={rollingBack || resettingAudience}
                className="w-full py-2 bg-amber-600/80 hover:bg-amber-600 text-white font-semibold rounded text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {rollingBack ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Rolling back latest run...</span>
                  </>
                ) : (
                  <>
                    <History className="h-3.5 w-3.5" />
                    <span>Undo Last Run</span>
                  </>
                )}
              </button>
            </div>

            {/* DESTRUCTIVE OPTION: Complete Telemetry Wipe */}
            <div className="border-t border-white/10 pt-3 space-y-3">
              <div className="text-[10px] uppercase font-bold tracking-wider text-rose-400">
                Option 2: Full Telemetry Reset (Complete Wipe)
              </div>
              <div className="bg-studio-900/50 rounded-lg p-3 border border-rose-500/10 text-xs text-rose-400 space-y-1">
                <p className="font-semibold text-[11px]">Permanently clears all telemetry from ClickHouse:</p>
                <ul className="list-disc pl-4 text-[10px] space-y-0.5 text-muted-foreground">
                  <li>All real &amp; synthetic viewer telemetry records</li>
                  <li>Retention time-series curves and behavioral signals</li>
                </ul>
              </div>
              <div className="space-y-1.5 select-none">
                <label className="text-[11px] text-muted-foreground block select-none">
                  Type <strong className="text-rose-400 font-mono select-none">RESET</strong> to confirm full wipe:
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={e => setResetConfirmText(e.target.value.toUpperCase())}
                  onPaste={e => e.preventDefault()}
                  placeholder="RESET"
                  className="w-full bg-studio-900 border border-rose-500/20 rounded px-3 py-1.5 text-xs text-foreground font-mono uppercase focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowResetConfirmModal(false); setResetConfirmText(''); }}
                  disabled={resettingAudience || rollingBack}
                  className="px-4 py-1.5 border rounded text-xs hover:bg-studio-900 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetAudience}
                  disabled={resettingAudience || rollingBack || resetConfirmText !== 'RESET'}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {resettingAudience ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Clearing...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Confirm &amp; Clear All</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Studio Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md font-mono text-xs ${
            toast.type === 'error'
              ? 'bg-rose-950/95 border-rose-500/40 text-rose-300 shadow-rose-950/50'
              : toast.type === 'info'
              ? 'bg-studio-900/95 border-cyan-500/40 text-cyan-300 shadow-black/80'
              : 'bg-studio-900/95 border-emerald-500/40 text-emerald-300 shadow-black/80'
          }`}>
            {toast.type === 'error' ? (
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            ) : toast.type === 'info' ? (
              <History className="h-4 w-4 text-cyan-400 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            )}
            <span className="font-semibold">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 text-muted-foreground hover:text-foreground text-xs"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
