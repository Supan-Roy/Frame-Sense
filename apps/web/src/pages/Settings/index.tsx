import { Database, Sliders, Cpu, Save } from 'lucide-react';

export default function Settings() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System Settings</h1>
        <p className="text-sm text-muted-foreground">Configure the Frame Sense pipeline integration environments.</p>
      </div>

      <div className="space-y-6">
        {/* API Settings */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" /> API Configuration
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">API Host Endpoint</label>
              <input 
                type="text" 
                defaultValue="http://localhost:8001/api/v1" 
                className="w-full bg-studio-900 border rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Request Timeout (ms)</label>
              <input 
                type="number" 
                defaultValue={15000} 
                className="w-full bg-studio-900 border rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Database Settings */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" /> Telemetry Database (ClickHouse)
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">ClickHouse Host</label>
              <input 
                type="text" 
                defaultValue="localhost" 
                disabled
                className="w-full bg-studio-900/50 border rounded px-3 py-1.5 text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Telemetry Database Name</label>
              <input 
                type="text" 
                defaultValue="frame_sense_telemetry" 
                disabled
                className="w-full bg-studio-900/50 border rounded px-3 py-1.5 text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">ClickHouse connectivity is currently disabled during initial boilerplate setup.</p>
        </div>

        {/* Agent Orchestrator Settings */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" /> Gemini Orchestration Model
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Primary Multimodal Model</label>
              <select 
                defaultValue="gemini-3.6-pro"
                disabled
                className="w-full bg-studio-900/50 border rounded px-3 py-1.5 text-sm text-muted-foreground cursor-not-allowed"
              >
                <option value="gemini-3.6-pro">Gemini 3.6 Pro (Recommended)</option>
                <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">System Prompt Mode</label>
              <select 
                defaultValue="strict"
                disabled
                className="w-full bg-studio-900/50 border rounded px-3 py-1.5 text-sm text-muted-foreground cursor-not-allowed"
              >
                <option value="strict">Strict Editorial</option>
                <option value="creative">Creative Feedback</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Gemini model selections are read-only until integration phase.</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2 rounded text-sm hover:bg-primary/95 transition-all">
          <Save className="h-4 w-4" /> Save Settings
        </button>
      </div>
    </div>
  );
}
