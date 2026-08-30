import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Film, Eye, AlertCircle } from 'lucide-react';

// Helper to get or create a persistent anonymous viewer ID
function getOrCreateViewerId(): string {
  let id = localStorage.getItem('fs_anonymous_viewer_id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('fs_anonymous_viewer_id', id);
  }
  return id;
}

interface ScreeningInfo {
  screening_id: string;
  media_id: string;
  title: string;
  description: string | null;
  media_duration: number;
  created_at: string;
}

export default function ScreeningRoom() {
  const { token } = useParams<{ token: string }>();
  const [screening, setScreening] = useState<ScreeningInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<string>(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
  const viewerIdRef = useRef<string>(getOrCreateViewerId());
  
  // Track seek start positions
  const lastTimeRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);
  
  // Batch event queue
  const eventQueueRef = useRef<any[]>([]);
  const progressIntervalRef = useRef<any>(null);
  const batchIntervalRef = useRef<any>(null);

  // Load screening details
  useEffect(() => {
    async function fetchScreening() {
      try {
        setLoading(true);
        const res = await fetch(`/api/v1/screening/${token}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Invalid or expired screening link.");
        }
        const data = await res.json();
        setScreening(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Invalid or expired screening link.");
      } finally {
        setLoading(false);
      }
    }
    if (token) {
      fetchScreening();
    }
  }, [token]);

  // Queue up telemetry events
  const queueEvent = (type: string, timecode: number) => {
    if (!screening) return;
    
    const event = {
      event_id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      screening_id: screening.screening_id,
      session_id: sessionRef.current,
      anonymous_viewer_id: viewerIdRef.current,
      video_id: screening.media_id,
      event_type: type,
      video_timecode_sec: Math.round(timecode * 100) / 100, // round to 2 decimal places
      client_timestamp: new Date().toISOString()
    };
    
    eventQueueRef.current.push(event);
    
    // Flush immediately for high-priority lifecycle events
    if (["PLAY", "PAUSE", "COMPLETE", "EXIT"].includes(type)) {
      flushQueue();
    }
  };

  // Send queued events to FastAPI backend
  const flushQueue = async () => {
    if (eventQueueRef.current.length === 0) return;
    
    const batch = [...eventQueueRef.current];
    eventQueueRef.current = []; // Clear queue immediately to avoid double sending
    
    try {
      const res = await fetch('/api/v1/telemetry/events/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ events: batch })
      });
      if (!res.ok) throw new Error("HTTP error " + res.status);
    } catch (err) {
      // Put back events to retry on failure
      eventQueueRef.current = [...batch, ...eventQueueRef.current];
      console.error("Failed to upload telemetry batch:", err);
    }
  };

  // Telemetry event tracking listeners
  useEffect(() => {
    if (!screening) return;

    // Send initial join event
    queueEvent("TAB_VISIBLE", 0);

    // Periodic queue flushing every 5 seconds
    batchIntervalRef.current = setInterval(() => {
      flushQueue();
    }, 5000);

    // Visibility change tracker
    const handleVisibilityChange = () => {
      if (document.hidden) {
        queueEvent("TAB_HIDDEN", videoRef.current?.currentTime || 0);
      } else {
        queueEvent("TAB_VISIBLE", videoRef.current?.currentTime || 0);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Window exit/unload tracker
    const handleUnload = () => {
      const timecode = videoRef.current?.currentTime || 0;
      const exitEvent = {
        event_id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        screening_id: screening.screening_id,
        session_id: sessionRef.current,
        anonymous_viewer_id: viewerIdRef.current,
        video_id: screening.media_id,
        event_type: "EXIT",
        video_timecode_sec: Math.round(timecode * 100) / 100,
        client_timestamp: new Date().toISOString()
      };
      
      // Attempt best-effort beacon dispatch for page unloads
      const blob = new Blob([JSON.stringify({ events: [exitEvent] })], { type: "application/json" });
      navigator.sendBeacon("/api/v1/telemetry/events/batch", blob);
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(batchIntervalRef.current);
      clearInterval(progressIntervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [screening]);

  // Video element playback event handlers
  const handlePlay = () => {
    queueEvent("PLAY", videoRef.current?.currentTime || 0);
    
    // Start progress interval heartbeat every 5 seconds during active play
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        queueEvent("PROGRESS", videoRef.current.currentTime);
      }
    }, 5000);
  };

  const handlePause = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    // Ignore pause events triggered at the exact end of video
    if (videoRef.current && videoRef.current.currentTime < videoRef.current.duration) {
      queueEvent("PAUSE", videoRef.current.currentTime);
    }
  };

  const handleVolumeChange = () => {
    queueEvent("VOLUME_CHANGE", videoRef.current?.currentTime || 0);
  };

  const handleEnded = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    queueEvent("COMPLETE", videoRef.current?.duration || 0);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    
    // Check if a manual seek occurred
    const delta = videoRef.current.currentTime - lastTimeRef.current;
    if (Math.abs(delta) > 1.5 && !isSeekingRef.current) {
      isSeekingRef.current = true;
      if (delta > 0) {
        queueEvent("SEEK_FORWARD", videoRef.current.currentTime);
      } else {
        queueEvent("SEEK_BACKWARD", videoRef.current.currentTime);
        // If they rewound by a meaningful amount (more than 5s), log as a REPLAY
        if (Math.abs(delta) > 5) {
          queueEvent("REPLAY", videoRef.current.currentTime);
        }
      }
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 500);
    }
    lastTimeRef.current = videoRef.current.currentTime;
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-studio-950 text-foreground">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <div className="text-xs text-muted-foreground tracking-wider uppercase">Loading Screening...</div>
        </div>
      </div>
    );
  }

  if (error || !screening) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-studio-950 text-foreground">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-studio-900 flex items-center justify-center text-rose-500">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Screening Access Failed</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {error || "The link you clicked is invalid, has expired, or is currently deactivated."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-studio-950 text-foreground font-sans">
      {/* View Header */}
      <header className="border-b border-border/40 bg-studio-950/80 backdrop-blur-md px-6 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Film className="h-5 w-5 text-primary" />
          <div>
            <h1 className="font-semibold text-sm tracking-wide text-foreground uppercase">{screening.title}</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Focus Group Screening Room</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-studio-900/60 px-3 py-1.5 rounded-full border border-border/40">
          <Eye className="h-3.5 w-3.5 text-primary animate-pulse" />
          <span>Active Telemetry Hooked</span>
        </div>
      </header>

      {/* Main cinematic content area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-4xl w-full space-y-6">
          {/* Research Banner Notice */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-3">
            <div className="p-1.5 bg-primary/10 rounded text-primary">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">Viewer Telemetry In Progress</div>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                Anonymous playback interaction data is being recorded to assist filmmakers in structural editing. No personal information is collected.
              </p>
            </div>
          </div>

          {/* HTML5 Video Player Container */}
          <div className="aspect-video w-full rounded-xl overflow-hidden border border-border/80 bg-black shadow-2xl relative">
            <video
              ref={videoRef}
              src={`/api/v1/screening/${token}/media`}
              controls
              preload="auto"
              className="w-full h-full object-contain"
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handleEnded}
              onTimeUpdate={handleTimeUpdate}
              onVolumeChange={handleVolumeChange}
            />
          </div>

          {/* Media Info Metadata details */}
          <div className="bg-studio-900/40 border border-border/40 rounded-xl p-6 space-y-3">
            <h2 className="font-semibold text-foreground text-md uppercase tracking-wider">{screening.title}</h2>
            {screening.description ? (
              <p className="text-xs text-muted-foreground leading-relaxed">{screening.description}</p>
            ) : (
              <p className="text-xs text-muted-foreground italic">No description provided.</p>
            )}
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground uppercase tracking-widest pt-2 border-t border-border/30">
              <div>Duration: {Math.floor(screening.media_duration / 60)}m {Math.round(screening.media_duration % 60)}s</div>
              <div>Published: {new Date(screening.created_at).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
