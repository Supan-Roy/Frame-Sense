import { CircleDot } from 'lucide-react';
import type { Reliability } from '@frame-sense/types';

interface ReliabilityBadgeProps {
  reliability: Reliability;
}

export function ReliabilityBadge({ reliability }: ReliabilityBadgeProps) {
  const styles: Record<string, string> = {
    INSUFFICIENT_DATA: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    PRELIMINARY_SIGNAL: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    SUFFICIENT_SIGNAL: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    STRONG_SIGNAL: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  };

  const badgeStyle = styles[reliability.status] || styles.PRELIMINARY_SIGNAL;

  return (
    <div className={`flex items-center gap-1.5 text-[10px] border px-2.5 py-1 rounded-full w-fit ${badgeStyle}`}>
      <CircleDot className="h-3 w-3" />
      <span>{reliability.label}</span>
    </div>
  );
}
