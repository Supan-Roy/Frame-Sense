import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Film, Activity, AlertTriangle, Eye, Compass, CheckCircle,
  Sparkles, Database, Users, Layers, ArrowRight,
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
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Telemetry Signals</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-foreground">{stats.total_events.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Sub-second audience event signals
              </p>
            </div>
            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Columnar Store</span>
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
              <span className="text-blue-400 font-medium">Telemetry Tracked</span>
            </div>
          </div>

          {/* Gemini AI Core */}
          <div className="rounded-xl glass-panel p-5 space-y-3 glass-panel-hover group relative overflow-hidden">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Gemini AI Core</span>
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
              Frame Sense is an advanced audience telemetry and editorial intelligence platform engineered for film directors, editors, and post-production studios. By tracking sub-second playbacks, pauses, timeline seeking, and reaction flags directly into column-oriented storage, Frame Sense pinpoints pacing dips and retention friction with millisecond precision.
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
            
            {/* LEFT COLUMN: Demonstration Viewport */}
            <div className="lg:col-span-7 rounded-xl border border-border bg-zinc-950 p-6 flex flex-col justify-between relative overflow-hidden">
              {/* Controls Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                <span className="text-xs text-muted-foreground font-medium">Interactive Engine Preview</span>
                <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs font-medium">
                  <button
                    onClick={() => setActiveAnimDemo('ingest')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      activeAnimDemo === 'ingest' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Telemetry Stream
                  </button>
                  <button
                    onClick={() => setActiveAnimDemo('vision')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      activeAnimDemo === 'vision' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    AI Vision Audit
                  </button>
                  <button
                    onClick={() => setActiveAnimDemo('synthetic')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      activeAnimDemo === 'synthetic' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Synthetic Load
                  </button>
                </div>
              </div>

              {/* DEMO 1: Telemetry Stream Animation */}
              {activeAnimDemo === 'ingest' && (
                <div className="space-y-4 py-2 my-auto">
                  <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                      Real-Time Audience Telemetry Curve
                    </span>
                    <span>Ingesting Events</span>
                  </div>

                  <div className="relative h-44 w-full rounded-lg bg-zinc-900 border border-zinc-800 p-4 flex flex-col justify-end overflow-hidden">
                    <svg className="w-full h-28 overflow-visible" viewBox="0 0 500 120">
                      <defs>
                        <linearGradient id="telemetryGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="30" x2="500" y2="30" stroke="#27272a" strokeDasharray="4" />
                      <line x1="0" y1="60" x2="500" y2="60" stroke="#27272a" strokeDasharray="4" />
                      <line x1="0" y1="90" x2="500" y2="90" stroke="#27272a" strokeDasharray="4" />

                      <path
                        d="M 0,20 Q 80,15 150,45 T 300,30 T 420,80 L 500,75 L 500,120 L 0,120 Z"
                        fill="url(#telemetryGrad)"
                      />
                      <path
                        d="M 0,20 Q 80,15 150,45 T 300,30 T 420,80 L 500,75"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        className="animate-wave-dash"
                      />

                      <circle cx="150" cy="45" r="4" fill="#f43f5e" />
                      <text x="160" y="42" fill="#f43f5e" fontSize="10" fontFamily="sans-serif" fontWeight="600">
                        Drop-Off Point (01:42)
                      </text>

                      <circle cx="300" cy="30" r="4" fill="#3b82f6" />
                      <text x="310" y="27" fill="#60a5fa" fontSize="10" fontFamily="sans-serif" fontWeight="600">
                        Rewind Cluster (03:15)
                      </text>
                    </svg>

                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-2 border-t border-zinc-800">
                      <span>Timeline: 00:00 - 05:30</span>
                      <span className="text-emerald-400 font-semibold">Retention: 94.2%</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sub-second event tracking records audience timeline scrubs, frame pauses, and reaction flags into column-oriented storage.
                  </p>
                </div>
              )}

              {/* DEMO 2: Gemini AI Vision Scan Animation */}
              {activeAnimDemo === 'vision' && (
                <div className="space-y-4 py-2 my-auto">
                  <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                      <Sparkles className="h-3.5 w-3.5" />
                      Multimodal AI Vision Inspection
                    </span>
                    <span>Active Audit</span>
                  </div>

                  <div className="relative h-44 w-full rounded-lg bg-zinc-900 border border-indigo-500/30 p-3 overflow-hidden flex flex-col justify-between">
                    <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-laser-scan z-10"></div>

                    <div className="relative z-20 flex justify-between items-start">
                      <div className="px-2.5 py-1 rounded bg-black/80 border border-indigo-500/40 text-[10px] font-mono text-indigo-300 flex items-center gap-1.5">
                        <Video className="h-3 w-3 text-cyan-400" />
                        <span>Frame Extract: 01:42.10</span>
                      </div>
                      <div className="px-2.5 py-1 rounded bg-rose-950/80 border border-rose-500/40 text-[10px] font-mono text-rose-300">
                        Pacing Dip Flagged
                      </div>
                    </div>

                    <div className="relative z-20 self-center text-center space-y-1 my-auto">
                      <div className="inline-flex items-center justify-center p-2.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
                        <Eye className="h-5 w-5" />
                      </div>
                      <div className="text-xs text-cyan-200 font-medium bg-black/60 px-3 py-1 rounded-full border border-cyan-500/20">
                        Analyzing Scene Lighting & Dialogue Pacing
                      </div>
                    </div>

                    <div className="relative z-20 bg-indigo-950/80 border border-indigo-500/30 p-2 rounded text-[11px] font-mono text-indigo-200 flex items-center justify-between">
                      <span className="truncate">"Cut 2.4s from wide shot to tighten visual tension."</span>
                      <span className="text-cyan-400 font-bold ml-2">98% Match</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Gemini 3.5 extracts video keyframes around drop-off points to provide explicit editorial recommendations.
                  </p>
                </div>
              )}

              {/* DEMO 3: Synthetic Audience Load Animation */}
              {activeAnimDemo === 'synthetic' && (
                <div className="space-y-4 py-2 my-auto">
                  <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
                      <Users className="h-3.5 w-3.5" />
                      Synthetic Audience Load Simulation
                    </span>
                    <span>100 Viewers</span>
                  </div>

                  <div className="relative h-44 w-full rounded-lg bg-zinc-900 border border-zinc-800 p-4 overflow-hidden flex flex-col justify-between">
                    <div className="grid grid-cols-4 gap-2 relative z-10">
                      {[
                        { title: 'Cinephile Critics', count: 25, color: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
                        { title: 'Gen-Z Viewers', count: 35, color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' },
                        { title: 'Action Fans', count: 25, color: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
                        { title: 'Executives', count: 15, color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
                      ].map((persona, i) => (
                        <div key={i} className={`p-2 rounded-lg border text-center font-mono space-y-1 ${persona.color}`}>
                          <div className="text-[10px] font-bold truncate">{persona.title}</div>
                          <div className="text-sm font-extrabold">{persona.count}</div>
                          <div className="text-[9px] opacity-80">Simulating...</div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1 pt-2">
                      <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                        <span>Simulation Progress</span>
                        <span className="text-blue-400 font-bold">Completed</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div className="h-full bg-blue-500 w-full"></div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Test your film before public distribution. Synthetic load models realistic telemetry curves across diverse viewer profiles.
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: 4 Product Feature Pillars */}
            <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
              
              {/* Feature 1 */}
              <div 
                onClick={() => { setActiveTab('telemetry'); setActiveAnimDemo('ingest'); }}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'telemetry' 
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
                      Sub-Second Telemetry Ingestion
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Columnar event storage captures every pause, seek, and drop-off with zero data loss.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 2 */}
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
                      Multimodal AI Vision Audit
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Automated video keyframe inspection pinpoints pacing lulls and narrative friction.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 3 */}
              <div 
                onClick={() => { setActiveTab('synthetic'); setActiveAnimDemo('synthetic'); }}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'synthetic' 
                    ? 'border-primary/50 bg-primary/5 shadow-sm' 
                    : 'border-border/60 bg-card hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Synthetic Audience Load Simulator
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Simulate diverse viewer personas (Critics, Casuals, Action Fans) before public screening.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 4 */}
              <div 
                onClick={() => { setActiveTab('collaboration'); setActiveAnimDemo('vision'); }}
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
                      Timecode-Anchored AI Assistant
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

      {/* DETAILED TECHNICAL BREAKDOWN */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              Platform Capabilities
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              How Frame Sense operates from public viewer telemetry to studio editorial recommendations.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 bg-secondary/60 p-1 rounded-xl border border-border/60 text-xs font-medium overflow-x-auto">
            <button
              onClick={() => setActiveTab('telemetry')}
              className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
                activeTab === 'telemetry' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Telemetry Ingestion
            </button>
            <button
              onClick={() => setActiveTab('vision')}
              className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
                activeTab === 'vision' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Vision Audit Engine
            </button>
            <button
              onClick={() => setActiveTab('synthetic')}
              className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
                activeTab === 'synthetic' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Synthetic Load
            </button>
            <button
              onClick={() => setActiveTab('collaboration')}
              className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
                activeTab === 'collaboration' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Editorial Chat
            </button>
          </div>
        </div>

        {/* Tab Content Display */}
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-6 shadow-sm">
          {activeTab === 'telemetry' && (
            <div className="grid gap-6 md:grid-cols-2 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                  <Database className="h-3.5 w-3.5" />
                  <span>Column-Oriented Storage</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">Sub-Second Telemetry Ingestion</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Traditional audience testing relies on subjective post-screening surveys. Frame Sense captures 
                  <strong className="text-foreground font-medium"> millisecond-accurate viewing telemetry</strong> directly from custom HTML5 video player instances.
                </p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span><strong className="text-foreground font-medium">Timeline scrubbing & rewind clusters:</strong> Detect scenes audiences replay to understand key moments.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span><strong className="text-foreground font-medium">Instant drop-off curves:</strong> Aggregates retention curves across thousands of concurrent sessions in &lt;10ms.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span><strong className="text-foreground font-medium">Reaction & sentiment markers:</strong> Viewers drop timecoded flags directly onto the video timeline.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 font-mono text-xs text-zinc-300 space-y-2 shadow-inner">
                <div className="text-emerald-400 font-bold">// Columnar Event Ingestion Schema</div>
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
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 text-xs font-semibold">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Multimodal Reasoning Engine</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">Multimodal AI Vision Investigation</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  When telemetry identifies a sudden drop-off steepening or audience rewind spike, the 
                  <strong className="text-foreground font-medium"> Gemini Vision Investigator</strong> extracts precise video keyframes around that timestamp.
                </p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span><strong className="text-foreground font-medium">Frame-Accurate Spatial Reasoning:</strong> Analyzes visual composition, character lighting, and motion blur.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span><strong className="text-foreground font-medium">Automated Editorial Notes:</strong> Generates actionable recommendations (e.g. "Trim 3 seconds of dialogue lag at 02:14").</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span><strong className="text-foreground font-medium">Confidence & Severity Scoring:</strong> Classifies findings into Critical, High, and Medium priorities.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 font-mono text-xs text-zinc-300 space-y-2 shadow-inner">
                <div className="text-indigo-400 font-bold">// AI Vision Recommendation</div>
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
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-semibold">
                  <Users className="h-3.5 w-3.5" />
                  <span>Audience Simulation</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">Synthetic Audience Load Generation</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Before exposing a rough cut or confidential trailer to human audiences, post-production teams can trigger 
                  <strong className="text-foreground font-medium"> Synthetic Crowd Simulations</strong>.
                </p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-400 shrink-0" />
                    <span><strong className="text-foreground font-medium">Multi-Persona Modeling:</strong> Simulates Film Critics, Casual Mobile Viewers, and Genre Fans.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-400 shrink-0" />
                    <span><strong className="text-foreground font-medium">Predictive Retention Curves:</strong> Evaluates likely drop-off points prior to public test screenings.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-400 shrink-0" />
                    <span><strong className="text-foreground font-medium">Instant Stress Testing:</strong> Generate 100+ concurrent telemetry sessions in under 5 seconds.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 font-mono text-xs text-zinc-300 space-y-3 shadow-inner">
                <div className="flex justify-between items-center text-blue-400 font-bold">
                  <span>// Audience Persona Profiles</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800 flex justify-between">
                    <span className="text-amber-300 font-semibold">Cinephile Critic Persona</span>
                    <span className="text-zinc-400">High sensitivity to pacing & dialogue</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800 flex justify-between">
                    <span className="text-cyan-300 font-semibold">Gen-Z Short Attention Persona</span>
                    <span className="text-zinc-400">Seeks fast visual transitions</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800 flex justify-between">
                    <span className="text-rose-300 font-semibold">Executive Producer Persona</span>
                    <span className="text-zinc-400">Monitors climax impact & run-time</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'collaboration' && (
            <div className="grid gap-6 md:grid-cols-2 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 text-xs font-semibold">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Real-Time Streaming Chat</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">Timecode-Anchored AI Collaboration</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Editors and directors can converse with the Gemini AI Assistant directly inside the screening studio.
                  Every message can be anchored to an exact frame timestamp <code className="text-cyan-300 font-mono">[MM:SS]</code>.
                </p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span><strong className="text-foreground font-medium">Server-Sent Events (SSE):</strong> Smooth token-by-token streaming responses without UI freezing.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span><strong className="text-foreground font-medium">Context Awareness:</strong> Gemini reviews the full retention telemetry and video scene context automatically.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span><strong className="text-foreground font-medium">Deduplicated Session History:</strong> Conversation history persisted reliably.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 font-mono text-xs text-zinc-300 space-y-3 shadow-inner">
                <div className="text-cyan-400 font-bold">// Timecode AI Chat Sample</div>
                <div className="space-y-2 text-[11px]">
                  <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                    <strong className="text-primary">Editor:</strong> "Why did viewers drop off at [01:42]?"
                  </div>
                  <div className="p-2.5 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-200">
                    <strong className="text-cyan-400">Gemini AI:</strong> "At [01:42], telemetry shows a 24% retention drop. Visual keyframes confirm an unedited static wide shot after the explosion sequence."
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
            End-to-End Workflow
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            How Frame Sense processes telemetry signals into studio decisions in 4 steps.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4 relative">
          {[
            { step: '01', title: 'Audience Screening', desc: 'Viewers stream the film cut in cinematic player. Sub-second telemetry tracks pauses & seeks.', icon: Film, color: 'text-primary' },
            { step: '02', title: 'Columnar Ingestion', desc: 'Event engine writes telemetry streams into column storage for instant retention aggregation.', icon: Database, color: 'text-emerald-400' },
            { step: '03', title: 'AI Vision Audit', desc: 'Keyframes extracted at retention dip points. Gemini inspects visual composition & pacing.', icon: Sparkles, color: 'text-indigo-400' },
            { step: '04', title: 'Editorial Insights', desc: 'Directors receive timecoded suggestions [MM:SS] and converse with Gemini AI in real-time.', icon: MessageSquare, color: 'text-cyan-400' },
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
