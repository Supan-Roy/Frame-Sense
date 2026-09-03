import type { Severity } from '@frame-sense/types';

interface SeverityBadgeProps {
  severity: Severity | 'HIGH' | 'MEDIUM' | 'LOW';
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const styles: Record<string, string> = {
    HIGH: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    CRITICAL: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    LOW: 'bg-blue-500/15 text-blue-400 border-blue-500/30'
  };

  const badgeStyle = styles[severity] || styles.LOW;

  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded ${badgeStyle}`}>
      {severity}
    </span>
  );
}
