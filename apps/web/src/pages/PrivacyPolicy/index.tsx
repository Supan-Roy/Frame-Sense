import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Lock, Database, Eye, RefreshCw, FileText } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 animate-fade-in">
      {/* Header & Navigation */}
      <div className="space-y-4">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              Effective Date: September 6, 2026 &bull; Version 1.2
            </p>
          </div>
        </div>
      </div>

      {/* Summary Box */}
      <div className="p-5 rounded-xl bg-studio-900/80 border border-border/80 space-y-3">
        <div className="flex items-center gap-2 text-xs font-mono font-semibold text-primary uppercase tracking-wider">
          <Lock className="h-4 w-4" /> Privacy Summary &amp; Guarantees
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Frame Sense is an autonomous post-production intelligence workspace designed to analyze audience engagement telemetry for film test screenings. We respect your studio data privacy, video asset ownership, and viewer metrics.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-lg bg-studio-950/60 border border-border/40 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
              <Eye className="h-3.5 w-3.5 text-blue-400" /> Telemetry Isolation
            </div>
            <p className="text-[11px] text-muted-foreground">Viewer telemetry is processed strictly for real-time editorial analytics within your workspace.</p>
          </div>
          <div className="p-3 rounded-lg bg-studio-950/60 border border-border/40 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
              <Database className="h-3.5 w-3.5 text-emerald-400" /> High-Security Storage
            </div>
            <p className="text-[11px] text-muted-foreground">High-throughput ClickHouse OLAP &amp; local SQLite indices store aggregated session markers.</p>
          </div>
          <div className="p-3 rounded-lg bg-studio-950/60 border border-border/40 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
              <RefreshCw className="h-3.5 w-3.5 text-purple-400" /> Full Data Control
            </div>
            <p className="text-[11px] text-muted-foreground">Studio admins retain full authority to reset analytics or permanently purge screening history.</p>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="space-y-8 text-xs leading-relaxed text-muted-foreground border-t border-border/40 pt-6">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="text-primary font-mono text-xs">01.</span> Information We Collect
          </h2>
          <p>
            When you conduct test-screenings or interact with the Frame Sense platform, we gather specific categories of telemetry and configuration data:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground/90">
            <li><strong className="text-foreground">Viewer Session Trajectory Data:</strong> Playback timestamps, scrub movements, rewinds, scene exit markers, pause events, and device viewport metadata transmitted during screening sessions.</li>
            <li><strong className="text-foreground">Video Metadata &amp; Frame Extracts:</strong> Video duration, framerate, structural visual keyframes, and audio energy features processed by our automated agentic pipeline (e.g., multimodal Gemini Vision analysis).</li>
            <li><strong className="text-foreground">Studio Configuration:</strong> Workspace settings, custom retention threshold parameters, ClickHouse endpoint references, and API key credentials (stored securely in local environment variables).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="text-primary font-mono text-xs">02.</span> How We Use Telemetry &amp; Intelligence
          </h2>
          <p>
            All collected telemetry is exclusively utilized to power the post-production intelligence engine:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground/90">
            <li>Calculating Laplace-smoothed event rates and Wilson lower confidence bounds (LCB) for statistical anomaly detection.</li>
            <li>Identifying critical scene exits vs. high-engagement replay hotspots along the video timeline.</li>
            <li>Generating automated editorial findings and recommended director edit actions.</li>
            <li>Powering natural language studio chat assistance with real-time screening context.</li>
          </ul>
          <p className="text-emerald-400/90 text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
            Guaranteed: We DO NOT sell, monetize, or transfer viewer telemetry or confidential video cuts to any third-party data broker.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="text-primary font-mono text-xs">03.</span> Data Protection &amp; Security Architecture
          </h2>
          <p>
            Frame Sense implements robust security practices to safeguard test-screening assets:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground/90">
            <li><strong className="text-foreground">Tokenized Access:</strong> Screening rooms utilize cryptographically secure UUID screening tokens to prevent unauthorized viewing.</li>
            <li><strong className="text-foreground">Storage Encryption:</strong> ClickHouse OLAP databases and local metadata SQLite tables reside within secured, access-controlled studio networks.</li>
            <li><strong className="text-foreground">Offline Resiliency:</strong> In the event of network disruption, Frame Sense synchronizes via local JSON fallback stores to guarantee zero data loss without exposing external endpoints.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="text-primary font-mono text-xs">04.</span> Data Retention &amp; Deletion Rights
          </h2>
          <p>
            As a studio administrator, you maintain complete data sovereignty over your screening workspace:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground/90">
            <li><strong className="text-foreground">Analytics Reset:</strong> Wipes aggregated ClickHouse viewer events, triggers physical table compaction (<code className="text-primary bg-studio-900 px-1 py-0.5 rounded">OPTIMIZE TABLE... FINAL CLEANUP</code>), and resets screening counters.</li>
            <li><strong className="text-foreground">Screening Deletion:</strong> Permanently removes specific film cuts, associated findings, and stored frame extracts from the workspace repository.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="text-primary font-mono text-xs">05.</span> Contact &amp; Studio Inquiries
          </h2>
          <p>
            If you have questions regarding data privacy, security compliance, or custom studio deployments, contact our post-production support team at:
          </p>
          <div className="p-3 bg-studio-900 rounded-lg font-mono text-[11px] text-foreground flex items-center justify-between">
            <span>Email: privacy@supanroy.com</span>
            <span className="text-muted-foreground">Frame Sense Engineering</span>
          </div>
        </section>
      </div>

      {/* Footer Navigation Back */}
      <div className="border-t border-border/40 pt-6 flex items-center justify-between text-xs font-mono">
        <Link to="/" className="text-primary hover:underline flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Return to Dashboard
        </Link>
        <Link to="/terms" className="text-muted-foreground hover:text-foreground">
          View Terms of Service &rarr;
        </Link>
      </div>
    </div>
  );
}
