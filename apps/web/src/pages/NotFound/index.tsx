import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Film, AlertOctagon, ArrowLeft, Clapperboard, Compass } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center text-center px-4 py-12 animate-fade-in relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* 404 Visual Icon Graphic & Clean Status Badge */}
      <div className="flex flex-col items-center mb-6 space-y-3">
        <div className="w-24 h-24 rounded-2xl bg-studio-900/90 border border-primary/30 flex items-center justify-center text-primary shadow-2xl shadow-primary/20 backdrop-blur-md relative">
          <Clapperboard className="w-12 h-12 stroke-[1.5] text-primary animate-pulse" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-[11px] font-semibold tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          HTTP 404 &bull; SCENE MISSING
        </div>
      </div>

      {/* Title & Description */}
      <div className="max-w-md space-y-3 mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground font-sans">
          Scene Not Found
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The timeline location or page route you entered doesn&apos;t exist in this cut. It may have been relocated or removed from the studio workspace.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]"
        >
          <LayoutDashboard className="w-4 h-4" />
          Go to Dashboard
        </Link>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-studio-900 border border-border text-foreground font-medium text-sm hover:bg-studio-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          Go Back
        </button>
      </div>

      {/* Quick Navigation Shortcuts */}
      <div className="w-full max-w-lg p-5 rounded-2xl bg-studio-900/60 border border-border/80 text-left space-y-3 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
          <Compass className="w-3.5 h-3.5 text-primary" /> Studio Quick Links
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <Link
            to="/screenings"
            className="flex items-center gap-2.5 p-2.5 rounded-lg bg-studio-950/60 border border-border/40 hover:border-primary/50 text-muted-foreground hover:text-foreground transition-all group"
          >
            <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <div className="font-medium text-foreground">Screening Room</div>
              <div className="text-[11px] text-muted-foreground">Manage active test cuts</div>
            </div>
          </Link>

          <Link
            to="/findings"
            className="flex items-center gap-2.5 p-2.5 rounded-lg bg-studio-950/60 border border-border/40 hover:border-primary/50 text-muted-foreground hover:text-foreground transition-all group"
          >
            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div>
              <div className="font-medium text-foreground">AI Findings</div>
              <div className="text-[11px] text-muted-foreground">Review audience anomalies</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
