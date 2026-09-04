import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Film, Activity, AlertTriangle, Eye, Server, Compass, CheckCircle,
  Sparkles, Database, Cpu, Users, Zap, Layers, ArrowRight,
  Video, MessageSquare, PlayCircle, ChevronRight, ArrowUpRight
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

  // Active feature tab for "What Frame Sense Does"
  const [activeTab, setActiveTab] = useState<'telemetry' | 'vision' | 'synthetic' | 'collaboration'>('telemetry');

  // Interactive visual animation player tab
  const [activeAnimDemo, setActiveAnimDemo] = useState<'ingest' | 'vision' | 'synthetic'>('ingest');

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
      {/* Top Header & System Infrastructure Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 animate-pulse-slow">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              STUDIO EDITION v2.4
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">ClickHouse & Gemini 3.5 Mesh Active</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Post-Production Intelligence Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sub-second audience behavioral telemetry paired with multimodal AI vision analysis.
          </p>
        </div>

        {/* Live Infrastructure Pills */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Server className="h-3.5 w-3.5" />
            <span>ClickHouse MergeTree</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
            <Cpu className="h-3.5 w-3.5" />
            <span>Gemini 3.5 Vision Agent</span>
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"></span>
          </div>
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
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Film className="h-16 w-16 text-primary" />
            </div>
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
                <CheckCircle className="h-3 w-3" /> Live streaming
              </span>
              <Link to="/screenings" className="text-primary hover:underline flex items-center gap-0.5">
                Manage <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Telemetry Signals */}
          <div className="rounded-xl glass-panel p-5 space-y-3 glass-panel-hover group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Activity className="h-16 w-16 text-emerald-500" />
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Telemetry Event Stream</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-foreground">{stats.total_events.toLocaleString()}</div>
              <p className="text-xs text-emerald-400/90 font-medium mt-1 flex items-center gap-1">
                <Zap className="h-3 w-3 fill-emerald-400/20" /> Sub-second ClickHouse ingestion
              </p>
            </div>
            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">MergeTree Column Storage</span>
              <span className="text-emerald-400 font-semibold">&lt; 10ms Query Latency</span>
            </div>
          </div>

          {/* Audience Sessions */}
          <div className="rounded-xl glass-panel p-5 space-y-3 glass-panel-hover group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Users className="h-16 w-16 text-blue-500" />
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Audience Reach</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <Eye className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-foreground">{stats.total_sessions}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.unique_viewers} unique test audience viewers
              </p>
            </div>
            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Real & Synthetic Viewers</span>
              <span className="text-blue-400 font-medium">Retention Tracked</span>
            </div>
          </div>

          {/* Gemini AI Core */}
          <div className="rounded-xl glass-panel p-5 space-y-3 glass-panel-hover group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sparkles className="h-16 w-16 text-indigo-400" />
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Gemini Vision Core</span>
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-foreground flex items-center gap-2">
                Connected
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Gemini 3.5 Flash-lite + MCP Agent Mesh
              </p>
            </div>
            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Multimodal Inspector</span>
              <Link to="/findings" className="text-indigo-400 hover:underline flex items-center gap-0.5">
                AI Findings <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* HERO SECTION: Redesigned "Welcome to Frame Sense" Product Showcase */}
      <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-b from-card/90 via-card/70 to-background overflow-hidden shadow-2xl">
        {/* Decorative background subtle mesh glow */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none translate-y-1/2"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

        <div className="relative p-8 md:p-10 space-y-8">
          {/* Top Badge & Header */}
          <div className="space-y-4 max-w-4xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-primary/20 via-indigo-500/20 to-sky-500/20 border border-primary/30 text-primary text-xs font-bold tracking-wide uppercase shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
              <span>FRAME SENSE • REVOLUTIONIZING FILM POST-PRODUCTION</span>
            </div>

            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-foreground">
              Transform Audience Telemetry into <br className="hidden sm:inline" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-400">
                Frame-Accurate Editorial Intelligence
              </span>
            </h2>

            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-3xl font-normal">
              Frame Sense bridges test-audience behavioral signals with cutting-edge multi-modal AI vision. 
              By capturing sub-second playbacks, pauses, timeline seeks, and emotion markers into a high-throughput 
              <strong className="text-foreground font-semibold"> ClickHouse MergeTree</strong> column store, Frame Sense enables directors, editors, and studios to 
              pin-point pacing dips, audience drop-offs, and visual narrative friction with millisecond precision.
            </p>

            {/* Quick Action CTAs */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Link
                to="/screenings"
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/25 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all"
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
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-foreground font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <PlayCircle className="h-4 w-4 text-emerald-400" />
                  <span>Launch Public Player Demo</span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </a>
              )}

              <Link
                to="/findings"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 font-semibold text-sm transition-all"
              >
                <Sparkles className="h-4 w-4" />
                <span>AI Vision Findings</span>
              </Link>
            </div>
          </div>

          {/* PRODUCT ORIENTED ANIMATED GRAPHICS & CAPABILITY SHOWCASE */}
          <div className="grid gap-6 lg:grid-cols-12 items-stretch pt-4">
            
            {/* LEFT COLUMN: Animated Product Demonstration Box (7 Columns) */}
            <div className="lg:col-span-7 rounded-xl border border-border/80 bg-black/60 p-6 flex flex-col justify-between relative overflow-hidden backdrop-blur-md">
              {/* Anim Controller Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block"></span>
                  <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block"></span>
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block"></span>
                  <span className="text-xs text-muted-foreground font-mono ml-2">frame_sense_live_engine.v2</span>
                </div>
                <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-lg border border-border/60 text-xs font-medium">
                  <button
                    onClick={() => setActiveAnimDemo('ingest')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      activeAnimDemo === 'ingest' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    ClickHouse Telemetry
                  </button>
                  <button
                    onClick={() => setActiveAnimDemo('vision')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      activeAnimDemo === 'vision' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Gemini AI Vision
                  </button>
                  <button
                    onClick={() => setActiveAnimDemo('synthetic')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      activeAnimDemo === 'synthetic' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Synthetic Load
                  </button>
                </div>
              </div>

              {/* DEMO 1: ClickHouse Telemetry Animation */}
              {activeAnimDemo === 'ingest' && (
                <div className="space-y-4 py-2 my-auto">
                  <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      REAL-TIME RETENTION & TELEMETRY STREAM
                    </span>
                    <span>INGESTING @ 1,000 EVENTS/SEC</span>
                  </div>

                  {/* Animated Telemetry Graph SVG */}
                  <div className="relative h-48 w-full rounded-lg bg-zinc-950 border border-emerald-500/20 p-4 flex flex-col justify-end overflow-hidden">
                    <div className="absolute top-3 left-4 text-xs font-mono text-emerald-400/80 flex items-center gap-2">
                      <Database className="h-3.5 w-3.5" />
                      <span>ClickHouse MergeTree Column Storage</span>
                    </div>

                    {/* SVG Wave */}
                    <svg className="w-full h-32 overflow-visible" viewBox="0 0 500 120">
                      <defs>
                        <linearGradient id="telemetryGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {/* Grid Lines */}
                      <line x1="0" y1="30" x2="500" y2="30" stroke="#27272a" strokeDasharray="4" />
                      <line x1="0" y1="60" x2="500" y2="60" stroke="#27272a" strokeDasharray="4" />
                      <line x1="0" y1="90" x2="500" y2="90" stroke="#27272a" strokeDasharray="4" />

                      {/* Smooth Retention Curve */}
                      <path
                        d="M 0,20 Q 80,15 150,45 T 300,30 T 420,80 L 500,75 L 500,120 L 0,120 Z"
                        fill="url(#telemetryGrad)"
                      />
                      <path
                        d="M 0,20 Q 80,15 150,45 T 300,30 T 420,80 L 500,75"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3"
                        className="animate-wave-dash"
                      />

                      {/* Drop-off Event Pulsing Circle */}
                      <circle cx="150" cy="45" r="5" fill="#f43f5e" className="animate-ping" />
                      <circle cx="150" cy="45" r="5" fill="#f43f5e" />
                      <text x="160" y="42" fill="#f43f5e" fontSize="10" fontFamily="monospace" fontWeight="bold">
                        Drop-Off Hotspot (01:42)
                      </text>

                      {/* Peak Engagement Circle */}
                      <circle cx="300" cy="30" r="5" fill="#3b82f6" />
                      <text x="310" y="27" fill="#60a5fa" fontSize="10" fontFamily="monospace" fontWeight="bold">
                        Rewind Cluster (03:15)
                      </text>
                    </svg>

                    {/* Bottom Status Ticker */}
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-2 border-t border-zinc-800">
                      <span>Timeline: 00:00 - 05:30</span>
                      <span className="text-emerald-400 font-semibold">Retention: 94.2%</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sub-second event tracking records audience timeline scrubs, frame pauses, volume spikes, and emotional sentiment tags into columnar storage without missing a single frame.
                  </p>
                </div>
              )}

              {/* DEMO 2: Gemini AI Vision Scan Animation */}
              {activeAnimDemo === 'vision' && (
                <div className="space-y-4 py-2 my-auto">
                  <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                      <Sparkles className="h-3.5 w-3.5 animate-spin" />
                      GEMINI 3.5 FLASH-LITE MULTIMODAL VISION SCAN
                    </span>
                    <span>MCP AGENT ACTIVE</span>
                  </div>

                  {/* Animated Video Frame Scan Viewport */}
                  <div className="relative h-48 w-full rounded-lg bg-zinc-950 border border-indigo-500/30 p-3 overflow-hidden flex flex-col justify-between">
                    {/* Simulated Cinema Frame */}
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-zinc-900 to-black opacity-80"></div>
                    
                    {/* Laser Optical Scanline Animation */}
                    <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-laser-scan z-10"></div>

                    {/* Overlay AI Detection Annotations */}
                    <div className="relative z-20 flex justify-between items-start">
                      <div className="px-2.5 py-1 rounded bg-black/80 border border-indigo-500/40 text-[10px] font-mono text-indigo-300 flex items-center gap-1.5 shadow-md">
                        <Video className="h-3 w-3 text-cyan-400" />
                        <span>FRAME EXTRACT: 01:42.10</span>
                      </div>
                      <div className="px-2.5 py-1 rounded bg-rose-950/90 border border-rose-500/40 text-[10px] font-mono text-rose-300 animate-pulse">
                        ⚠️ PACING DIP DETECTED
                      </div>
                    </div>

                    {/* Center Crosshair AI Target */}
                    <div className="relative z-20 self-center text-center space-y-1 my-auto">
                      <div className="inline-flex items-center justify-center p-3 rounded-full border border-cyan-400/40 bg-cyan-400/10 text-cyan-300 animate-pulse-glow">
                        <Eye className="h-6 w-6" />
                      </div>
                      <div className="text-xs font-mono text-cyan-200 font-semibold bg-black/60 px-3 py-1 rounded-full border border-cyan-500/30">
                        Analyzing Scene Lighting & Dialogue Pacing
                      </div>
                    </div>

                    {/* Bottom AI Suggestion Callout */}
                    <div className="relative z-20 bg-indigo-950/80 backdrop-blur-md border border-indigo-500/30 p-2 rounded text-[11px] font-mono text-indigo-200 flex items-center justify-between">
                      <span className="truncate">"Cut 2.4s from wide shot to tighten visual tension."</span>
                      <span className="text-cyan-400 font-bold ml-2">98% Confidence</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Gemini 3.5 extracts keyframes around drop-off spikes and uses visual reasoning to provide explicit editorial recommendations, such as trimming slow cutaways or adjusting audio transitions.
                  </p>
                </div>
              )}

              {/* DEMO 3: Synthetic Audience Load Animation */}
              {activeAnimDemo === 'synthetic' && (
                <div className="space-y-4 py-2 my-auto">
                  <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
                      <Users className="h-3.5 w-3.5" />
                      SYNTHETIC AUDIENCE LOAD SIMULATOR
                    </span>
                    <span>100 AUTONOMOUS AGENTS</span>
                  </div>

                  {/* Animated Agent Mesh Box */}
                  <div className="relative h-48 w-full rounded-lg bg-zinc-950 border border-blue-500/30 p-4 overflow-hidden flex flex-col justify-between">
                    <div className="grid grid-cols-4 gap-2 relative z-10">
                      {[
                        { title: 'Cinephile Critics', count: 25, color: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
                        { title: 'Gen-Z Viewers', count: 35, color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' },
                        { title: 'Action Fans', count: 25, color: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
                        { title: 'Executives', count: 15, color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
                      ].map((persona, i) => (
                        <div key={i} className={`p-2 rounded-lg border text-center font-mono space-y-1 ${persona.color} animate-float-slow`} style={{ animationDelay: `${i * 0.4}s` }}>
                          <div className="text-[10px] font-bold truncate">{persona.title}</div>
                          <div className="text-sm font-extrabold">{persona.count}</div>
                          <div className="text-[9px] opacity-80">Simulating...</div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                        <span>Simulation Progress: Pre-Release Cut v3</span>
                        <span className="text-blue-400 font-bold">100% Completed</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 w-full animate-pulse"></div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Test your film before public distribution. Synthetic load generates realistic telemetry curves for diverse audience archetypes, predicting retention without risking early leaks.
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: 4 Product Feature Pillars (5 Columns) */}
            <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
              
              {/* Feature 1 */}
              <div 
                onClick={() => { setActiveTab('telemetry'); setActiveAnimDemo('ingest'); }}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'telemetry' 
                    ? 'border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/5' 
                    : 'border-border/60 bg-card/40 hover:bg-card/80 hover:border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      Sub-Second Telemetry Ingestion
                      {activeTab === 'telemetry' && <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">CLICKHOUSE</span>}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Lock-free columnar event storage captures every pause, seek, and drop-off with zero telemetry loss.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 2 */}
              <div 
                onClick={() => { setActiveTab('vision'); setActiveAnimDemo('vision'); }}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'vision' 
                    ? 'border-indigo-500/50 bg-indigo-500/10 shadow-lg shadow-indigo-500/5' 
                    : 'border-border/60 bg-card/40 hover:bg-card/80 hover:border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      Gemini 3.5 Multimodal Vision Audit
                      {activeTab === 'vision' && <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">MCP AGENT</span>}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Automated video keyframe inspection pinpoints pacing lulls, jarring cuts, and narrative friction.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 3 */}
              <div 
                onClick={() => { setActiveTab('synthetic'); setActiveAnimDemo('synthetic'); }}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'synthetic' 
                    ? 'border-blue-500/50 bg-blue-500/10 shadow-lg shadow-blue-500/5' 
                    : 'border-border/60 bg-card/40 hover:bg-card/80 hover:border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      Synthetic Audience Load Simulator
                      {activeTab === 'synthetic' && <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">PRE-RELEASE</span>}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Simulate hundreds of viewer personas (Critics, Casuals, Action Fans) before public screening.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 4 */}
              <div 
                onClick={() => { setActiveTab('collaboration'); setActiveAnimDemo('vision'); }}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'collaboration' 
                    ? 'border-cyan-500/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/5' 
                    : 'border-border/60 bg-card/40 hover:bg-card/80 hover:border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      Timecode-Anchored AI Assistant
                      {activeTab === 'collaboration' && <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">LIVE SSE</span>}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Converse directly with Gemini AI anchored to exact video timestamps <code className="text-cyan-300 font-mono">[MM:SS]</code>.
                    </p>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>

      {/* DETAILED TECHNICAL BREAKDOWN: "WHAT FRAME SENSE DOES" */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              Comprehensive Platform Capabilities
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              How Frame Sense operates from public viewer telemetry to studio editorial recommendations.
            </p>
          </div>

          {/* Interactive Navigation Tabs */}
          <div className="flex items-center gap-2 bg-secondary/60 p-1 rounded-xl border border-border/60 text-xs font-medium overflow-x-auto">
            <button
              onClick={() => setActiveTab('telemetry')}
              className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
                activeTab === 'telemetry' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              ⚡ Telemetry Pipeline
            </button>
            <button
              onClick={() => setActiveTab('vision')}
              className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
                activeTab === 'vision' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              👁️ Gemini Vision Engine
            </button>
            <button
              onClick={() => setActiveTab('synthetic')}
              className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
                activeTab === 'synthetic' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              🧪 Synthetic Simulation
            </button>
            <button
              onClick={() => setActiveTab('collaboration')}
              className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
                activeTab === 'collaboration' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              💬 Editorial Chat
            </button>
          </div>
        </div>

        {/* Tab Content Display */}
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-6 shadow-sm">
          {activeTab === 'telemetry' && (
            <div className="grid gap-6 md:grid-cols-2 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold font-mono">
                  <Database className="h-3.5 w-3.5" />
                  <span>CLICKHOUSE MERGETREE COLUMN STORE</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">Sub-Second Telemetry Ingestion</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Traditional audience testing relies on subjective post-screening surveys. Frame Sense captures 
                  <strong className="text-foreground"> millisecond-accurate viewing telemetry</strong> directly from custom HTML5 video player instances.
                </p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span><strong className="text-foreground">Timeline scrubbing & rewind clusters:</strong> Detect scenes audiences replay to understand key moments.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span><strong className="text-foreground">Instant drop-off curves:</strong> ClickHouse aggregates retention curves across thousands of concurrent sessions in &lt;10ms.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span><strong className="text-foreground">Reaction & sentiment markers:</strong> Viewers drop timecoded flags directly onto the video timeline.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 font-mono text-xs text-zinc-300 space-y-2 shadow-inner">
                <div className="text-emerald-400 font-bold">// ClickHouse Event Ingestion Schema</div>
                <pre className="text-[11px] text-zinc-400 leading-relaxed overflow-x-auto">
{`CREATE TABLE screening_events (
  screening_id String,
  session_id String,
  event_type Enum8('play'=1, 'pause'=2, 'seek'=3, 'comment'=4),
  video_time Float32,
  user_agent String,
  created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (screening_id, created_at);`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'vision' && (
            <div className="grid gap-6 md:grid-cols-2 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold font-mono">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>GEMINI 3.5 FLASH-LITE + MCP AGENT MESH</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">Multimodal AI Vision Investigation</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  When ClickHouse identifies a sudden drop-off steepening or audience rewind spike, the 
                  <strong className="text-foreground"> Gemini Vision Investigator</strong> extracts precise video keyframes around that timestamp.
                </p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span><strong className="text-foreground">Frame-Accurate Spatial Reasoning:</strong> Analyzes visual composition, character lighting, and motion blur.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span><strong className="text-foreground">Automated Editorial Notes:</strong> Generates actionable recommendations (e.g. "Trim 3 seconds of dialogue lag at 02:14").</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span><strong className="text-foreground">Confidence & Severity Scoring:</strong> Classifies findings into Critical, High, and Medium priorities.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 font-mono text-xs text-zinc-300 space-y-2 shadow-inner">
                <div className="text-indigo-400 font-bold">// Gemini 3.5 Multimodal Prompt Output</div>
                <div className="p-3 rounded bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-[11px] leading-relaxed">
                  <strong>Timestamp: [01:42.50] - High Drop-off Severity</strong><br />
                  "Visual analysis reveals a static wide shot lasting 8.4 seconds with minimal character dialogue. Recommendation: Cut directly to close-up reaction framing at 01:44 to maintain narrative velocity."
                </div>
              </div>
            </div>
          )}

          {activeTab === 'synthetic' && (
            <div className="grid gap-6 md:grid-cols-2 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold font-mono">
                  <Users className="h-3.5 w-3.5" />
                  <span>AUTONOMOUS CROWD SIMULATOR</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">Synthetic Audience Load Generation</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Before exposing a rough cut or confidential trailer to human audiences, post-production teams can trigger 
                  <strong className="text-foreground"> Synthetic Crowd Simulations</strong>.
                </p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-400 shrink-0" />
                    <span><strong className="text-foreground">Multi-Persona Modeling:</strong> Simulates Film Critics, Casual Mobile Viewers, and Genre Fans.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-400 shrink-0" />
                    <span><strong className="text-foreground">Predictive Retention Curves:</strong> Evaluates likely drop-off points prior to public test screenings.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-400 shrink-0" />
                    <span><strong className="text-foreground">Instant Stress Testing:</strong> Generate 100+ concurrent telemetry sessions in under 5 seconds.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 font-mono text-xs text-zinc-300 space-y-3 shadow-inner">
                <div className="flex justify-between items-center text-blue-400 font-bold">
                  <span>// Synthetic Audience Profiles</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20">READY</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800 flex justify-between">
                    <span className="text-amber-300 font-bold">Cinephile Critic Persona</span>
                    <span className="text-zinc-400">High sensitivity to pacing & dialogue</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800 flex justify-between">
                    <span className="text-cyan-300 font-bold">Gen-Z Short Attention Persona</span>
                    <span className="text-zinc-400">Seeks fast visual transitions</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800 flex justify-between">
                    <span className="text-rose-300 font-bold">Executive Producer Persona</span>
                    <span className="text-zinc-400">Monitors climax impact & run-time</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'collaboration' && (
            <div className="grid gap-6 md:grid-cols-2 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-bold font-mono">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>REAL-TIME SSE STREAMING CHAT</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">Timecode-Anchored AI Collaboration</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Editors and directors can converse with the Gemini AI Assistant directly inside the screening studio.
                  Every message can be anchored to an exact frame timestamp <code className="text-cyan-300 font-mono">[MM:SS]</code>.
                </p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span><strong className="text-foreground">Server-Sent Events (SSE):</strong> Smooth token-by-token streaming responses without UI freezing.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span><strong className="text-foreground">Context Awareness:</strong> Gemini reviews the full retention telemetry and video scene context automatically.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span><strong className="text-foreground">Deduplicated Session History:</strong> Conversation history persisted reliably in ClickHouse database.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 font-mono text-xs text-zinc-300 space-y-3 shadow-inner">
                <div className="text-cyan-400 font-bold">// Timecode AI Interactive Chat Sample</div>
                <div className="space-y-2 text-[11px]">
                  <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                    <strong className="text-primary">Editor:</strong> "Why did viewers drop off at [01:42]?"
                  </div>
                  <div className="p-2.5 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-200">
                    <strong className="text-cyan-400">Gemini 3.5 AI:</strong> "At [01:42], telemetry shows a 24% retention drop. Visual keyframes confirm an unedited static wide shot after the explosion sequence."
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SYSTEM ARCHITECTURE & WORKFLOW PIPELINE */}
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            End-to-End System Workflow
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            How Frame Sense processes telemetry signals into studio decisions in 4 steps.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4 relative">
          {[
            { step: '01', title: 'Public Audience Screening', desc: 'Viewers stream the film cut in cinematic player. Sub-second telemetry tracks pauses & seeks.', icon: Film, color: 'text-primary' },
            { step: '02', title: 'ClickHouse Column Ingest', desc: 'Lock-free ingestion engine writes event streams into MergeTree tables with instant aggregation.', icon: Database, color: 'text-emerald-400' },
            { step: '03', title: 'Gemini AI Vision Audit', desc: 'FFmpeg extracts keyframes at retention dip points. Gemini inspects visual composition & pacing.', icon: Sparkles, color: 'text-indigo-400' },
            { step: '04', title: 'Editorial Cue Dashboard', desc: 'Directors receive timecoded suggestions [MM:SS] and converse with Gemini AI in real-time.', icon: MessageSquare, color: 'text-cyan-400' },
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
