import { useState, useEffect } from 'react';
import {
  Film, MousePointer, Activity, AlertTriangle, Sparkles,
  MessageSquare, Play, Pause, RotateCcw,
  Scissors, Users, Zap, Brain, Bot, User,
  Target, ArrowRight, ChevronRight, Eye
} from 'lucide-react';

export default function PipelineAnimation() {
  const [activeStage, setActiveStage] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackTime, setPlaybackTime] = useState<number>(0);
  const [chatMessageStep, setChatMessageStep] = useState<number>(0);

  // Simulated user click stream markers over the video canvas
  const [clicks, setClicks] = useState<Array<{ id: number; x: number; y: number; user: string; timecode: string; color: string }>>([
    { id: 1, x: 28, y: 35, user: "Viewer #104 (NYC)", timecode: "01:42", color: "#f43f5e" },
    { id: 2, x: 62, y: 48, user: "Viewer #88 (LA)", timecode: "01:42", color: "#f43f5e" },
    { id: 3, x: 45, y: 65, user: "Viewer #215 (LDN)", timecode: "02:15", color: "#f59e0b" },
    { id: 4, x: 78, y: 25, user: "Viewer #301 (PAR)", timecode: "01:42", color: "#3b82f6" },
  ]);

  // Auto-progress through pipeline stages 1 -> 2 -> 3 -> 4
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setActiveStage((prev) => (prev % 4) + 1);
    }, 4500);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Playhead scrubber simulation
  useEffect(() => {
    if (!isPlaying) return;

    const scrubberInterval = setInterval(() => {
      setPlaybackTime((prev) => (prev >= 100 ? 0 : prev + 1.2));
    }, 100);

    return () => clearInterval(scrubberInterval);
  }, [isPlaying]);

  // Trigger chat typing sequence when stage 4 is reached
  useEffect(() => {
    if (activeStage === 4) {
      setChatMessageStep(1);
      const timer1 = setTimeout(() => setChatMessageStep(2), 1200);
      const timer2 = setTimeout(() => setChatMessageStep(3), 2400);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else {
      setChatMessageStep(0);
    }
  }, [activeStage]);

  // Dynamic user click burst generator in Stage 1
  useEffect(() => {
    if (activeStage !== 1 || !isPlaying) return;

    const clickInterval = setInterval(() => {
      const users = ["Viewer #412 (SFO)", "Viewer #99 (TKO)", "Viewer #531 (BER)", "Viewer #77 (SYD)"];
      const colors = ["#f43f5e", "#10b981", "#3b82f6", "#f59e0b", "#06b6d4"];
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const newClick = {
        id: Date.now(),
        x: Math.floor(Math.random() * 70) + 15,
        y: Math.floor(Math.random() * 60) + 20,
        user: randomUser,
        timecode: "01:42",
        color: randomColor,
      };

      setClicks((prev) => [...prev.slice(-5), newClick]);
    }, 1100);

    return () => clearInterval(clickInterval);
  }, [activeStage, isPlaying]);

  return (
    <div className="rounded-2xl border border-primary/30 bg-zinc-950 p-5 md:p-6 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background ambient glowing gradients */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* HEADER BAR & CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800 pb-4 relative z-10">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-primary uppercase tracking-wider font-semibold">
            <Zap className="h-3.5 w-3.5 animate-pulse" />
            <span>Interactive Workflow Simulator</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] lowercase font-normal">
              live pipeline demo
            </span>
          </div>
          <h3 className="text-xl font-bold text-foreground mt-1 flex items-center gap-2">
            End-to-End Audience Behavioral &amp; Editorial Intelligence
          </h3>
        </div>

        {/* Playback Controls & Stage Selector Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-foreground transition-all flex items-center gap-1.5 text-xs font-semibold"
            title={isPlaying ? "Pause Simulator" : "Play Simulator"}
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">Pause</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Auto-Play</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              setActiveStage(1);
              setPlaybackTime(0);
            }}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-muted-foreground hover:text-foreground transition-all"
            title="Restart Workflow"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* 4 STAGE BUTTONS */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs font-medium overflow-x-auto">
            {[
              { num: 1, label: '01. Screening', icon: Eye, color: 'text-emerald-400' },
              { num: 2, label: '02. Anomaly', icon: AlertTriangle, color: 'text-amber-400' },
              { num: 3, label: '03. AI Cut', icon: Scissors, color: 'text-indigo-400' },
              { num: 4, label: '04. AI Co-Pilot', icon: MessageSquare, color: 'text-cyan-400' },
            ].map((stage) => {
              const IconComponent = stage.icon;
              const isActive = activeStage === stage.num;
              return (
                <button
                  key={stage.num}
                  onClick={() => setActiveStage(stage.num)}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-bold shadow-md scale-105'
                      : 'text-zinc-400 hover:text-foreground hover:bg-zinc-800/60'
                  }`}
                >
                  <IconComponent className={`h-3.5 w-3.5 ${isActive ? 'text-primary-foreground' : stage.color}`} />
                  <span>{stage.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* PIPELINE PROGRESS INDICATOR BAR */}
      <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden flex relative z-10">
        <div
          className="bg-gradient-to-r from-emerald-500 via-amber-500 to-cyan-500 h-full transition-all duration-300 rounded-full"
          style={{ width: `${(activeStage / 4) * 100}%` }}
        ></div>
      </div>

      {/* MAIN VIEWPORT: 2-COLUMN RICH INTERACTIVE STAGE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch relative z-10">
        
        {/* LEFT CANVAS: VIDEO PLAYER, USER CLICKS & ANOMALY ANALYSIS (8 COLS) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          
          {/* SIMULATED CINEMA PLAYER & INTERACTION LAYER */}
          <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-inner group min-h-[260px] flex flex-col justify-between">
            
            {/* Top Video Header HUD */}
            <div className="p-3 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-xs font-mono text-zinc-300 relative z-20">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>
                <span className="font-bold text-white">Project: The Last Horizon (Director's Cut)</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-emerald-400 flex items-center gap-1">
                  <Users className="h-3 w-3" /> 24 Live Viewers
                </span>
                <span className="text-indigo-400 font-bold bg-indigo-500/20 px-2 py-0.5 rounded">
                  TC [01:42.08]
                </span>
              </div>
            </div>

            {/* Simulated Video Canvas Frame (Scene Image + Dynamic Click Ripples) */}
            <div className="relative h-48 sm:h-56 w-full overflow-hidden bg-black flex items-center justify-center">
              <img
                src="/scene_01.png"
                alt="Simulated Screening Scene"
                className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40"></div>

              {/* STAGE 1: MULTIPLE USER CLICK PULSES & TELEMETRY MARKERS */}
              {activeStage === 1 && (
                <>
                  <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md border border-emerald-500/30 px-3 py-1.5 rounded-lg text-[11px] font-mono text-emerald-400 flex items-center gap-2 z-20 animate-fade-in">
                    <Activity className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                    <span>Stage 1: Multi-User Clicks &amp; Telemetry Stream Captured</span>
                  </div>

                  {clicks.map((click) => (
                    <div
                      key={click.id}
                      className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                      style={{ left: `${click.x}%`, top: `${click.y}%` }}
                    >
                      {/* Pulsating Ring */}
                      <span
                        className="absolute -inset-3 rounded-full opacity-75 animate-ping"
                        style={{ backgroundColor: click.color }}
                      ></span>

                      {/* Click Marker Pin */}
                      <div
                        className="relative p-1.5 rounded-full shadow-lg border border-white flex items-center justify-center cursor-pointer"
                        style={{ backgroundColor: click.color }}
                      >
                        <MousePointer className="h-3 w-3 text-white" />
                      </div>

                      {/* Tooltip User Badge */}
                      <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/90 text-white text-[9px] font-mono px-2 py-0.5 rounded border border-white/20 shadow-md backdrop-blur-sm z-30">
                        {click.user} • <span className="text-amber-300">{click.timecode}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* STAGE 2: ANOMALY TARGETING LOCK */}
              {activeStage === 2 && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/30 backdrop-blur-[1px] animate-fade-in">
                  <div className="relative border-2 border-rose-500 rounded-2xl p-6 shadow-[0_0_30px_rgba(244,63,94,0.5)] animate-pulse flex flex-col items-center justify-center text-center space-y-2 bg-black/80">
                    <Target className="h-8 w-8 text-rose-500 animate-spin" />
                    <div className="text-rose-400 font-mono font-bold text-xs uppercase tracking-wider">
                      Anomaly Detected at [01:42]
                    </div>
                    <div className="text-white text-xs font-semibold max-w-xs">
                      42% Drop-off &amp; 3.2x Pause Frequency (8.4s Static Wide Shot)
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30">
                      Statistical Confidence: 99.4%
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 3: AI CUT SCANNER LASER OVERLAY */}
              {activeStage === 3 && (
                <div className="absolute inset-0 z-20 pointer-events-none">
                  {/* Laser Scan Bar */}
                  <div className="absolute top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-400 via-sky-300 to-cyan-400 shadow-[0_0_20px_#818cf8] animate-laser-scan-side"></div>
                  
                  <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md border border-indigo-500/40 px-3 py-1.5 rounded-lg text-[11px] font-mono text-indigo-300 flex items-center gap-2 z-20">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
                    <span>Stage 3: Multimodal Vision Keyframe Inspection</span>
                  </div>

                  <div className="absolute bottom-3 right-3 bg-indigo-950/90 text-indigo-200 border border-indigo-500/40 px-3 py-1.5 rounded-lg text-[10px] font-mono shadow-lg backdrop-blur-sm">
                    AI Pacing Score: <span className="text-emerald-400 font-bold">92/100</span>
                  </div>
                </div>
              )}

              {/* STAGE 4: CO-PILOT SYNC HIGHLIGHT */}
              {activeStage === 4 && (
                <div className="absolute inset-0 z-20 bg-cyan-950/20 backdrop-blur-[1px] border-2 border-cyan-500/40 rounded-xl flex items-end p-3">
                  <div className="bg-black/90 border border-cyan-500/40 px-3 py-1.5 rounded-lg text-[11px] font-mono text-cyan-300 flex items-center gap-2 shadow-lg">
                    <MessageSquare className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                    <span>Timecode Anchored Chat Session Active @ [01:42]</span>
                  </div>
                </div>
              )}
            </div>

            {/* Video Scrubber & Playhead Controls */}
            <div className="p-3 bg-zinc-950 border-t border-zinc-800 space-y-2 relative z-20">
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Film className="h-3 w-3" /> Scene 01 Cut
                </span>
                <span>00:00 / 03:45</span>
              </div>

              {/* Scrubber Bar */}
              <div className="relative w-full h-2 bg-zinc-800 rounded-full overflow-hidden cursor-pointer">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-cyan-500 transition-all duration-100"
                  style={{ width: `${playbackTime}%` }}
                ></div>
                {/* Anomaly Marker at 45% position */}
                <div
                  className="absolute top-0 bottom-0 w-2 bg-rose-500 rounded-full animate-ping"
                  style={{ left: '45%' }}
                  title="Anomaly Drop-off [01:42]"
                ></div>
              </div>
            </div>
          </div>

          {/* DYNAMIC CAPABILITY STATUS CARD */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Brain className="h-4 w-4 text-primary" />
                Pipeline State Engine
              </span>
              <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Stage 0{activeStage} Active
              </span>
            </div>

            {activeStage === 1 && (
              <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                <strong className="text-emerald-400">1. Audience Screening &amp; Interaction Recording:</strong> Viewers interact with the screening video. Frame Sense captures playbacks, pause spots, timeline seeking, and reaction clicks with frame-level precision.
              </p>
            )}

            {activeStage === 2 && (
              <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                <strong className="text-amber-400">2. Intelligence Ingestion &amp; Anomaly Detection:</strong> Statistical algorithms audit sub-second viewer interactions against baselines, flagging pacing drop-offs and cognitive friction at timestamp <code className="text-amber-300 font-mono">[01:42]</code>.
              </p>
            )}

            {activeStage === 3 && (
              <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                <strong className="text-indigo-400">3. Multimodal Vision &amp; Cut Suggestions:</strong> Gemini AI analyzes the keyframe optical flow at timestamp <code className="text-indigo-300 font-mono">[01:42]</code>, recommending a precise 4.2s trim to restore pacing momentum.
              </p>
            )}

            {activeStage === 4 && (
              <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                <strong className="text-cyan-400">4. Timecode-Anchored AI Co-Pilot Chat:</strong> Film directors and editors interact with the AI assistant in real time. Questions regarding the screening are answered with direct timecode references.
              </p>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: TIME-ANCHORED EDITORIAL CO-PILOT CHAT & AI SUGGESTION CARD (5 COLS) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          
          {/* AI EDITORIAL CUT RECOMMENDATION CARD (STAGE 3 & 4 SHOWCASE) */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 space-y-3 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-indigo-300 flex items-center gap-1.5">
                <Scissors className="h-3.5 w-3.5 text-indigo-400" />
                AI Cut Recommendation
              </span>
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold border border-emerald-500/30">
                +28% Retention Impact
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-bold text-white flex items-center justify-between">
                <span>Trim Dialogue Silence</span>
                <span className="font-mono text-indigo-300 text-[11px]">[01:42.00 - 01:46.20]</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                "Trim 4.2 seconds of static wide shot holding without character dialogue to transition immediately to reaction shot."
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-indigo-500/20 text-[11px] font-mono text-zinc-400">
              <span>Confidence: <strong className="text-emerald-400">98.4%</strong></span>
              <button className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-xs font-medium transition-all shadow flex items-center gap-1">
                <span>Apply Cut</span>
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* TIME-ANCHORED CO-PILOT CHAT SESSION */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-4 flex flex-col justify-between space-y-3 flex-1 shadow-inner relative overflow-hidden min-h-[280px]">
            {/* Chat Room Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Editorial AI Co-Pilot</div>
                  <div className="text-[10px] text-zinc-400 font-mono">Screening Session #104</div>
                </div>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
            </div>

            {/* Chat Message Thread */}
            <div className="space-y-3 py-1 flex-1 overflow-y-auto max-h-[220px] text-xs font-sans">
              
              {/* Director Question */}
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-full bg-zinc-800 text-zinc-300 shrink-0 border border-zinc-700">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="bg-zinc-800/90 border border-zinc-700/80 p-3 rounded-2xl rounded-tl-none text-zinc-200 space-y-1 max-w-[88%] shadow-sm">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                    <span className="font-bold text-primary">Director</span>
                    <span>10:42 AM</span>
                  </div>
                  <p>
                    Why did audience retention drop suddenly around timestamp <span className="text-cyan-300 font-mono font-bold hover:underline cursor-pointer">[01:42]</span> in Scene 01?
                  </p>
                </div>
              </div>

              {/* AI Co-Pilot Streaming Answer */}
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-full bg-cyan-500/20 text-cyan-400 shrink-0 border border-cyan-500/30">
                  <Sparkles className="h-3.5 w-3.5 animate-spin" />
                </div>
                <div className="bg-cyan-950/40 border border-cyan-500/30 p-3 rounded-2xl rounded-tl-none text-cyan-100 space-y-1.5 max-w-[88%] shadow-sm">
                  <div className="flex items-center justify-between text-[10px] text-cyan-400 font-mono">
                    <span className="font-bold flex items-center gap-1">
                      <Bot className="h-3 w-3" /> Frame Sense AI
                    </span>
                    <span>Just Now</span>
                  </div>

                  {activeStage === 4 && chatMessageStep === 1 ? (
                    <div className="flex items-center gap-1 py-1 text-cyan-400 text-xs font-mono">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                      <span>Analyzing audience telemetry &amp; keyframes...</span>
                    </div>
                  ) : (
                    <>
                      <p className="leading-relaxed">
                        At <strong className="text-cyan-300 font-mono">[01:42]</strong>, telemetry recorded a 42% retention drop and 3.2x pause spike across 24 viewers. Multimodal vision analysis detected an 8.4s static wide shot with dialogue silence.
                      </p>
                      <div className="pt-1 flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30 font-semibold">
                          Suggested Cut: Trim 4.2s
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Simulated Chat Input Box */}
            <div className="pt-2 border-t border-zinc-800 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={activeStage === 4 ? "Asking AI Co-Pilot about Scene 01..." : "Ask AI Co-Pilot about screening..."}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-400 font-sans focus:outline-none"
              />
              <button className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-semibold">
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
