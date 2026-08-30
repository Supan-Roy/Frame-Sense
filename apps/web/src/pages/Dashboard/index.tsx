import { Film, AlertTriangle, Activity, CheckCircle } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Post-Production Dashboard</h1>
        <p className="text-sm text-muted-foreground">Real-time audience insights and automated editorial analysis.</p>
      </div>

      {/* Grid Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-card border p-6 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Active Projects</span>
            <Film className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-semibold">0</div>
          <p className="text-xs text-muted-foreground">0 screenings this week</p>
        </div>

        <div className="rounded-lg bg-card border p-6 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Telemetry Ingestion</span>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold">0 <span className="text-xs text-muted-foreground font-normal">events/s</span></div>
          <p className="text-xs text-muted-foreground">ClickHouse connection inactive</p>
        </div>

        <div className="rounded-lg bg-card border p-6 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Audience Anomalies</span>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold">0</div>
          <p className="text-xs text-muted-foreground">No anomalies pending review</p>
        </div>

        <div className="rounded-lg bg-card border p-6 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Agent Status</span>
            <CheckCircle className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-semibold">Idle</div>
          <p className="text-xs text-muted-foreground">Gemini Orchestrator ready</p>
        </div>
      </div>

      {/* Overview Panel */}
      <div className="rounded-lg border bg-card p-8">
        <h2 className="text-lg font-medium mb-2">Welcome to Frame Sense Boilerplate</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          This system is configured for the **Agentic Cinema Hackathon**. Currently running in foundation mode. Live streaming analytics, ClickHouse data pipelines, and agentic workflows are defined but will be integrated in subsequent increments.
        </p>
      </div>
    </div>
  );
}
