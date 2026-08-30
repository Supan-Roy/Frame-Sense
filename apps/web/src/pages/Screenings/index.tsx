import { Play, Plus, Film } from 'lucide-react';
import { Screening } from '@frame-sense/types';

const mockScreenings: Screening[] = [];

export default function Screenings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Test Screenings</h1>
          <p className="text-sm text-muted-foreground">Manage active projects and monitor viewer telemetry sessions.</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2 rounded text-sm hover:bg-primary/95 transition-all shadow-sm">
          <Plus className="h-4 w-4" /> New Screening
        </button>
      </div>

      {mockScreenings.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-studio-900 flex items-center justify-center text-muted-foreground">
            <Film className="h-6 w-6 text-primary/80" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="font-semibold text-foreground text-sm">No test screenings found</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upload a media file and configure a viewer telemetry session to begin tracking real-time audience engagement.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b bg-studio-950/50 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                <th className="p-4">Project Name</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Created Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {mockScreenings.map((s) => (
                <tr key={s.id} className="hover:bg-studio-900/10 transition-colors">
                  <td className="p-4 font-medium text-foreground">
                    <div>{s.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {Math.floor(s.durationSeconds / 60)}m {s.durationSeconds % 60}s
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <button className="inline-flex items-center gap-1.5 text-xs text-primary border border-primary/20 hover:bg-primary/10 rounded px-2.5 py-1 transition-all">
                      <Play className="h-3 w-3" /> View Sessions
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
