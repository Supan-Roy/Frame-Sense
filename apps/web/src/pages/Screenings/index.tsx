import { useEffect, useState, useRef } from 'react';
import {
  Plus, Film, Link as LinkIcon, BarChart2, X, ClipboardCheck,
  Clock, AlertTriangle, Trash2, TrendingDown, Zap, Eye,
  Activity, ChevronDown, ChevronRight, ChevronLeft, FlaskConical, Users,
  CircleDot, BarChart, RotateCcw, History, CheckCircle2, ExternalLink, MessageSquare,
  Sparkles, Loader2, Play, Lightbulb, Send, Square
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

type AITab = 'overview' | 'retention' | 'signals' | 'anomalies';

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

  // Detect ALL local peaks across timeline (minimum 4s spacing)
  const peakPoints: typeof points = [];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1].point.retention_rate;
    const curr = points[i].point.retention_rate;
    const next = points[i + 1].point.retention_rate;
    if (curr > 0.10 && curr >= prev && curr >= next && (curr > prev || curr > next)) {
      if (peakPoints.length === 0 || points[i].point.time_sec - peakPoints[peakPoints.length - 1].point.time_sec >= 4) {
        peakPoints.push(points[i]);
      }
    }
  }

  // Detect ALL steep drops across timeline (minimum 4s spacing)
  const dropPoints: typeof points = [];
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i].point.retention_rate;
    const next = points[i + 1].point.retention_rate;
    const drop = curr - next;
    if (drop >= 0.12) {
      const dropTarget = points[i + 1];
      if (dropPoints.length === 0 || dropTarget.point.time_sec - dropPoints[dropPoints.length - 1].point.time_sec >= 4) {
        dropPoints.push(dropTarget);
      }
    }
  }

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

          {/* Render ALL Peak Milestone Markers */}
          {peakPoints.map(p => (
            <g key={`pk-${p.point.time_sec}`} className="animate-pulse">
              <circle
                cx={p.x}
                cy={p.y}
                r="5"
                fill="#22c55e"
                stroke="#ffffff"
                strokeWidth="2"
                className="drop-shadow-lg"
              />
            </g>
          ))}

          {/* Render ALL Drop Milestone Markers */}
          {dropPoints.map(p => (
            <g key={`dp-${p.point.time_sec}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth="1.5"
                className="drop-shadow-lg"
              />
            </g>
          ))}

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
            <span>Exact Sec: <strong className="text-foreground">{fmtTime(hoveredPoint.point.time_sec)} ({hoveredPoint.point.time_sec}s)</strong></span>
            <span className="text-sky-400 font-semibold">{fmtPct(hoveredPoint.point.retention_rate)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-foreground font-semibold pt-0.5">
            <span className="text-[10px] text-muted-foreground font-normal">Active Viewers:</span>
            <span className="text-sky-300">{hoveredPoint.point.viewers.toLocaleString()}</span>
          </div>
          {peakPoints.some(p => p.point.time_sec === hoveredPoint.point.time_sec) && (
            <div className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 text-center">
              🔥 Replay Peak Hotspot
            </div>
          )}
          {dropPoints.some(p => p.point.time_sec === hoveredPoint.point.time_sec) && (
            <div className="text-[9px] text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 text-center">
              📉 Major Audience Drop
            </div>
          )}
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

function FormattedMarkdown({ text }: { text: string }) {
  if (!text) return null;

  // Clean up any outer quotes or escaped quotes
  let cleanedText = text
    .replace(/^["']|["']$/g, '')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n');

  // Split into lines
  const lines = cleanedText.split('\n');
  
  type Section = { title: string; content: string[] };
  const sections: Section[] = [];
  let currentSection: Section = { title: '', content: [] };

  const isHeaderLine = (line: string) => {
    const trimmed = line.trim();
    if (/^(#{1,4}|\*|-|\d+\.)\s+(OBSERVED|QUANTITATIVE|VISUAL|TELEMETRY|PLAUSIBLE|CONFIDENCE|VALIDATION|ACTIONABLE|[A-Z\s]{4,}:)/i.test(trimmed)) {
      return true;
    }
    if (/^#{1,4}\s+/.test(trimmed)) return true;
    return false;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentSection.content.length > 0) {
        currentSection.content.push('');
      }
      return;
    }

    if (isHeaderLine(line)) {
      if (currentSection.title || currentSection.content.length > 0) {
        sections.push(currentSection);
      }
      const rawTitle = trimmed.replace(/^(#{1,4}|\*|-|\d+\.)\s*/, '').replace(/:$/, '');
      currentSection = { title: rawTitle, content: [] };
    } else {
      currentSection.content.push(line);
    }
  });

  if (currentSection.title || currentSection.content.length > 0) {
    sections.push(currentSection);
  }

  const humanizeCode = (codeText: string) => {
    // Hide raw internal developer IDs from executive UI
    if (/^sc_[a-f0-9]+$/i.test(codeText) || /^med_[a-f0-9]+$/i.test(codeText) || /^anm_[a-f0-9]+$/i.test(codeText)) {
      return null;
    }
    // Convert snake_case variable assignments like exit_rate = 1.0 to 100.0% Exit Rate
    const varMatch = codeText.match(/^([a-z_]+)\s*=\s*([\d.]+)/i);
    if (varMatch) {
      const varName = varMatch[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const val = parseFloat(varMatch[2]);
      const pct = !isNaN(val) && val <= 1.0 ? `${(val * 100).toFixed(1)}%` : varMatch[2];
      return `${pct} ${varName}`;
    }
    return codeText;
  };

  const parseInline = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\$.*?\$)/g);
    return parts.map((part, i) => {
      if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('*') && part.endsWith('*') && part.length > 2)) {
        const rawContent = part.replace(/^\*+|\*+$/g, '');
        return <strong key={i} className="font-bold text-sky-200">{rawContent}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        const inner = part.slice(1, -1);
        const human = humanizeCode(inner);
        if (human === null) return null;
        return <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 font-medium text-xs shadow-sm mx-0.5">{human}</span>;
      }
      if (part.startsWith('$') && part.endsWith('$')) {
        return <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-950/70 border border-purple-500/40 text-purple-300 font-semibold text-xs shadow-sm mx-0.5">{part.slice(1, -1)}</span>;
      }
      return part;
    });
  };

  const renderContentLines = (contentLines: string[]) => {
    const elements: JSX.Element[] = [];
    let inList = false;
    let listItems: JSX.Element[] = [];

    contentLines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inList) {
          elements.push(<ul key={`ul-${idx}`} className="space-y-2 my-2.5 pl-5 list-disc text-slate-100">{listItems}</ul>);
          inList = false;
          listItems = [];
        }
        return;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
        inList = true;
        const itemContent = trimmed.replace(/^([-*]|\d+\.)\s*/, '');
        listItems.push(
          <li key={idx} className="text-[13.5px] leading-relaxed text-slate-100 font-sans my-1">
            {parseInline(itemContent)}
          </li>
        );
      } else {
        if (inList) {
          elements.push(<ul key={`ul-${idx}`} className="space-y-2 my-2.5 pl-5 list-disc text-slate-100">{listItems}</ul>);
          inList = false;
          listItems = [];
        }
        elements.push(
          <p key={idx} className="text-[13.5px] leading-relaxed text-slate-100 font-sans my-2">
            {parseInline(trimmed)}
          </p>
        );
      }
    });

    if (inList) {
      elements.push(<ul key={`ul-end`} className="space-y-2 my-2.5 pl-5 list-disc text-slate-100">{listItems}</ul>);
    }

    return elements;
  };

  const getSectionTitleStyle = (title: string) => {
    const t = title.toUpperCase();
    if (t.includes('OBSERVED')) {
      return {
        box: 'bg-cyan-950/90 border-cyan-500/50 text-cyan-300 shadow-cyan-950/60',
        dot: 'from-cyan-400 to-cyan-600',
      };
    }
    if (t.includes('QUANTITATIVE')) {
      return {
        box: 'bg-sky-950/90 border-sky-500/50 text-sky-300 shadow-sky-950/60',
        dot: 'from-sky-400 to-blue-600',
      };
    }
    if (t.includes('VISUAL')) {
      return {
        box: 'bg-indigo-950/90 border-indigo-500/50 text-indigo-300 shadow-indigo-950/60',
        dot: 'from-indigo-400 to-indigo-600',
      };
    }
    if (t.includes('CORRELATION') || t.includes('TELEMETRY')) {
      return {
        box: 'bg-purple-950/90 border-purple-500/50 text-purple-300 shadow-purple-950/60',
        dot: 'from-purple-400 to-fuchsia-600',
      };
    }
    if (t.includes('EXPLANATION') || t.includes('PLAUSIBLE')) {
      return {
        box: 'bg-amber-950/90 border-amber-500/50 text-amber-300 shadow-amber-950/60',
        dot: 'from-amber-400 to-amber-600',
      };
    }
    if (t.includes('CONFIDENCE')) {
      return {
        box: 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300 shadow-emerald-950/60',
        dot: 'from-emerald-400 to-teal-600',
      };
    }
    return {
      box: 'bg-slate-900/95 border-cyan-500/40 text-cyan-200 shadow-slate-950/60',
      dot: 'from-cyan-400 to-sky-500',
    };
  };

  if (sections.length === 0 || (sections.length === 1 && !sections[0].title)) {
    return (
      <div className="p-5 rounded-2xl bg-studio-950/90 border border-cyan-500/25 shadow-xl my-4 space-y-3 backdrop-blur-md">
        {renderContentLines(lines)}
      </div>
    );
  }

  return (
    <div className="space-y-5 my-4">
      {sections.map((sec, idx) => {
        const style = getSectionTitleStyle(sec.title || '');
        return (
          <div key={idx} className="p-5 rounded-2xl bg-studio-950/90 border border-white/10 shadow-xl space-y-3.5 backdrop-blur-md transition-all hover:border-cyan-500/35">
            {sec.title && (
              <div className="mb-1">
                <div className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg border shadow-md font-mono text-xs font-bold uppercase tracking-wider ${style.box}`}>
                  <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${style.dot} animate-pulse`} />
                  <span>{sec.title}</span>
                </div>
              </div>
            )}
            <div className="space-y-2 pt-1 text-[13.5px] leading-relaxed text-slate-100 font-sans px-1">
              {renderContentLines(sec.content)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnomalyCard({ anomaly, isEngagement = false, screeningId, savedFinding, onUpdate }: { anomaly: Anomaly; isEngagement?: boolean; screeningId?: string; savedFinding?: any; onUpdate?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [investigating, setInvestigating] = useState(false);
  const [elaborating, setElaborating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [report, setReport] = useState<string | null>(savedFinding?.investigation_report || null);
  const [elaboratedReport, setElaboratedReport] = useState<string | null>(savedFinding?.elaborated_report || null);
  const [mcpQueries, setMcpQueries] = useState<any[]>(savedFinding?.mcp_queries_executed || []);
  const [extractedFrames, setExtractedFrames] = useState<any[]>(savedFinding?.extracted_frames || []);
  const [error, setError] = useState<string | null>(null);
  const [activeFrameIdx, setActiveFrameIdx] = useState<number | null>(null);

  useEffect(() => {
    if (activeFrameIdx === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setActiveFrameIdx((prev) => (prev === null || prev <= 0 ? extractedFrames.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setActiveFrameIdx((prev) => (prev === null || prev >= extractedFrames.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'Escape') {
        setActiveFrameIdx(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFrameIdx, extractedFrames.length]);

  const activeFrame = activeFrameIdx !== null && extractedFrames[activeFrameIdx] ? extractedFrames[activeFrameIdx] : null;

  const handlePrevFrame = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveFrameIdx((prev) => (prev === null || prev <= 0 ? extractedFrames.length - 1 : prev - 1));
  };

  const handleNextFrame = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveFrameIdx((prev) => (prev === null || prev >= extractedFrames.length - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    if (savedFinding) {
      setReport(savedFinding.investigation_report || null);
      setElaboratedReport(savedFinding.elaborated_report || null);
      setMcpQueries(savedFinding.mcp_queries_executed || []);
      setExtractedFrames(savedFinding.extracted_frames || []);
    }
  }, [savedFinding]);

  const handleInvestigate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!screeningId) return;
    setInvestigating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/screenings/${screeningId}/audience/anomalies/${anomaly.anomaly_id}/investigate`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      setReport(data.investigation_report || 'No detailed report returned.');
      setMcpQueries(data.mcp_queries_executed || []);
      setExtractedFrames(data.extracted_frames || []);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.message || 'Investigation failed');
    } finally {
      setInvestigating(false);
    }
  };

  const handleElaborate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!screeningId) return;
    setElaborating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/screenings/${screeningId}/audience/anomalies/${anomaly.anomaly_id}/elaborate`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      setElaboratedReport(data.elaborated_report || 'No creative recommendations returned.');
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.message || 'Elaboration failed');
    } finally {
      setElaborating(false);
    }
  };

  const handleDeleteFinding = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!screeningId) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/screenings/${screeningId}/audience/anomalies/${anomaly.anomaly_id}/investigate`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      setReport(null);
      setElaboratedReport(null);
      setMcpQueries([]);
      setExtractedFrames([]);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to delete investigation findings');
    } finally {
      setDeleting(false);
    }
  };

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

          {/* AI Investigation Section */}
          <div className="pt-2 border-t border-white/10 space-y-2" onClick={e => e.stopPropagation()}>
            {!report && !investigating && (
              <button
                onClick={handleInvestigate}
                className="rainbow-border-wrapper group text-left cursor-pointer"
              >
                <div className="rainbow-border-inner">
                  <Play className="h-3.5 w-3.5 text-white fill-white group-hover:scale-110 transition-transform shrink-0" />
                  <span>Investigate Anomaly with Frame Sense AI</span>
                </div>
              </button>
            )}

            {investigating && (
              <div className="flex items-center justify-center gap-2 py-3 px-3 rounded-lg bg-sky-950/40 border border-sky-500/30 text-sky-300 text-xs font-mono animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                <span>Extracting Video Frames via FFmpeg & Running Multimodal Investigator...</span>
              </div>
            )}

            {error && (
              <div className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                error.includes('429') || error.includes('Quota') || error.includes('RESOURCE_EXHAUSTED')
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200 font-mono'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
              }`}>
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Gemini API Rate Limit / Quota Exhausted (Error 429)</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">{error}</p>
                <div className="text-[10px] text-amber-300/80 pt-1 border-t border-amber-500/20">
                  📍 <strong>Location Called</strong>: <code>apps/api/agents/frame_sense_investigator.py</code> (Google ADK MCP + Vision) &amp; <code>investigator_service.py</code> (Gemini 2.5 Flash).
                </div>
              </div>
            )}

            {report && (
              <div className="p-4 rounded-lg bg-studio-950 border border-sky-500/30 space-y-3.5 text-xs text-foreground/90">
                <div className="flex items-center justify-between border-b border-white/10 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-sky-300 font-mono">
                    <Sparkles className="h-4 w-4 text-sky-400" />
                    <span>Frame Sense Multimodal AI Investigation Findings</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {mcpQueries.length > 0 && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                        ⚡ {mcpQueries.length} ClickHouse MCP query executed
                      </span>
                    )}
                    <button
                      onClick={handleInvestigate}
                      disabled={investigating || deleting || elaborating}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 text-[10px] font-semibold font-mono transition-all disabled:opacity-50 cursor-pointer"
                      title="Re-run Gemini Vision & ClickHouse MCP investigation"
                    >
                      <RotateCcw className={`h-3 w-3 ${investigating ? 'animate-spin' : ''}`} />
                      <span>{investigating ? 'Regenerating...' : 'Regenerate'}</span>
                    </button>
                    <button
                      onClick={handleElaborate}
                      disabled={investigating || deleting || elaborating}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[10px] font-semibold font-mono transition-all disabled:opacity-50 cursor-pointer"
                      title="Ask Gemini to elaborate & suggest creative post-production edits"
                    >
                      <Lightbulb className={`h-3 w-3 text-amber-400 ${elaborating ? 'animate-bounce' : ''}`} />
                      <span>{elaborating ? 'Elaborating...' : 'More Detail'}</span>
                    </button>
                    <button
                      onClick={handleDeleteFinding}
                      disabled={investigating || deleting || elaborating}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-[10px] font-semibold font-mono transition-all disabled:opacity-50 cursor-pointer"
                      title="Delete saved findings for this anomaly"
                    >
                      <Trash2 className={`h-3 w-3 ${deleting ? 'animate-spin' : ''}`} />
                      <span>{deleting ? 'Deleting...' : 'Delete'}</span>
                    </button>
                  </div>
                </div>

                {extractedFrames.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-sky-400 uppercase tracking-wider">
                      <Film className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Extracted Video Frames Analyzed by Gemini Vision ({extractedFrames.length}) &middot; <span className="text-cyan-300 font-normal">Click to enlarge</span></span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                      {extractedFrames.map((fr, idx) => (
                        <div
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFrameIdx(idx);
                          }}
                          className="relative rounded-xl border border-cyan-500/30 overflow-hidden bg-black/90 shadow-md shadow-black/60 select-none group cursor-pointer hover:border-cyan-400/80 hover:shadow-cyan-950/50 transition-all"
                          onContextMenu={(e) => e.preventDefault()}
                          title="Click to view large frame"
                        >
                          <img
                            src={fr.base64}
                            alt={`Frame at ${fr.time_sec}s`}
                            onContextMenu={(e) => e.preventDefault()}
                            onDragStart={(e) => e.preventDefault()}
                            className="w-full aspect-video object-cover select-none pointer-events-none transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute bottom-0 inset-x-0 bg-black/85 backdrop-blur-xs text-[10px] font-mono font-bold text-cyan-300 text-center py-1 border-t border-cyan-500/20">
                            {fmtTime(fr.time_sec)} ({fr.time_sec}s)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lightbox Modal Overlay for Enlarged Vision Frame with Next/Prev Navigation */}
                {activeFrameIdx !== null && activeFrame && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 select-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveFrameIdx(null);
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <div
                      className="relative max-w-4xl w-full bg-studio-950 border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden p-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Lightbox Top Bar Header */}
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-studio-950/90">
                        <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
                          <Film className="h-4 w-4 text-cyan-400" />
                          <span>Extracted Vision Frame &middot; {fmtTime(activeFrame.time_sec)} ({activeFrame.time_sec}s)</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 ml-2">
                            Frame {activeFrameIdx + 1} of {extractedFrames.length}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFrameIdx(null);
                          }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-studio-900 transition-colors cursor-pointer"
                          title="Close preview (Esc)"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      {/* Large Protected Widescreen Image with Overlay Nav Buttons */}
                      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden rounded-b-xl">
                        {/* Previous Button */}
                        {extractedFrames.length > 1 && (
                          <button
                            onClick={handlePrevFrame}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/75 hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:text-white transition-all shadow-xl hover:scale-110 cursor-pointer z-10"
                            title="Previous Frame (Left Arrow)"
                          >
                            <ChevronLeft className="h-6 w-6" />
                          </button>
                        )}

                        {/* Protected Image */}
                        <img
                          src={activeFrame.base64}
                          alt={`Enlarged frame at ${activeFrame.time_sec}s`}
                          onContextMenu={(e) => e.preventDefault()}
                          onDragStart={(e) => e.preventDefault()}
                          className="w-full h-full object-contain select-none pointer-events-none"
                        />

                        {/* Next Button */}
                        {extractedFrames.length > 1 && (
                          <button
                            onClick={handleNextFrame}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/75 hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:text-white transition-all shadow-xl hover:scale-110 cursor-pointer z-10"
                            title="Next Frame (Right Arrow)"
                          >
                            <ChevronRight className="h-6 w-6" />
                          </button>
                        )}

                        <div className="absolute bottom-3 left-3 px-3 py-1 rounded-md bg-black/85 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold shadow-lg z-10">
                          Timecode: {fmtTime(activeFrame.time_sec)} ({activeFrame.time_sec}s) &middot; Frame {activeFrameIdx + 1}/{extractedFrames.length}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Formatted Findings or Quota Error Alert */}
                {report.includes('Quota Exhausted') || report.includes('RESOURCE_EXHAUSTED') || report.includes('Error 429') ? (
                  <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 font-mono text-xs space-y-2 mt-2">
                    <div className="flex items-center gap-2 font-bold text-amber-300">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      <span>Gemini API Quota Exhausted (Error 429: RESOURCE_EXHAUSTED)</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-200/90">{report}</p>
                  </div>
                ) : (
                  <>
                    <div className="border-t border-white/10 pt-2">
                      <FormattedMarkdown text={report} />
                    </div>

                    {elaborating && (
                      <div className="flex items-center justify-center gap-2 py-3 px-3 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs font-mono animate-pulse">
                        <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                        <span>Asking Gemini Text Model for Creative Edit & Post-Production Recommendations...</span>
                      </div>
                    )}

                    {elaboratedReport && (
                      <div className="mt-3 pt-3 border-t border-amber-500/30 bg-amber-500/[0.04] p-3.5 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2 font-bold text-amber-300 text-xs uppercase tracking-wider font-mono">
                          <Lightbulb className="h-4 w-4 text-amber-400 shrink-0" />
                          <span>Creative Post-Production Edit Recommendations (Gemini AI)</span>
                        </div>
                        <FormattedMarkdown text={elaboratedReport} />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ChatSession {
  session_id: string;
  screening_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
message_id: string;
  session_id: string;
  screening_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

function TypewriterMarkdown({ text, animate = false, onProgress }: { text: string; animate?: boolean; onProgress?: () => void }) {
  const [visibleLength, setVisibleLength] = useState(animate ? 0 : text.length);
  const isTyping = animate && visibleLength < text.length;

  useEffect(() => {
    if (!animate) {
      setVisibleLength(text.length);
      return;
    }

    setVisibleLength(0);
    const chunkSize = 3;
    const interval = setInterval(() => {
      setVisibleLength((prev) => {
        const next = Math.min(prev + chunkSize, text.length);
        if (next >= text.length) {
          clearInterval(interval);
        }
        if (onProgress) onProgress();
        return next;
      });
    }, 12);

    return () => clearInterval(interval);
  }, [text, animate]);

  const displayedText = text.slice(0, visibleLength);

  return (
    <div className="relative">
      <FormattedMarkdown text={displayedText} />
      {isTyping && (
        <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse ml-1 align-middle rounded-sm shadow-sm shadow-cyan-400" />
      )}
    </div>
  );
}

function SenseAIChatModal({ screening, onClose }: { screening: Screening; onClose: () => void }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animatedMsgId, setAnimatedMsgId] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStopResponse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setSending(false);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior,
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  const fetchSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await fetch(`/api/v1/screenings/${screening.screening_id}/chat/sessions`);
      if (!res.ok) throw new Error('Failed to fetch chat sessions');
      const data: ChatSession[] = await res.json();
      setSessions(data);
      if (data.length > 0) {
        setActiveSessionId(data[0].session_id);
      } else {
        const createRes = await fetch(`/api/v1/screenings/${screening.screening_id}/chat/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Chat Session' }),
        });
        if (createRes.ok) {
          const newSession: ChatSession = await createRes.json();
          setSessions([newSession]);
          setActiveSessionId(newSession.session_id);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [screening.screening_id]);

  useEffect(() => {
    if (!activeSessionId) return;
    const fetchMessages = async () => {
      try {
        setLoadingMessages(true);
        const res = await fetch(`/api/v1/screenings/${screening.screening_id}/chat/sessions/${activeSessionId}/messages`);
        if (!res.ok) throw new Error('Failed to fetch chat messages');
        const data: ChatMessage[] = await res.json();
        setMessages(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingMessages(false);
      }
    };
    fetchMessages();
  }, [activeSessionId]);

  const handleCreateSession = async () => {
    if (messages.length === 0 && activeSessionId) {
      return;
    }

    try {
      setError(null);
      const res = await fetch(`/api/v1/screenings/${screening.screening_id}/chat/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat Session' }),
      });
      if (!res.ok) throw new Error('Failed to create chat session');
      const newSession: ChatSession = await res.json();
      setSessions(prev => {
        const exists = prev.some(s => s.session_id === newSession.session_id);
        return exists ? prev : [newSession, ...prev];
      });
      setActiveSessionId(newSession.session_id);
      setMessages([]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/v1/screenings/${screening.screening_id}/chat/sessions/${sid}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete session');
      const updated = sessions.filter(s => s.session_id !== sid);
      setSessions(updated);
      if (activeSessionId === sid) {
        setActiveSessionId(updated.length > 0 ? updated[0].session_id : null);
        if (updated.length === 0) setMessages([]);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = inputPrompt.trim();
    if (!prompt || !activeSessionId || sending) return;

    setInputPrompt('');
    setSending(true);
    setError(null);

    const tempUserMsg: ChatMessage = {
      message_id: `temp_user_${Date.now()}`,
      session_id: activeSessionId,
      screening_id: screening.screening_id,
      role: 'user',
      content: prompt,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, tempUserMsg]);

    const tempAssistantMsgId = `temp_ast_${Date.now()}`;
    let assistantAdded = false;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(`/api/v1/screenings/${screening.screening_id}/chat/sessions/${activeSessionId}/messages/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      if (!res.body) throw new Error('ReadableStream not supported by response');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            try {
              const data = JSON.parse(dataStr);
              if (data.type === 'chunk' && data.text) {
                accumulatedText += data.text;
                const currentText = accumulatedText;

                if (!assistantAdded) {
                  assistantAdded = true;
                  const tempAssistantMsg: ChatMessage = {
                    message_id: tempAssistantMsgId,
                    session_id: activeSessionId,
                    screening_id: screening.screening_id,
                    role: 'assistant',
                    content: currentText,
                    created_at: new Date().toISOString(),
                  };
                  setMessages(prev => [...prev, tempAssistantMsg]);
                } else {
                  setMessages(prev =>
                    prev.map(m =>
                      m.message_id === tempAssistantMsgId
                        ? { ...m, content: currentText }
                        : m
                    )
                  );
                }
              }
            } catch (e) {
              console.error('SSE parse error:', e);
            }
          }
        }
      }

      const fetchMsgRes = await fetch(`/api/v1/screenings/${screening.screening_id}/chat/sessions/${activeSessionId}/messages`);
      if (fetchMsgRes.ok) {
        const finalMsgs: ChatMessage[] = await fetchMsgRes.json();
        if (finalMsgs.length > 0) {
          const lastMsg = finalMsgs[finalMsgs.length - 1];
          if (lastMsg.role === 'assistant') {
            setAnimatedMsgId(lastMsg.message_id);
          }
        }
        setMessages(finalMsgs);
      }
      const sessRes = await fetch(`/api/v1/screenings/${screening.screening_id}/chat/sessions`);
      if (sessRes.ok) setSessions(await sessRes.json());
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Sense AI stream stopped by user');
      } else {
        setError(err.message || 'Failed to send message');
        setMessages(prev => prev.filter(m => !(m.message_id === tempAssistantMsgId && !m.content.trim())));
      }
    } finally {
      abortControllerRef.current = null;
      setSending(false);
    }
  };

  const activeSession = sessions.find(s => s.session_id === activeSessionId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={e => e.stopPropagation()}>
      <div className="bg-studio-950 border border-cyan-500/30 rounded-2xl w-full max-w-6xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-studio-950/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
              <Sparkles className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground font-mono tracking-wide uppercase">Sense AI Assistant</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-semibold border border-cyan-500/40">
                  Gemini 3.5 Flash-lite + MCP
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-xl">
                Conversational Intelligence for <strong className="text-sky-300">{screening.title}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-studio-900 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body: Sidebar + Main Chat Thread */}
        <div className="flex-1 flex min-h-0">
          {/* Left Sidebar: Chat Sessions History */}
          <div className="w-72 shrink-0 border-r border-white/10 bg-studio-950/80 p-4 flex flex-col gap-3">
            <button
              onClick={handleCreateSession}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer group"
            >
              <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform text-cyan-400" />
              <span>New Chat Session</span>
            </button>

            <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-muted-foreground px-1 mt-1">
              Chat History &amp; Sessions
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {loadingSessions ? (
                <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                  <span>Loading sessions...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No past sessions yet.
                </div>
              ) : (
                sessions.map(s => {
                  const isActive = s.session_id === activeSessionId;
                  return (
                    <div
                      key={s.session_id}
                      onClick={() => setActiveSessionId(s.session_id)}
                      className={`group flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isActive
                          ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200 font-semibold shadow-sm'
                          : 'bg-studio-900/40 border-white/5 text-muted-foreground hover:bg-studio-900 hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                        <span className="truncate">{s.title || 'Untitled Chat'}</span>
                      </div>
                      {sessions.length > 1 && (
                        <button
                          onClick={(e) => handleDeleteSession(e, s.session_id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition-opacity"
                          title="Delete session"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Main Chat Thread */}
          <div className="flex-1 flex flex-col min-w-0 bg-studio-900/20">
            {/* Thread Banner */}
            <div className="px-5 py-2.5 border-b border-white/5 bg-studio-950/40 flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span className="truncate">Session: <strong className="text-cyan-300">{activeSession?.title || 'Active Chat'}</strong></span>
              <span className="text-[10px] text-muted-foreground/70">{messages.length} messages</span>
            </div>

            {/* Message Thread Scroll Area */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12 text-xs text-muted-foreground gap-2 font-mono">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                  <span>Loading message thread...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                  <div className="p-3 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                    <Sparkles className="h-8 w-8 text-cyan-400" />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <h3 className="text-sm font-bold text-foreground">Ask Sense AI Anything About This Screening</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Ask about second-by-second viewer telemetry from ClickHouse Cloud, exit drop-off causes, pacing, visual scene analysis, or film post-production suggestions.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isUser = m.role === 'user';
                  const isQuota = m.content.includes('Quota Exhausted') || m.content.includes('RESOURCE_EXHAUSTED') || m.content.includes('429');

                  if (isUser) {
                    return (
                      <div key={m.message_id} className="flex justify-end">
                        <div className="max-w-[78%] bg-sky-600/25 border border-sky-500/40 text-sky-100 rounded-2xl rounded-tr-none px-4 py-3 text-xs leading-relaxed font-sans shadow-md">
                          <div className="text-[9px] font-mono uppercase tracking-wider text-sky-400 font-bold mb-1">You</div>
                          {m.content}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={m.message_id} className="flex justify-start">
                      <div className="max-w-[85%] bg-studio-950 border border-cyan-500/30 text-foreground rounded-2xl rounded-tl-none p-4 space-y-2 shadow-xl shadow-cyan-950/20">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-2">
                          <Sparkles className="h-4 w-4 text-cyan-400 shrink-0" />
                          <span className="text-xs font-bold font-mono tracking-wider text-cyan-300 uppercase">Sense AI</span>
                          <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {isQuota ? (
                          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 font-mono text-xs space-y-1.5">
                            <div className="flex items-center gap-2 font-bold text-amber-300">
                              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                              <span>Gemini API Quota Exhausted (Error 429: RESOURCE_EXHAUSTED)</span>
                            </div>
                            <p className="text-[11px] leading-relaxed opacity-90">{m.content}</p>
                          </div>
                        ) : (
                          <TypewriterMarkdown
                            text={m.content}
                            animate={m.message_id === animatedMsgId || (sending && idx === messages.length - 1 && m.role === 'assistant')}
                            onProgress={() => scrollToBottom('auto')}
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {sending && !messages.some(m => m.role === 'assistant' && m.message_id.startsWith('temp_ast_')) && (
                <div className="flex justify-start">
                  <div className="bg-studio-950 border border-cyan-500/30 rounded-2xl rounded-tl-none p-4 text-xs text-cyan-300 font-mono flex items-center gap-3 animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-400 shrink-0" />
                    <span>Sense AI is querying ClickHouse Cloud MCP &amp; reasoning...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3.5 border-t border-white/10 bg-studio-950 flex items-center gap-2">
              <input
                type="text"
                value={inputPrompt}
                onChange={e => setInputPrompt(e.target.value)}
                placeholder="Ask Sense AI about viewer telemetry, exit drop-offs, pacing, or film insights..."
                disabled={sending}
                className="flex-1 bg-studio-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 font-sans"
              />
              {sending ? (
                <button
                  type="button"
                  onClick={handleStopResponse}
                  className="p-2.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/30 hover:border-cyan-400 transition-all cursor-pointer shrink-0 shadow-lg shadow-cyan-950/50"
                  title="Stop Response"
                >
                  <Square className="h-3.5 w-3.5 fill-current rounded-sm" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputPrompt.trim()}
                  className="p-2.5 rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-40 transition-all cursor-pointer font-bold shrink-0"
                  title="Send Prompt to Sense AI"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
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
  const [senseAIScreening, setSenseAIScreening] = useState<Screening | null>(null);
  const [aiTab, setAiTab] = useState<AITab>('overview');
  const [aiOverview, setAiOverview] = useState<Overview | null>(null);
  const [aiRetention, setAiRetention] = useState<RetentionData | null>(null);
  const [aiSignals, setAiSignals] = useState<SignalBucket[] | null>(null);
  const [aiAnomalies, setAiAnomalies] = useState<AnomalyData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [feedbackScreening, setFeedbackScreening] = useState<Screening | null>(null);
  const [feedbackComments, setFeedbackComments] = useState<CommentInfo[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const openFeedback = async (s: Screening) => {
    setFeedbackScreening(s);
    setFeedbackComments([]);
    setFeedbackLoading(true);
    try {
      const res = await fetch(`/api/v1/screenings/${s.screening_id}/comments`);
      if (res.ok) {
        setFeedbackComments(await res.json());
      }
    } catch (e) {
      console.error('Failed to load feedback comments:', e);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleAdminDeleteFeedbackComment = async (commentId: string) => {
    if (!feedbackScreening) return;
    try {
      const res = await fetch(`/api/v1/screenings/comments/${commentId}?is_admin=true`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setFeedbackComments(prev => prev.filter(c => c.comment_id !== commentId));
        triggerToast('Viewer feedback comment deleted by admin.', 'info');
      }
    } catch (e) {
      triggerToast('Failed to delete comment.', 'error');
    }
  };

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

  const [savedInvestigations, setSavedInvestigations] = useState<Record<string, any>>({});

  const getSavedFinding = (anomaly: Anomaly) => {
    if (!savedInvestigations) return undefined;
    if (savedInvestigations[anomaly.anomaly_id]) {
      return savedInvestigations[anomaly.anomaly_id];
    }
    const keys = Object.keys(savedInvestigations);
    const peak = anomaly.peak_time_sec ?? anomaly.start_time_sec;
    for (const k of keys) {
      const inv = savedInvestigations[k];
      if (inv && (inv.investigation_report || (inv.extracted_frames && inv.extracted_frames.length > 0))) {
        const rep = inv.investigation_report || '';
        if (
          rep.includes(`${anomaly.start_time_sec}-second`) ||
          rep.includes(`${peak}-second`) ||
          rep.includes(`0:${peak < 10 ? '0' : ''}${peak}`) ||
          (anomaly.title && rep.includes(anomaly.title))
        ) {
          return inv;
        }
      }
    }
    return undefined;
  };

  const loadAIData = async (sid: string) => {
    const [ovR, retR, sigR, anmR, invR] = await Promise.all([
      fetch(`/api/v1/screenings/${sid}/audience/overview`),
      fetch(`/api/v1/screenings/${sid}/audience/retention`),
      fetch(`/api/v1/screenings/${sid}/audience/signals`),
      fetch(`/api/v1/screenings/${sid}/audience/anomalies`),
      fetch(`/api/v1/screenings/${sid}/audience/anomalies/investigations`),
    ]);
    if (ovR.ok) setAiOverview(await ovR.json());
    if (retR.ok) setAiRetention(await retR.json());
    if (sigR.ok) { const d = await sigR.json(); setAiSignals(d.signals); }
    if (anmR.ok) setAiAnomalies(await anmR.json());
    if (invR.ok) setSavedInvestigations(await invR.json());
  };

  const openAI = async (s: Screening) => {
    setAiScreening(s); setAiTab('overview');
    setAiOverview(null); setAiRetention(null); setAiSignals(null); setAiAnomalies(null);
    setAiError(null); setSimResult(null); setSimError(null); setAiLoading(true);
    try { await loadAIData(s.screening_id); } catch (e: any) { setAiError(e.message); } finally { setAiLoading(false); }
  };

  const runSimulation = async (overrideMode?: string) => {
    if (!aiScreening) return;
    setSimRunning(true); setSimResult(null); setSimError(null);
    const targetMode = overrideMode || simMode;
    try {
      const url = `/api/v1/screenings/${aiScreening.screening_id}/dev/simulate?num_viewers=${simViewers}&mode=${targetMode}&variation=${targetMode === 'EXACT_REPLAY' ? 'LOW' : simVariation}&inject_ground_truth=${simInjectGroundTruth}${simSeed ? `&seed=${simSeed}` : ''}`;
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
              <AnomalyCard
                key={a.anomaly_id}
                anomaly={a}
                isEngagement={a.type === 'EXCEPTIONAL_ENGAGEMENT'}
                screeningId={aiScreening?.screening_id}
                savedFinding={getSavedFinding(a)}
                onUpdate={() => { if (aiScreening) loadAIData(aiScreening.screening_id); }}
              />
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
                {aiAnomalies.exceptional_engagement.map(a => (
                  <AnomalyCard
                    key={a.anomaly_id}
                    anomaly={a}
                    isEngagement
                    screeningId={aiScreening?.screening_id}
                    savedFinding={getSavedFinding(a)}
                    onUpdate={() => { if (aiScreening) loadAIData(aiScreening.screening_id); }}
                  />
                ))}
              </div>
            )}
            {aiAnomalies.anomalies.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-rose-400" /><span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">Behavioral Anomalies ({aiAnomalies.anomalies.length})</span></div>
                {aiAnomalies.anomalies.map(a => (
                  <AnomalyCard
                    key={a.anomaly_id}
                    anomaly={a}
                    screeningId={aiScreening?.screening_id}
                    savedFinding={getSavedFinding(a)}
                    onUpdate={() => { if (aiScreening) loadAIData(aiScreening.screening_id); }}
                  />
                ))}
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
                    <button onClick={() => openFeedback(s)} className="inline-flex items-center gap-1.5 text-xs text-sky-400 border border-sky-500/20 hover:bg-sky-500/10 rounded px-3 py-1.5 transition-all">
                      <MessageSquare className="h-3.5 w-3.5" /><span>Feedback</span>
                    </button>
                    <button onClick={() => setSenseAIScreening(s)} className="inline-flex items-center gap-1.5 text-xs text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/10 rounded px-3 py-1.5 transition-all cursor-pointer">
                      <Sparkles className="h-3.5 w-3.5 text-cyan-400" /><span>Sense AI</span>
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

      {/* Sense AI Chat Assistant Modal */}
      {senseAIScreening && (
        <SenseAIChatModal screening={senseAIScreening} onClose={() => setSenseAIScreening(null)} />
      )}

      {/* Audience Intelligence Modal */}
      {aiScreening && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full w-[92vw] max-w-6xl bg-studio-950 border rounded-xl shadow-2xl flex flex-col max-h-[92vh]">
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
                        <option value="EXACT_REPLAY">⚡ Exact Replay (0 Jitter)</option>
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
                        <option value={50000}>50,000 viewers</option>
                        <option value={100000}>100,000 viewers (Max)</option>
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
                    <div className="flex items-center gap-2">
                      <button onClick={() => runSimulation()} disabled={simRunning} className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600/80 hover:bg-amber-600 text-white font-semibold rounded text-xs disabled:opacity-50 transition-colors">
                        {simRunning ? (<><div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /><span>Generating...</span></>) : (<><FlaskConical className="h-3.5 w-3.5" /><span>Run Simulation</span></>)}
                      </button>
                      <button onClick={() => runSimulation('EXACT_REPLAY')} disabled={simRunning} title="Replicate original audience events exactly across target viewer count with 0% jitter" className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600/80 hover:bg-sky-600 text-white font-semibold rounded text-xs disabled:opacity-50 transition-colors border border-sky-400/30">
                        <Zap className="h-3.5 w-3.5" /><span>Exact Real Replay</span>
                      </button>
                    </div>
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

      {/* Dedicated Audience Feedback Modal */}
      {feedbackScreening && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-studio-950 border rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-6 border-b shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Audience Feedback & Notes ({feedbackComments.length})
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    Screening: {feedbackScreening.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFeedbackScreening(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {feedbackLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
                </div>
              ) : feedbackComments.length === 0 ? (
                <div className="text-xs text-muted-foreground italic bg-studio-900/60 p-8 border rounded-lg text-center space-y-2">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p>No feedback comments submitted for this screening room cut yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {feedbackComments.map((cmt) => (
                    <div key={cmt.comment_id} className="bg-studio-900 border rounded-lg p-4 space-y-2 hover:border-studio-700 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{cmt.display_name}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-studio-950 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded">
                            <Clock className="h-3 w-3" />
                            <span>{fmtTime(cmt.video_timecode_sec)}</span>
                          </span>
                        </div>
                        <button
                          onClick={() => handleAdminDeleteFeedbackComment(cmt.comment_id)}
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

            <div className="border-t p-4 flex justify-end shrink-0 bg-studio-950">
              <button
                onClick={() => setFeedbackScreening(null)}
                className="px-4 py-2 bg-studio-900 hover:bg-studio-800 text-xs font-semibold rounded border transition-colors"
              >
                Close
              </button>
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
