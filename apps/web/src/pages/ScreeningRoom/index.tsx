import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Film, Eye, AlertCircle, Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

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

  // Player DOM references
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const seekbarRef = useRef<HTMLDivElement | null>(null);

  // Player state variables
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Custom scrubbing/hover preview state
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isHoveringSeek, setIsHoveringSeek] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number>(0);

  // Overlay visibility tracker
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<any>(null);

  // Telemetry session references
  const sessionRef = useRef<string>(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
  const viewerIdRef = useRef<string>(getOrCreateViewerId());
  const eventQueueRef = useRef<any[]>([]);
  const progressIntervalRef = useRef<any>(null);
  const batchIntervalRef = useRef<any>(null);

  // Load screening info
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

  // Queue and flush telemetry events
  const queueEvent = (type: string, timecode: number) => {
    if (!screening) return;
    
    const event = {
      event_id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      screening_id: screening.screening_id,
      session_id: sessionRef.current,
      anonymous_viewer_id: viewerIdRef.current,
      video_id: screening.media_id,
      event_type: type,
      video_timecode_sec: Math.round(timecode * 100) / 100,
      client_timestamp: new Date().toISOString()
    };
    
    eventQueueRef.current.push(event);
    
    if (["PLAY", "PAUSE", "COMPLETE", "EXIT"].includes(type)) {
      flushQueue();
    }
  };

  const flushQueue = async () => {
    if (eventQueueRef.current.length === 0) return;
    
    const batch = [...eventQueueRef.current];
    eventQueueRef.current = [];
    
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
      eventQueueRef.current = [...batch, ...eventQueueRef.current];
      console.error("Failed to upload telemetry batch:", err);
    }
  };

  // Telemetry loop initialization
  useEffect(() => {
    if (!screening) return;

    queueEvent("TAB_VISIBLE", 0);

    batchIntervalRef.current = setInterval(() => {
      flushQueue();
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        queueEvent("TAB_HIDDEN", videoRef.current?.currentTime || 0);
      } else {
        queueEvent("TAB_VISIBLE", videoRef.current?.currentTime || 0);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

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

  // Synchronize state and trigger player heartbeats
  const onPlayStatusChange = (playing: boolean) => {
    setIsPlaying(playing);
    if (playing) {
      queueEvent("PLAY", videoRef.current?.currentTime || 0);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = setInterval(() => {
        if (videoRef.current && !videoRef.current.paused) {
          queueEvent("PROGRESS", videoRef.current.currentTime);
        }
      }, 5000);
    } else {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (videoRef.current && videoRef.current.currentTime < videoRef.current.duration) {
        queueEvent("PAUSE", videoRef.current.currentTime);
      }
    }
  };

  // Playback Control Handlers
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      onPlayStatusChange(false);
    } else {
      videoRef.current.play().then(() => {
        onPlayStatusChange(true);
      }).catch(console.error);
    }
  };

  const skipTime = (amount: number) => {
    if (!videoRef.current) return;
    let target = videoRef.current.currentTime + amount;
    if (target < 0) target = 0;
    if (target > duration) target = duration;
    
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    queueEvent(amount > 0 ? "SEEK_FORWARD" : "SEEK_BACKWARD", target);
    if (amount < -5) {
      queueEvent("REPLAY", target);
    }
  };

  const handleVolumeSlide = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
    queueEvent("VOLUME_CHANGE", videoRef.current?.currentTime || 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    videoRef.current.muted = nextMute;
    if (!nextMute && volume === 0) {
      setVolume(0.5);
      videoRef.current.volume = 0.5;
    }
    queueEvent("VOLUME_CHANGE", videoRef.current.currentTime);
  };

  const handleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(console.error);
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFSChange);
    return () => document.removeEventListener("fullscreenchange", handleFSChange);
  }, []);

  // Time formatting helper (hh:mm:ss or mm:ss)
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    
    const mStr = m < 10 ? `0${m}` : `${m}`;
    const sStr = s < 10 ? `0${s}` : `${s}`;
    
    if (h > 0) {
      return `${h}:${mStr}:${sStr}`;
    }
    return `${mStr}:${sStr}`;
  };

  // Video metadata loading hooks
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || isScrubbing) return;
    setCurrentTime(videoRef.current.currentTime);
    
    // Check for complete event
    if (videoRef.current.currentTime >= videoRef.current.duration) {
      queueEvent("COMPLETE", videoRef.current.duration);
    }
  };

  // Custom Seekbar Scrubbing and Preview Tooltip Logic
  const getSeekTimeFromX = (clientX: number): number => {
    if (!seekbarRef.current) return 0;
    const rect = seekbarRef.current.getBoundingClientRect();
    const percent = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    return percent * duration;
  };

  const handleSeekMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!seekbarRef.current) return;
    setIsHoveringSeek(true);

    const time = getSeekTimeFromX(e.clientX);
    setHoverTime(time);

    // Sync preview video currentTime to fetch frames
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = time;
    }

    if (isScrubbing) {
      setScrubTime(time);
    }
  };

  const handleSeekMouseLeave = () => {
    setIsHoveringSeek(false);
    setHoverTime(null);
  };

  const handleSeekMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    const time = getSeekTimeFromX(e.clientX);
    setScrubTime(time);
    
    // Pause main playback during active scrubbing to prevent lag
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
    }
  };

  // Execute actual seek only upon releasing scrub drag
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (!isScrubbing) return;
      setIsScrubbing(false);
      
      if (videoRef.current) {
        const delta = scrubTime - videoRef.current.currentTime;
        videoRef.current.currentTime = scrubTime;
        setCurrentTime(scrubTime);
        
        // Log telemetry seeking event
        queueEvent(delta > 0 ? "SEEK_FORWARD" : "SEEK_BACKWARD", scrubTime);
        if (delta < -5) {
          queueEvent("REPLAY", scrubTime);
        }
        
        // Resume play if previously active
        if (isPlaying) {
          videoRef.current.play().catch(console.error);
        }
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isScrubbing || !seekbarRef.current) return;
      const rect = seekbarRef.current.getBoundingClientRect();
      const percent = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
      const time = percent * duration;
      setScrubTime(time);
      
      if (previewVideoRef.current) {
        previewVideoRef.current.currentTime = time;
      }
    };

    if (isScrubbing) {
      window.addEventListener("mouseup", handleGlobalMouseUp);
      window.addEventListener("mousemove", handleGlobalMouseMove);
    }

    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  }, [isScrubbing, scrubTime, isPlaying, duration]);

  // Hidden video seek event writes visual snapshot onto tooltip canvas
  const handlePreviewSeeked = () => {
    if (!previewVideoRef.current || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(previewVideoRef.current, 0, 0, canvas.width, canvas.height);
    }
  };

  // Overlay control inactivity timeout handler
  const handleUserActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isScrubbing) {
        setShowControls(false);
      }
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const videoUrl = token ? `/api/v1/screening/${token}/media` : '';

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-foreground">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent mx-auto"></div>
          <div className="text-xs text-zinc-500 tracking-widest uppercase">Buffering Screening...</div>
        </div>
      </div>
    );
  }

  if (error || !screening) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-foreground">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-red-500">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg text-zinc-200">Screening Access Failed</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {error || "The link you clicked is invalid, has expired, or is currently deactivated."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const activeProgressTime = isScrubbing ? scrubTime : currentTime;
  const progressPercent = duration ? (activeProgressTime / duration) * 100 : 0;
  const hoverPercent = duration && hoverTime ? (hoverTime / duration) * 100 : 0;

  return (
    <div 
      ref={playerContainerRef}
      onMouseMove={handleUserActivity}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="flex flex-col h-screen w-screen bg-black text-foreground font-sans relative overflow-hidden select-none"
    >
      {/* Hidden Player elements for Scrubbing Tooltip */}
      <video
        ref={previewVideoRef}
        src={videoUrl}
        className="hidden"
        preload="auto"
        muted
        onSeeked={handlePreviewSeeked}
      />

      {/* Main Cinematic Video Player */}
      <video
        ref={videoRef}
        src={videoUrl}
        preload="auto"
        className="w-full h-full object-contain cursor-none"
        onClick={togglePlay}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />

      {/* IMMERSIVE SCRIMS AND CONTROLS OVERLAYS */}
      <div 
        className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 pointer-events-none z-10 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Top Scrim (Netflix Header style) */}
        <div className="h-28 bg-gradient-to-b from-black/80 to-transparent p-8 flex items-start gap-4 pointer-events-auto">
          <div className="flex items-center gap-3">
            <Film className="h-6 w-6 text-red-600" />
            <div>
              <h1 className="font-bold text-lg tracking-wide text-zinc-100">{screening.title}</h1>
              {screening.description && (
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1 max-w-2xl">{screening.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Center Screen Play/Pause indicator */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <button 
            onClick={togglePlay}
            className={`w-20 h-20 rounded-full bg-black/50 border border-zinc-700/50 flex items-center justify-center text-white backdrop-blur-sm pointer-events-auto hover:bg-black/70 hover:scale-110 active:scale-95 transition-all duration-200 ${
              showControls ? "opacity-100 scale-100" : "opacity-0 scale-75"
            }`}
          >
            {isPlaying ? (
              <Pause className="h-8 w-8 fill-current" />
            ) : (
              <Play className="h-8 w-8 fill-current translate-x-0.5" />
            )}
          </button>
        </div>

        {/* Bottom Scrim (Controls, Seekbar, volume) */}
        <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent px-8 pb-8 pt-16 flex flex-col gap-6 pointer-events-auto">
          
          {/* Custom Netflix-style Seekbar */}
          <div className="relative group/seekbar pt-4 pb-2">
            
            {/* Hover Canvas Preview Tooltip */}
            <div 
              className={`absolute bottom-full mb-4 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-150 ${
                isHoveringSeek || isScrubbing ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
              }`}
              style={{ left: isScrubbing ? `${(scrubTime / duration) * 100}%` : `${hoverPercent}%` }}
            >
              <div className="bg-zinc-950 border border-zinc-800 rounded-md overflow-hidden shadow-2xl p-1.5 flex flex-col items-center space-y-1">
                <canvas 
                  ref={previewCanvasRef} 
                  width={160} 
                  height={90} 
                  className="bg-black rounded border border-zinc-800 w-40 h-22.5 object-cover" 
                />
                <span className="text-[10px] text-zinc-300 font-semibold font-mono tracking-wider">
                  {formatTime(isScrubbing ? scrubTime : (hoverTime || 0))}
                </span>
              </div>
              <div className="w-2.5 h-2.5 bg-zinc-950 border-r border-b border-zinc-800 rotate-45 -mt-1.5 shadow-2xl" />
            </div>

            {/* Hitbox area */}
            <div 
              ref={seekbarRef}
              onMouseMove={handleSeekMouseMove}
              onMouseLeave={handleSeekMouseLeave}
              onMouseDown={handleSeekMouseDown}
              className="h-1.5 bg-zinc-700/50 rounded-full w-full relative cursor-pointer group-hover/seekbar:h-2 transition-all duration-150"
            >
              {/* Buffer / Hover timeline */}
              {isHoveringSeek && (
                <div 
                  className="absolute top-0 bottom-0 left-0 bg-white/20 rounded-full pointer-events-none"
                  style={{ width: `${hoverPercent}%` }}
                />
              )}

              {/* Progress fill */}
              <div 
                className="absolute top-0 bottom-0 left-0 bg-red-600 rounded-full pointer-events-none"
                style={{ width: `${progressPercent}%` }}
              />

              {/* Thumb handle */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-red-600 border border-white opacity-0 group-hover/seekbar:opacity-100 transition-opacity duration-150 pointer-events-none"
                style={{ left: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Controls button layout */}
          <div className="flex items-center justify-between">
            {/* Left side actions */}
            <div className="flex items-center gap-6">
              {/* Skip Back */}
              <button 
                onClick={() => skipTime(-10)}
                className="text-zinc-400 hover:text-white hover:scale-105 active:scale-95 transition-all"
                title="Skip back 10s"
              >
                <RotateCcw className="h-5 w-5" />
              </button>

              {/* Play / Pause toggle */}
              <button 
                onClick={togglePlay}
                className="text-white hover:scale-110 active:scale-95 transition-all"
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6 fill-current" />
                ) : (
                  <Play className="h-6 w-6 fill-current translate-x-0.5" />
                )}
              </button>

              {/* Skip Forward */}
              <button 
                onClick={() => skipTime(10)}
                className="text-zinc-400 hover:text-white hover:scale-105 active:scale-95 transition-all"
                title="Skip forward 10s"
              >
                <RotateCw className="h-5 w-5" />
              </button>

              {/* Volume block */}
              <div className="flex items-center gap-2 group/volume">
                <button 
                  onClick={toggleMute}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </button>
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeSlide}
                  className="w-0 overflow-hidden group-hover/volume:w-20 h-1 accent-red-600 bg-zinc-700 rounded-lg appearance-none cursor-pointer transition-all duration-300"
                />
              </div>

              {/* Time displays */}
              <div className="text-xs text-zinc-300 font-mono tracking-widest pl-2">
                <span>{formatTime(currentTime)}</span>
                <span className="text-zinc-500 mx-2">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-widest bg-zinc-900/60 px-3 py-1.5 rounded-full border border-zinc-800/40">
                <Eye className="h-3 w-3 text-red-600 animate-pulse" />
                <span>Audience Mode</span>
              </div>

              {/* Fullscreen */}
              <button 
                onClick={handleFullscreen}
                className="text-zinc-400 hover:text-white hover:scale-105 transition-all"
              >
                {isFullscreen ? (
                  <Minimize className="h-5 w-5" />
                ) : (
                  <Maximize className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
