import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft, Scale, ShieldAlert, Cpu, Award } from 'lucide-react';

export default function TermsOfService() {
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
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Terms of Service</h1>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              Effective Date: September 6, 2026 &bull; Version 1.2
            </p>
          </div>
        </div>
      </div>

      {/* Highlights Box */}
      <div className="p-5 rounded-xl bg-studio-900/80 border border-border/80 space-y-3">
        <div className="flex items-center gap-2 text-xs font-mono font-semibold text-primary uppercase tracking-wider">
          <FileText className="h-4 w-4" /> Platform Terms Highlights
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Welcome to Frame Sense. By accessing our studio analytics dashboard, embedding test-screening players, or operating our autonomous agentic workflows, you agree to comply with the terms set forth below.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-lg bg-studio-950/60 border border-border/40 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
              <Award className="h-3.5 w-3.5 text-amber-400" /> Full Asset Ownership
            </div>
            <p className="text-[11px] text-muted-foreground">You retain 100% intellectual property rights over all uploaded video cuts, scripts, and generated reports.</p>
          </div>
          <div className="p-3 rounded-lg bg-studio-950/60 border border-border/40 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
              <Cpu className="h-3.5 w-3.5 text-blue-400" /> Human Editorial Authority
            </div>
            <p className="text-[11px] text-muted-foreground">AI recommendations and Gemini vision findings serve as analytical aids; final edit decisions remain human-controlled.</p>
          </div>
          <div className="p-3 rounded-lg bg-studio-950/60 border border-border/40 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
              <ShieldAlert className="h-3.5 w-3.5 text-emerald-400" /> Reliable Analytics
            </div>
            <p className="text-[11px] text-muted-foreground">Engineered with Laplace smoothing and Wilson LCB math to eliminate 100% false alarms in audience retention tracking.</p>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="space-y-8 text-xs leading-relaxed text-muted-foreground border-t border-border/40 pt-6">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="text-primary font-mono text-xs">01.</span> Agreement &amp; Acceptance of Terms
          </h2>
          <p>
            By accessing or using Frame Sense ("the Platform"), including its screening player web interfaces, ClickHouse analytics pipelines, and studio AI assistant endpoints, you agree to be bound by these Terms of Service. If you do not agree to these terms, you must not access or use the Platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="text-primary font-mono text-xs">02.</span> Permitted Studio &amp; Editorial Use
          </h2>
          <p>
            Frame Sense is intended for professional film studios, post-production editors, screening coordinators, and content creators. Users agree to:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground/90">
            <li>Deploy public test-screening links only to intended test audiences or internal feedback groups.</li>
            <li>Maintain valid API credentials for optional cloud AI integrations (such as Gemini API keys).</li>
            <li>Refrain from attempting to reverse-engineer telemetry streaming protocols or execute malicious SQL injections against the ClickHouse analytical database.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="text-primary font-mono text-xs">03.</span> Intellectual Property &amp; Video Rights
          </h2>
          <p>
            All media uploaded to or processed through Frame Sense—including raw video files, rough cuts, fine edits, frame extractions, audio tracks, and exported PDF reports—remain the exclusive property of the respective studio or content creator. Frame Sense claims zero ownership over your creative work.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="text-primary font-mono text-xs">04.</span> Autonomous Agent Findings &amp; AI Disclaimer
          </h2>
          <p>
            Frame Sense provides agentic intelligence, keyframe visual extraction, and automated editorial findings using statistical algorithms (Laplace smoothing, Wilson LCB score lower bounds) and multimodal vision models.
          </p>
          <p>
            While these tools provide high-precision insights into audience retention drops and emotional scene replay hotspots, recommendations generated by the Platform are advisory in nature. Final creative authority and editorial decisions remain under the sole judgment of the human film director and editing team.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="text-primary font-mono text-xs">05.</span> Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by applicable law, Frame Sense and its developers shall not be held liable for any direct, indirect, incidental, or consequential damages resulting from lost box-office revenue, editorial decisions made based on telemetry findings, or temporary service interruptions during live screenings.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="text-primary font-mono text-xs">06.</span> Modifications &amp; Updates
          </h2>
          <p>
            We reserve the right to update or modify these Terms of Service at any time to reflect software upgrades, regulatory requirements, or new agentic workspace capabilities. Continued usage of the Platform following published updates constitutes acceptance of the revised terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="text-primary font-mono text-xs">07.</span> Contact &amp; Legal Inquiries
          </h2>
          <p>
            For legal inquiries, licensing questions, or studio agreement details, please contact:
          </p>
          <div className="p-3 bg-studio-900 rounded-lg font-mono text-[11px] text-foreground flex items-center justify-between">
            <span>Email: legal@supanroy.com</span>
            <span className="text-muted-foreground">Frame Sense Legal &amp; Licensing</span>
          </div>
        </section>
      </div>

      {/* Footer Navigation Back */}
      <div className="border-t border-border/40 pt-6 flex items-center justify-between text-xs font-mono">
        <Link to="/" className="text-primary hover:underline flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Return to Dashboard
        </Link>
        <Link to="/privacy" className="text-muted-foreground hover:text-foreground">
          View Privacy Policy &rarr;
        </Link>
      </div>
    </div>
  );
}
