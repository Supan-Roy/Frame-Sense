import { Scissors, Play, Sparkles } from 'lucide-react';
import type { EditCue } from '@frame-sense/types';
import { SeverityBadge } from '../screenings/SeverityBadge';

interface EditorialCueCardProps {
  cue: EditCue;
  isActive: boolean;
  onSelectTimecode: (sec: number) => void;
  onInvestigate: (cue: EditCue) => void;
  onToggleEdl: (cueId: string) => void;
}

export function EditorialCueCard({
  cue,
  isActive,
  onSelectTimecode,
  onInvestigate,
  onToggleEdl
}: EditorialCueCardProps) {
  const isBrollOrAudio = cue.category === 'NARRATIVE_BROLL' || cue.category === 'AUDIO_DUCKING';

  return (
    <div
      className={`group border rounded-xl p-5 transition-all bg-studio-900/40 hover:bg-studio-900/70 ${
        isActive ? 'border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20' : 'border-white/10 hover:border-white/20'
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onSelectTimecode(cue.time_start_sec)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-studio-950 border border-white/15 text-xs font-mono font-bold text-sky-300 hover:text-sky-200 hover:border-sky-500/40 transition-all cursor-pointer"
          >
            <Play className="h-3 w-3 fill-sky-300" />
            <span>{cue.timecode_start}</span>
            <span className="text-muted-foreground font-normal">&ndash;</span>
            <span>{cue.timecode_end}</span>
          </button>
          <span
            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border uppercase tracking-wider ${
              isBrollOrAudio ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            {cue.category_label}
          </span>
          <SeverityBadge severity={cue.severity} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onToggleEdl(cue.id)}
            className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
              cue.markedForEdl
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-studio-950 text-muted-foreground border-white/10 hover:text-foreground hover:border-white/20'
            }`}
          >
            {cue.markedForEdl ? 'Marked for EDL' : '+ Add to EDL'}
          </button>
          <button
            onClick={() => onInvestigate(cue)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Investigate</span>
          </button>
        </div>
      </div>

      <h4 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
        <Scissors className="h-4 w-4 text-primary shrink-0" />
        <span>{cue.editing_action}</span>
      </h4>

      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
        {cue.editorial_tip}
      </p>

      {cue.evidence && cue.evidence.length > 0 && (
        <div className="bg-studio-950/60 border border-white/5 rounded-lg p-3 text-[11px] font-mono text-muted-foreground space-y-1">
          {cue.evidence.map((ev, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-sky-400 font-bold">•</span>
              <span>{ev}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
