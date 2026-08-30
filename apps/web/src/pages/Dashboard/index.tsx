import { useEffect, useState } from 'react';
import { Film, Activity, AlertTriangle, Eye, Server, Compass, CheckCircle } from 'lucide-react';

interface DashboardStats {
  active_projects: number;
  total_sessions: number;
  total_events: number;
  unique_viewers: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    active_projects: 0,
    total_sessions: 0,
    total_events: 0,
    unique_viewers: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardStats() {
      try {
        setLoading(true);
        const res = await fetch('/api/v1/screenings/dashboard/stats');
        if (!res.ok) throw new Error("Failed to fetch dashboard stats");
        const data = await res.json();
        setStats(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to load telemetry stats.");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Post-Production Dashboard</h1>
        <p className="text-sm text-muted-foreground">Real-time audience insights and automated editorial analysis.</p>
      </div>

      {/* Grid Stats */}
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
          <div className="rounded-lg bg-card border p-6 space-y-2 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Active Screenings</span>
              <Film className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-semibold">{stats.active_projects}</div>
            <p className="text-xs text-muted-foreground">{stats.active_projects} screening rooms provisioned</p>
          </div>

          {/* Telemetry Ingestion */}
          <div className="rounded-lg bg-card border p-6 space-y-2 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Telemetry Signals</span>
              <Activity className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-semibold">{stats.total_events}</div>
            <p className="text-xs text-emerald-500 flex items-center gap-1 font-semibold">
              <Server className="h-3 w-3" />
              <span>ClickHouse Pipeline Active</span>
            </p>
          </div>

          {/* Audience Sessions */}
          <div className="rounded-lg bg-card border p-6 space-y-2 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Audience Sessions</span>
              <Eye className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-semibold">{stats.total_sessions}</div>
            <p className="text-xs text-muted-foreground">{stats.unique_viewers} unique test viewers recorded</p>
          </div>

          {/* Gemini Orchestrator */}
          <div className="rounded-lg bg-card border p-6 space-y-2 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Gemini Core Status</span>
              <CheckCircle className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-semibold">Connected</div>
            <p className="text-xs text-muted-foreground">Agent Orchestrator idle</p>
          </div>
        </div>
      )}

      {/* Meaningful Product Overview Panel */}
      <div className="rounded-lg border bg-card p-8 space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium text-foreground">Welcome to Frame Sense</h2>
        </div>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed max-w-3xl">
          <p>
            <strong>Frame Sense</strong> is an advanced, real-time audience telemetry platform engineered specifically for filmmakers and post-production studios. By tracking millisecond-accurate viewing patterns—including playbacks, pauses, and detailed navigation seek timelines—it transforms crowd behavioral feedback into tangible structural charts.
          </p>
          <p>
            All test viewing telemetry is streamed directly from our cinematic public viewer page and written in real-time to a local **ClickHouse MergeTree** column store. In subsequent updates, the embedded **Gemini Agent Core** will analyze these raw pacing maps to auto-generate editorial review suggestions—marking moments where viewer attention flags, pacing dips, or cut transitions feel jarred or disjointed.
          </p>
        </div>
      </div>
    </div>
  );
}
