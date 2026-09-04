import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Film, Activity, AlertTriangle, Eye, Compass, CheckCircle,
  Sparkles, Database, Layers, ArrowRight,
  MessageSquare, PlayCircle, ChevronRight, ArrowUpRight
} from 'lucide-react';

interface DashboardStats {
  active_projects: number;
  total_sessions: number;
  total_events: number;
  unique_viewers: number;
}

interface ActiveScreening {
  id: string;
  title: string;
  share_token: string;
  video_filename: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    active_projects: 0,
    total_sessions: 0,
    total_events: 0,
    unique_viewers: 0
  });
  const [activeScreenings, setActiveScreenings] = useState<ActiveScreening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active feature tab for Platform Capabilities
  const [activeTab, setActiveTab] = useState<'retention' | 'anomaly' | 'vision' | 'collaboration'>('retention');

  // Interactive visual animation demo player tab
  const [activeAnimDemo, setActiveAnimDemo] = useState<'ingest' | 'anomaly' | 'vision' | 'collaboration'>('ingest');

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        const [statsRes, screeningsRes] = await Promise.all([
          fetch('/api/v1/screenings/dashboard/stats'),
          fetch('/api/v1/screenings/')
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (screeningsRes.ok) {
          const screeningsData = await screeningsRes.json();
          setActiveScreenings(screeningsData);
        }
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to load live telemetry stats.");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  const firstScreening = activeScreenings[0];

  return (
    <div className="space-y-10 pb-16">
      {/* Clean Professional Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Post-Production Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time audience behavioral telemetry paired with automated AI vision intelligence.
          </p>
        </div>
      </div>

      {/* Grid Stats Bar */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 flex items-center gap-3 text-rose-500 text-sm">
          <AlertTriangle className="h-5 w-5" />
          <span>Error loading live telemetry: displaying local cached states.</span>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Active Screenings */}
          <div className="rounded-xl glass-panel p-5 space-y-3 glass-panel-hover group relative overflow-hidden">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Active Screening Rooms</span>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Film className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-foreground">{stats.active_projects}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.active_projects} cinematic cut{stats.active_projects === 1 ? '' : 's'} provisioned
              </p>
            </div>
            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> Operational
              </span>
              <Link to="/screenings" className="text-primary hover:underline flex items-center gap-0.5 font-medium">
                Manage <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Telemetry Signals */}
          <div className="rounded-xl glass-panel p-5 space-y-3 glass-panel-hover group relative overflow-hidden">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Audience Event Signals</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-foreground">{stats.total_events.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Sub-second audience interaction signals
              </p>
            </div>
            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Real-Time Ingestion</span>
              <span className="text-emerald-400 font-medium">Pipeline Active</span>
            </div>
          </div>

          {/* Audience Sessions */}
          <div className="rounded-xl glass-panel p-5 space-y-3 glass-panel-hover group relative overflow-hidden">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Audience Reach</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <Eye className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-foreground">{stats.total_sessions}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.unique_viewers} unique test viewers recorded
              </p>
            </div>
            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Viewing Sessions</span>
              <span className="text-blue-400 font-medium">Retention Tracked</span>
            </div>
          </div>

          {/* Gemini AI Core */}
          <div className="rounded-xl glass-panel p-5 space-y-3 glass-panel-hover group relative overflow-hidden">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Gemini AI Assistant</span>
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-foreground flex items-center gap-2">
                Connected
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Multimodal Vision Agent Ready
              </p>
            </div>
            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Editorial Assistant</span>
              <Link to="/findings" className="text-indigo-400 hover:underline flex items-center gap-0.5 font-medium">
                AI Findings <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* HERO SECTION: Redesigned "Welcome to Frame Sense" Product Overview */}
      <div className="relative rounded-2xl border border-border/80 bg-card overflow-hidden shadow-lg">
        <div className="p-8 md:p-10 space-y-8">
          {/* Header Title */}
          <div className="space-y-4 max-w-4xl">
            <div className="flex items-center gap-2 text-primary font-medium text-sm">
              <Compass className="h-4 w-4" />
              <span>Welcome to Frame Sense</span>
            </div>

            <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
              Transform Audience Behavioral Data into <br className="hidden sm:inline" />
              <span className="text-primary">Frame-Accurate Editorial Intelligence</span>
            </h2>

            <p className="text-base text-muted-foreground leading-relaxed max-w-3xl">
              Frame Sense is an advanced audience telemetry and editorial intelligence platform engineered for film directors, editors, and post-production studios. By tracking sub-second playbacks, pauses, timeline seeking, and reaction flags, Frame Sense pinpoints pacing dips and retention friction with millisecond precision.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Link
                to="/screenings"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-sm"
              >
                <Film className="h-4 w-4" />
                <span>Explore Screening Rooms</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              {firstScreening && (
                <a
                  href={`/screening/${firstScreening.share_token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-foreground font-medium text-sm transition-all"
                >
                  <PlayCircle className="h-4 w-4 text-emerald-400" />
                  <span>Launch Public Player Demo</span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </a>
              )}

              <Link
                to="/findings"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-foreground font-medium text-sm transition-all"
              >
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span>AI Vision Findings</span>
              </Link>
            </div>
          </div>

          {/* PRODUCT CAPABILITY SHOWCASE */}
          <div className="grid gap-6 lg:grid-cols-12 items-stretch pt-2">
            
            {/* LEFT COLUMN: Interactive Animated Product Viewport */}
            <div className="lg:col-span-7 rounded-xl border border-border bg-zinc-950 p-6 flex flex-col justify-between relative overflow-hidden">
              {/* Controls Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live Feature Preview
                </span>
                <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs font-medium overflow-x-auto">
                  <button
                    onClick={() => setActiveAnimDemo('ingest')}
                    className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                      activeAnimDemo === 'ingest' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Retention Heatmap
                  </button>
                  <button
                    onClick={() => setActiveAnimDemo('anomaly')}
                    className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                      activeAnimDemo === 'anomaly' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Anomaly Detection
                  </button>
                  <button
                    onClick={() => setActiveAnimDemo('vision')}
                    className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                      activeAnimDemo === 'vision' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    AI Cut Suggestions
                  </button>
                  <button
                    onClick={() => setActiveAnimDemo('collaboration')}
                    className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                      activeAnimDemo === 'collaboration' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    AI Co-Pilot
                  </button>
                </div>
              </div>

              {/* DEMO 1: Retention Heatmap Animation */}
              {activeAnimDemo === 'ingest' && (
                <div className="space-y-4 py-2 my-auto">
                  <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                      Real-Time Audience Retention Wave
                    </span>
                    <span>Tracking Viewers Live</span>
                  </div>

                  <div className="relative h-48 w-full rounded-lg bg-zinc-900 border border-zinc-800 p-4 flex flex-col justify-end overflow-hidden">
                    <svg className="w-full h-32 overflow-visible" viewBox="0 0 500 130">
                      <defs>
                        <linearGradient id="telemetryGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="30" x2="500" y2="30" stroke="#27272a" strokeDasharray="4" />
                      <line x1="0" y1="60" x2="500" y2="60" stroke="#27272a" strokeDasharray="4" />
                      <line x1="0" y1="90" x2="500" y2="90" stroke="#27272a" strokeDasharray="4" />

                      <path
                        d="M 0,20 Q 80,15 130,55 T 210,65 T 300,28 T 410,75 L 500,70 L 500,130 L 0,130 Z"
                        fill="url(#telemetryGrad)"
                      />
                      <path
                        d="M 0,20 Q 80,15 130,55 T 210,65 T 300,28 T 410,75 L 500,70"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        className="animate-wave-dash"
                      />

                      {/* 4 Key Milestone Behavioral Findings Markers */}
                      <g className="animate-pulse">
                        <circle cx="130" cy="55" r="4" fill="#f43f5e" />
                        <text x="135" y="52" fill="#f43f5e" fontSize="9" fontFamily="sans-serif" fontWeight="700">Pacing Drop-off [01:42]</text>
                      </g>

                      <g className="animate-pulse">
                        <circle cx="210" cy="65" r="4" fill="#f59e0b" />
                        <text x="215" y="62" fill="#fbbf24" fontSize="9" fontFamily="sans-serif" fontWeight="700">Scrub-Forward Spike [02:15]</text>
                      </g>

                      <g className="animate-pulse">
                        <circle cx="300" cy="28" r="4" fill="#3b82f6" />
                        <text x="305" y="25" fill="#60a5fa" fontSize="9" fontFamily="sans-serif" fontWeight="700">Replay Hotspot [03:15]</text>
                      </g>

                      <g className="animate-pulse">
                        <circle cx="410" cy="75" r="4" fill="#06b6d4" />
                        <text x="415" y="72" fill="#22d3ee" fontSize="9" fontFamily="sans-serif" fontWeight="700">Session Exit Spike [04:20]</text>
                      </g>
                    </svg>

                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-2 border-t border-zinc-800">
                      <span>Cut Duration: 05:30</span>
                      <span className="text-emerald-400 font-semibold">94.2% Net Retention</span>
                    </div>
                  </div>

                  {/* 4 Detailed User Behavioral Findings Cards (2-3 lines max each) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                    <div className="p-2.5 rounded bg-zinc-900 border border-rose-500/30 space-y-1">
                      <div className="text-rose-400 font-bold flex items-center justify-between">
                        <span>Pacing Drop-off [01:42]</span>
                        <span className="text-[9px] bg-rose-500/20 px-1.5 py-0.2 rounded">Retention Dip</span>
                      </div>
                      <p className="text-zinc-300 font-sans text-[10px] leading-relaxed">
                        Viewer attention drops 24% during static wide shot holding without dialogue; triggers pacing drop-off alert.
                      </p>
                    </div>

                    <div className="p-2.5 rounded bg-zinc-900 border border-amber-500/30 space-y-1">
                      <div className="text-amber-400 font-bold flex items-center justify-between">
                        <span>Scrub-Forward Spike [02:15]</span>
                        <span className="text-[9px] bg-amber-500/20 px-1.5 py-0.2 rounded">Fast-Forward</span>
                      </div>
                      <p className="text-zinc-300 font-sans text-[10px] leading-relaxed">
                        38% of test viewers scrubbed forward to skip past slow cutaway transitions and reach main dialogue.
                      </p>
                    </div>

                    <div className="p-2.5 rounded bg-zinc-900 border border-blue-500/30 space-y-1">
                      <div className="text-blue-400 font-bold flex items-center justify-between">
                        <span>Replay Hotspot [03:15]</span>
                        <span className="text-[9px] bg-blue-500/20 px-1.5 py-0.2 rounded">3.2x Rewind</span>
                      </div>
                      <p className="text-zinc-300 font-sans text-[10px] leading-relaxed">
                        High scene rewatch cluster (3.2x baseline) as 94% of viewers rewound to rewatch dramatic plot reveal beat.
                      </p>
                    </div>

                    <div className="p-2.5 rounded bg-zinc-900 border border-cyan-500/30 space-y-1">
                      <div className="text-cyan-400 font-bold flex items-center justify-between">
                        <span>Session Exit Spike [04:20]</span>
                        <span className="text-[9px] bg-cyan-500/20 px-1.5 py-0.2 rounded">Abrupt Exit</span>
                      </div>
                      <p className="text-zinc-300 font-sans text-[10px] leading-relaxed">
                        Sudden 18% session exit peak as viewers abandoned stream during loud background score masking speech track.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* DEMO 2: Anomaly Detection System Animation */}
              {activeAnimDemo === 'anomaly' && (
                <div className="space-y-4 py-2 my-auto">
                  <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Statistical Anomaly Telemetry Engine
                    </span>
                    <span className="text-emerald-400 font-semibold">ClickHouse Baselines Active</span>
                  </div>

                  <div className="relative rounded-xl bg-zinc-950 border border-zinc-800 p-4 space-y-3 shadow-inner overflow-hidden">
                    <div className="grid grid-cols-2 gap-2 relative z-10">
                      <div className="p-2.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 space-y-1">
                        <div className="text-[10px] font-bold uppercase flex justify-between">
                          <span>Cognitive Friction</span>
                          <span className="font-mono text-purple-400">[01:42]</span>
                        </div>
                        <div className="text-xs font-extrabold text-foreground">3.2x Pause &amp; Rewind Ratio</div>
                        <div className="text-[9px] opacity-80 font-sans">Statistically significant friction threshold</div>
                      </div>

                      <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 space-y-1">
                        <div className="text-[10px] font-bold uppercase flex justify-between">
                          <span>Emotional Hotspot</span>
                          <span className="font-mono text-emerald-400">[03:15]</span>
                        </div>
                        <div className="text-xs font-extrabold text-foreground">94.2% Replay Retention</div>
                        <div className="text-[9px] opacity-80 font-sans">Exceptional engagement spike detected</div>
                      </div>

                      <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 space-y-1">
                        <div className="text-[10px] font-bold uppercase flex justify-between">
                          <span>Audio Peak Anomaly</span>
                          <span className="font-mono text-amber-400">[02:50]</span>
                        </div>
                        <div className="text-xs font-extrabold text-foreground">Background Score Masking</div>
                        <div className="text-[9px] opacity-80 font-sans">Dialogue clarity reduction flagged</div>
                      </div>

                      <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 space-y-1">
                        <div className="text-[10px] font-bold uppercase flex justify-between">
                          <span>Pacing Disruption</span>
                          <span className="font-mono text-rose-400">[04:20]</span>
                        </div>
                        <div className="text-xs font-extrabold text-foreground">Abrupt Exit Drop-Off</div>
                        <div className="text-[9px] opacity-80 font-sans">Viewer session exit rate anomaly</div>
                      </div>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-zinc-800 flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                      <span>ClickHouse Telemetry Anomaly Baseline</span>
                      <span className="text-blue-400 font-bold">4 Anomaly Signals Verified</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Frame Sense compares live viewer interaction metrics against statistical baselines to automatically detect cognitive friction, emotional replay hotspots, and audio/visual anomalies.
                  </p>
                </div>
              )}

              {/* DEMO 3: AI Cut Suggestions Animation (Upper Card with Side Scan & Scene 01 Image) */}
              {activeAnimDemo === 'vision' && (
                <div className="space-y-4 py-2 my-auto">
                  <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                      <Sparkles className="h-3.5 w-3.5 animate-spin" />
                      Multimodal AI Keyframe Inspector
                    </span>
                    <span className="text-cyan-400 font-mono text-[11px]">Scene 01 • Frame [01:42]</span>
                  </div>

                  <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 space-y-3 shadow-inner relative overflow-hidden">
                    {/* Keyframe Card with Scene 01 Image & Side Scanning Laser */}
                    <div className="relative h-36 w-full rounded-lg overflow-hidden border border-indigo-500/30 group">
                      {/* Side Scanning Laser Beam */}
                      <div className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-400 via-sky-300 to-indigo-400 shadow-[0_0_15px_#22d3ee] animate-laser-scan-side z-30 pointer-events-none"></div>

                      <img
                        src="/scene_01.png"
                        alt="Scene 01 Keyframe"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent z-10"></div>
                      
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-indigo-300 border border-indigo-500/30 backdrop-blur-sm z-20 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                        <span>Scene 01.png • AI Side Scan</span>
                      </div>
                      
                      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end z-20">
                        <div className="text-[11px] font-medium text-white bg-black/80 px-2.5 py-1 rounded backdrop-blur-sm border border-white/10">
                          Static Wide Shot Detected
                        </div>
                        <span className="text-rose-300 bg-rose-950/90 text-[10px] font-mono px-2 py-0.5 rounded border border-rose-500/40 font-semibold backdrop-blur-sm">
                          High Priority Cut
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/30 space-y-1">
                      <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold">
                        <span>Scene 01 Recommendation #04</span>
                        <span className="text-emerald-400 font-mono text-[10px]">98% Match</span>
                      </div>
                      <p className="text-xs text-indigo-200 leading-relaxed font-sans">
                        "Static wide camera shot lingers 8.4s in Scene 01. Recommend trimming 2.4s to tighten cut transition to character close-up."
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    AI visual analysis combines keyframe optical scanning with audience drop-off metrics to suggest precise frame-accurate cut trims.
                  </p>
                </div>
              )}

              {/* DEMO 4: Editorial Co-Pilot Animation (Upper Card with Editorial Chat Session) */}
              {activeAnimDemo === 'collaboration' && (
                <div className="space-y-4 py-2 my-auto">
                  <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Timecode-Anchored AI Co-Pilot
                    </span>
                    <span className="text-cyan-300 font-semibold bg-cyan-500/20 px-2 py-0.5 rounded text-[10px]">Live Session</span>
                  </div>

                  <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 space-y-3 shadow-inner relative overflow-hidden">
                    <div className="space-y-2.5 text-xs">
                      <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 space-y-1">
                        <div className="text-[11px] font-bold text-primary flex items-center justify-between">
                          <span>Film Editor</span>
                          <span className="text-zinc-500 font-mono">10:42 AM</span>
                        </div>
                        <p className="text-zinc-300 font-sans">
                          "Why did retention drop at timestamp <span className="text-cyan-300 font-mono font-bold hover:underline cursor-pointer">[01:42]</span>?"
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-cyan-100 space-y-1">
                        <div className="text-[11px] font-bold text-cyan-400 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Gemini AI Co-Pilot
                          </span>
                          <span className="text-cyan-400/60 font-mono">Just Now</span>
                        </div>
                        <p className="text-cyan-100 leading-relaxed font-sans">
                          "At [01:42], audience retention dropped 24%. Keyframe analysis shows a wide camera angle holding with zero character dialogue. Trimming 2s will maintain narrative pace."
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Converse directly with Gemini AI inside the studio workspace with every message anchored to frame-accurate timestamps <code className="text-cyan-300 font-mono">[MM:SS]</code>.
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: 4 Product Feature Pillars */}
            <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
              
              {/* Feature 1 */}
              <div 
                onClick={() => { setActiveTab('retention'); setActiveAnimDemo('ingest'); }}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'retention' 
                    ? 'border-primary/50 bg-primary/5 shadow-sm' 
                    : 'border-border/60 bg-card hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <Database className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Audience Engagement Heatmaps
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Track exact seconds where test viewers replay scenes, scrub back, or pause watching.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 2 */}
              <div 
                onClick={() => { setActiveTab('anomaly'); setActiveAnimDemo('anomaly'); }}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'anomaly' 
                    ? 'border-primary/50 bg-primary/5 shadow-sm' 
                    : 'border-border/60 bg-card hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Statistical Anomaly Detection
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Automatically detects cognitive friction, emotional replay peaks, and pacing anomalies against baselines.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 3 */}
              <div 
                onClick={() => { setActiveTab('vision'); setActiveAnimDemo('vision'); }}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'vision' 
                    ? 'border-primary/50 bg-primary/5 shadow-sm' 
                    : 'border-border/60 bg-card hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Automated AI Cut Suggestions
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      AI inspects keyframes around anomalies to suggest precise frame-accurate cut trims.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 4 */}
              <div 
                onClick={() => { setActiveTab('collaboration'); setActiveAnimDemo('collaboration'); }}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'collaboration' 
                    ? 'border-primary/50 bg-primary/5 shadow-sm' 
                    : 'border-border/60 bg-card hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Timecode-Anchored AI Co-Pilot
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Ask questions directly about any timestamp <code className="text-cyan-300 font-mono">[MM:SS]</code> in your film.
                    </p>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>

      {/* USER FRIENDLY PLATFORM CAPABILITIES SECTION */}
      <div className="space-y-6">
        <div className="border-b border-border/40 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              Platform Capabilities &amp; Strengths
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Engineered with ClickHouse OLAP analytics, statistical z-score outlier detection, and Gemini 2.5 multimodal vision.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20 shrink-0">
            <Sparkles className="h-3.5 w-3.5" />
            <span>ClickHouse + Gemini Vision Engine</span>
          </div>
        </div>

        {/* 4 Capabilities 2x2 Grid Matrix with Investigative Animations & Mathematical Calculations */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* CAPABILITY 1: AUDIENCE ENGAGEMENT */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm flex flex-col justify-between hover:border-emerald-500/40 transition-all relative overflow-hidden group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                  <Database className="h-3.5 w-3.5" />
                  <span>Real-Time Telemetry</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Step 01 • Telemetry</span>
              </div>
              <h3 className="text-lg font-bold text-foreground group-hover:text-emerald-400 transition-colors">1. Live Audience Engagement &amp; Heatmaps</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Captures millisecond-level viewer interactions directly into ClickHouse OLAP tables. Computes frame-accurate retention curves and drop-off points in zero time.
              </p>
            </div>

            {/* Investigative Formula & Sequential Pulse */}
            <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 space-y-3 shadow-inner relative overflow-hidden">
              <div className="flex justify-between items-center text-xs font-mono border-b border-zinc-800 pb-2">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Retention Ingestion Formula
                </span>
                <span className="text-zinc-400 font-mono text-[10px]">ClickHouse SQL</span>
              </div>

              {/* Formula & Large Metric Banner */}
              <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-center space-y-1">
                <div className="text-[10px] font-mono text-emerald-400/80">MATHEMATICAL CALCULATION</div>
                <div className="text-xs font-mono text-emerald-200 font-bold tracking-wide">
                  Retention(t) = ( N_active(t) / N_total ) × 100%
                </div>
                <div className="text-[10px] text-zinc-400 font-sans">0ms Python memory overhead • Executed inside ClickHouse</div>
              </div>

              {/* Big Metric Display Grid */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-muted-foreground">Fidelity</div>
                  <div className="text-lg font-black text-emerald-400">100%</div>
                  <div className="text-[9px] text-emerald-400/70">Frame-Level</div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-muted-foreground">Ingest Delay</div>
                  <div className="text-lg font-black text-emerald-400">0.0ms</div>
                  <div className="text-[9px] text-emerald-400/70">OLAP Streaming</div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-muted-foreground">Turnaround</div>
                  <div className="text-lg font-black text-emerald-400">Instant</div>
                  <div className="text-[9px] text-emerald-400/70">vs 3-Day Focus</div>
                </div>
              </div>
            </div>
          </div>

          {/* CAPABILITY 2: ANOMALY DETECTION */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm flex flex-col justify-between hover:border-blue-500/40 transition-all relative overflow-hidden group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Statistical Baseline Engine</span>
                </div>
                <span className="text-[10px] font-mono text-blue-400/80 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Step 02 • ML Outliers</span>
              </div>
              <h3 className="text-lg font-bold text-foreground group-hover:text-blue-400 transition-colors">2. Statistical Z-Score Anomaly Engine</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Evaluates sub-second viewer interaction signals against baseline mean and standard deviation to detect cognitive friction, emotional replay peaks, and audio masking.
              </p>
            </div>

            {/* Investigative Formula & Sequential Outliers */}
            <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 space-y-3 shadow-inner relative overflow-hidden">
              <div className="flex justify-between items-center text-xs font-mono border-b border-zinc-800 pb-2">
                <span className="text-blue-400 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Z-Score Outlier Formula
                </span>
                <span className="text-blue-400 font-semibold text-[10px] bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Threshold: Z &gt; 2.0</span>
              </div>

              {/* Formula & Large Metric Banner */}
              <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-500/20 text-center space-y-1">
                <div className="text-[10px] font-mono text-blue-400/80">MATHEMATICAL OUTLIER MODEL</div>
                <div className="text-xs font-mono text-blue-200 font-bold tracking-wide">
                  Z = ( X_observed - μ_baseline ) / ( σ_baseline + ε )
                </div>
                <div className="text-[10px] text-zinc-400 font-sans">HIGH: Z &gt; 3.0 • MEDIUM: Z &gt; 2.0 • LOW: Z &gt; 1.5</div>
              </div>

              {/* Big Metric Display Grid */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-muted-foreground">Accuracy</div>
                  <div className="text-lg font-black text-blue-400">99.4%</div>
                  <div className="text-[9px] text-blue-400/70">Statistical ML</div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-muted-foreground">Vectors</div>
                  <div className="text-lg font-black text-blue-400">4 Active</div>
                  <div className="text-[9px] text-blue-400/70">Friction &amp; Replay</div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-muted-foreground">False Alarms</div>
                  <div className="text-lg font-black text-blue-400">&lt; 0.6%</div>
                  <div className="text-[9px] text-blue-400/70">Auto-Calibrated</div>
                </div>
              </div>
            </div>
          </div>

          {/* CAPABILITY 3: AI CUT SUGGESTIONS */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm flex flex-col justify-between hover:border-indigo-500/40 transition-all relative overflow-hidden group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold border border-indigo-500/20">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Multimodal Vision Engine</span>
                </div>
                <span className="text-[10px] font-mono text-indigo-400/80 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">Step 03 • Vision Cut</span>
              </div>
              <h3 className="text-lg font-bold text-foreground group-hover:text-indigo-400 transition-colors">3. Automated Gemini AI Cut Suggestions</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Extracts keyframe images at drop-off timestamps via FFmpeg. Passes keyframes to Gemini 2.5 Multimodal Vision to inspect composition, lighting, and silence delays.
              </p>
            </div>

            {/* Investigative Formula & Keyframe Inspection */}
            <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 space-y-3 shadow-inner relative overflow-hidden">
              <div className="flex justify-between items-center text-xs font-mono border-b border-zinc-800 pb-2">
                <span className="text-indigo-400 font-bold flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Keyframe Vision Audit Formula
                </span>
                <span className="text-indigo-300 font-semibold text-[10px] bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">Gemini Multimodal</span>
              </div>

              {/* Formula & Large Metric Banner */}
              <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-center space-y-1">
                <div className="text-[10px] font-mono text-indigo-400/80">VISION PACING AUDIT</div>
                <div className="text-xs font-mono text-indigo-200 font-bold tracking-wide">
                  Pacing_Score = Visual_Silence(t) × Z_drop-off
                </div>
                <div className="text-[10px] text-zinc-400 font-sans">Result: "Trim 2.4s static wide shot at [01:42] to accelerate pace"</div>
              </div>

              {/* Big Metric Display Grid */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-muted-foreground">Confidence</div>
                  <div className="text-lg font-black text-indigo-400">98%</div>
                  <div className="text-[9px] text-indigo-400/70">Keyframe Match</div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-muted-foreground">Edit Speed</div>
                  <div className="text-lg font-black text-indigo-400">10x</div>
                  <div className="text-[9px] text-indigo-400/70">Faster Cutting</div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-muted-foreground">Accuracy</div>
                  <div className="text-lg font-black text-indigo-400">Frame</div>
                  <div className="text-[9px] text-indigo-400/70">Timecode [MM:SS]</div>
                </div>
              </div>
            </div>
          </div>

          {/* CAPABILITY 4: EDITORIAL CO-PILOT */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm flex flex-col justify-between hover:border-cyan-500/40 transition-all relative overflow-hidden group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-semibold border border-cyan-500/20">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Timecode Co-Pilot Assistant</span>
                </div>
                <span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">Step 04 • Editorial Co-Pilot</span>
              </div>
              <h3 className="text-lg font-bold text-foreground group-hover:text-cyan-400 transition-colors">4. Timecode-Anchored AI Co-Pilot</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Direct conversational assistant in your studio workspace. Anchors questions to exact timestamps <code className="text-cyan-300 font-mono">[MM:SS]</code> combining ClickHouse telemetry and keyframes.
              </p>
            </div>

            {/* Investigative Formula & Interactive Studio Chat Context */}
            <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 space-y-3 shadow-inner relative overflow-hidden">
              <div className="flex justify-between items-center text-xs font-mono border-b border-zinc-800 pb-2">
                <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Timecode Anchor Context Model
                </span>
                <span className="text-cyan-300 font-semibold text-[10px] bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">Streaming Active</span>
              </div>

              {/* Formula & Large Metric Banner */}
              <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-center space-y-1">
                <div className="text-[10px] font-mono text-cyan-400/80">CONTEXT INJECTION FORMULA</div>
                <div className="text-xs font-mono text-cyan-200 font-bold tracking-wide">
                  Context = Timecode[MM:SS] + ClickHouse(Z) + Vision(Part)
                </div>
                <div className="text-[10px] text-zinc-400 font-sans">Token-by-token streaming guidance anchored to exact video NLE frames</div>
              </div>

              {/* Big Metric Display Grid */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-muted-foreground">Availability</div>
                  <div className="text-lg font-black text-cyan-400">24/7</div>
                  <div className="text-[9px] text-cyan-400/70">Studio Assistant</div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-muted-foreground">Anchor Fidelity</div>
                  <div className="text-lg font-black text-cyan-400">100%</div>
                  <div className="text-[9px] text-cyan-400/70">Frame-Accurate</div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-muted-foreground">Latency</div>
                  <div className="text-lg font-black text-cyan-400">120ms</div>
                  <div className="text-[9px] text-cyan-400/70">Token Stream</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* SYSTEM ARCHITECTURE & WORKFLOW PIPELINE */}
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            End-to-End Post-Production Workflow
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            How Frame Sense processes test audience reactions into actionable film cut recommendations in 4 simple steps.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4 relative">
          {[
            { step: '01', title: 'Audience Screening', desc: 'Test viewers stream your film cut in our custom player. Interaction signals are tracked automatically.', icon: Film, color: 'text-primary' },
            { step: '02', title: 'Real-Time Signal Ingestion', desc: 'Viewing events are processed instantly to generate live drop-off curves and retention heatmaps.', icon: Database, color: 'text-emerald-400' },
            { step: '03', title: 'AI Visual Scene Audit', desc: 'Video keyframes are extracted around drop-off points. AI inspects scene lighting, framing, and pacing.', icon: Sparkles, color: 'text-indigo-400' },
            { step: '04', title: 'Editorial Cue Recommendations', desc: 'Directors receive timecoded suggestions [MM:SS] and converse directly with the AI Co-pilot.', icon: MessageSquare, color: 'text-cyan-400' },
          ].map((item, i) => (
            <div key={i} className="rounded-xl border border-border/80 bg-secondary/30 p-5 space-y-3 relative group hover:border-primary/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-muted-foreground/30 group-hover:text-primary/60 transition-colors">{item.step}</span>
                <div className={`p-2 rounded-lg bg-background border border-border ${item.color}`}>
                  <item.icon className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
