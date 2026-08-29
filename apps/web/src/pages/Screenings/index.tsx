import { Play, Plus } from 'lucide-react';
import { Screening } from '@frame-sense/types';

const mockScreenings: Screening[] = [
  {
    id: "sc_1",
    title: "Apex Horizon - Directors Cut v3",
    description: "Main test screening with focus group A.",
    durationSeconds: 7200,
    createdAt: "2026-08-28T14:30:00Z",
    updatedAt: "2026-08-28T16:00:00Z"
  },
  {
    id: "sc_2",
    title: "Project Zero - Teaser Trailer v1.2",
    description: "Audience pacing check on the 60s teaser trailer.",
    durationSeconds: 65,
    createdAt: "2026-08-27T09:15:00Z",
    updatedAt: "2026-08-27T10:00:00Z"
  }
];

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
    </div>
  );
}
