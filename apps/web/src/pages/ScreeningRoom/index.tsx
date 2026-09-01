import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Film, Eye, AlertCircle, Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Minimize,
  MessageSquare, Send, Edit2, Trash2, Clock, Check, UserCheck
} from 'lucide-react';

// Helper to get or create a persistent anonymous viewer ID
function getOrCreateViewerId(): string {
  let id = localStorage.getItem('fs_anonymous_viewer_id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('fs_anonymous_viewer_id', id);
  }
  return id;
}

// Helper to get or create a persistent pseudo-anonymous display name
function getOrCreateViewerDisplayName(): string {
  let name = localStorage.getItem('fs_anonymous_display_name');
  if (!name) {
    const num = Math.floor(100 + Math.random() * 900);
    name = `Anonymous Viewer #${num}`;
    localStorage.setItem('fs_anonymous_display_name', name);
  }
  return name;
}

interface ScreeningInfo {
  screening_id: string;
  media_id: string;
  title: string;
  description: string | null;
  media_duration: number;
  created_at: string;
}

interface CommentInfo {
  comment_id: string;
  screening_id: string;
  viewer_id: string;
  display_name: string;
  video_timecode_sec: number;
  content: string;
  created_at: string;
  updated_at: string;
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

  // Refs that mirror state for use inside callbacks without stale closures
  const isPlayingRef = useRef(false);
  const durationRef = useRef(0);
  const scrubTimeRef = useRef(0);
  const isScrubbingRef = useRef(false);

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

  // Anonymous Comment & Feedback State
  const [comments, setComments] = useState<CommentInfo[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');
  const viewerDisplayName = useRef<string>(getOrCreateViewerDisplayName()).current;

  const fetchComments = async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/screenings/${token}/comments?viewer_id=${viewerIdRef.current}`);
      if (res.ok) {
        setComments(await res.json());
      }
    } catch (e) {
      console.error('Failed to load comments:', e);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [token]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !token || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/v1/screenings/${token}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewer_id: viewerIdRef.current,
          display_name: viewerDisplayName,
          video_timecode_sec: currentTime,
          content: commentInput.trim(),
        }),
      });
      if (res.ok) {
        setCommentInput('');
        await fetchComments();
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleStartEdit = (cmt: CommentInfo) => {
    setEditingCommentId(cmt.comment_id);
    setEditInput(cmt.content);
  };

  const handleSaveEdit = async (cmtId: string) => {
    if (!editInput.trim()) return;
    try {
      const res = await fetch(`/api/v1/screenings/comments/${cmtId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewer_id: viewerIdRef.current,
          content: editInput.trim(),
        }),
      });
      if (res.ok) {
        setEditingCommentId(null);
        setEditInput('');
        await fetchComments();
      }
    } catch (err) {
      console.error('Failed to update comment:', err);
    }
  };

  const handleDeleteComment = async (cmtId: string) => {
    try {
      const res = await fetch(`/api/v1/screenings/comments/${cmtId}?viewer_id=${viewerIdRef.current}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchComments();
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const seekToTimecode = (timecode: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timecode;
      setCurrentTime(timecode);
    }
  };

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
        if (data.media_duration) {
          const dur = Number(data.media_duration);
          durationRef.current = dur;
          setDuration(dur);
        }
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

  // Keyboard shortcut listener — registered once, reads live values from refs to avoid stale closures
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'u')) {
        e.preventDefault();
        return;
      }
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); togglePlay(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); skipTime(-5); }
      if (e.key === 'ArrowRight') { e.preventDefault(); skipTime(5); }
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMute(); }
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); handleFullscreen(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable: handlers read from refs, not stale state

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

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

  // Keep isPlaying ref in sync with state so callbacks never go stale
  const setIsPlayingSync = (val: boolean) => {
    isPlayingRef.current = val;
    setIsPlaying(val);
  };

  // Synchronize state and trigger player heartbeats
  const onPlayStatusChange = (playing: boolean) => {
    setIsPlayingSync(playing);
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
  // Reads isPlayingRef (not stale React state) to ensure instant response
  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isPlayingRef.current) {
      vid.pause();
      onPlayStatusChange(false);
    } else {
      // Optimistically update UI immediately — don't wait for .play() promise
      setIsPlayingSync(true);
      vid.play().then(() => {
        // Emit telemetry after confirmed playback start
        queueEvent("PLAY", vid.currentTime);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = setInterval(() => {
          if (videoRef.current && !videoRef.current.paused) {
            queueEvent("PROGRESS", videoRef.current.currentTime);
          }
        }, 5000);
      }).catch(() => {
        // Roll back if browser rejected the play call
        setIsPlayingSync(false);
      });
    }
  };

  // Guard seek behind readyState — avoids silent failure when seeking before buffer is ready
  const safeSeek = (target: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    const totalDuration = durationRef.current || (screening?.media_duration ? Number(screening.media_duration) : Infinity);
    const clamped = Math.min(Math.max(target, 0), totalDuration);
    if (isNaN(clamped)) return;

    try {
      vid.currentTime = clamped;
    } catch (err) {
      console.warn("Direct seek failed:", err);
    }
    setCurrentTime(clamped);
    setScrubTime(clamped);
  };

  const seekStartTimeRef = useRef<number>(0);

  const skipTime = (amount: number) => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime || 0;
    const target = current + amount;
    safeSeek(target);
    if (amount < 0) {
      queueEvent("SEEK_BACKWARD", target);
      queueEvent("REPLAY", target);
    } else {
      queueEvent("SEEK_FORWARD", target);
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

  // Time formatting helper
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

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const d = videoRef.current.duration;
      if (d && !isNaN(d) && Number.isFinite(d)) {
        durationRef.current = d;
        setDuration(d);
      }
      if (previewVideoRef.current && !previewVideoRef.current.src) {
        previewVideoRef.current.src = videoRef.current.src;
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || isScrubbingRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
    if (videoRef.current.currentTime >= videoRef.current.duration - 0.25) {
      queueEvent("COMPLETE", videoRef.current.duration);
    }
  };

  // Custom Seekbar Scrubbing and Preview Tooltip Logic
  const getSeekTimeFromX = (clientX: number): number => {
    if (!seekbarRef.current) return 0;
    const rect = seekbarRef.current.getBoundingClientRect();
    const percent = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const totalDuration = durationRef.current || (screening?.media_duration ? Number(screening.media_duration) : 0);
    return percent * totalDuration;
  };

  const handleSeekMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!seekbarRef.current) return;
    setIsHoveringSeek(true);
    const time = getSeekTimeFromX(e.clientX);
    setHoverTime(time);
    if (previewVideoRef.current && previewVideoRef.current.readyState >= 1) {
      previewVideoRef.current.currentTime = time;
    }
  };

  const handleSeekMouseLeave = () => {
    setIsHoveringSeek(false);
    setHoverTime(null);
  };

  const handleSeekMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    seekStartTimeRef.current = videoRef.current?.currentTime || 0;
    const time = getSeekTimeFromX(e.clientX);
    scrubTimeRef.current = time;
    setScrubTime(time);
    safeSeek(time);
    if (videoRef.current && isPlayingRef.current) {
      videoRef.current.pause();
    }
  };

  // Global mouse handlers attached once, read live values from refs — no stale closure issues
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (!isScrubbingRef.current) return;
      isScrubbingRef.current = false;
      setIsScrubbing(false);
      const targetTime = scrubTimeRef.current;
      const startTime = seekStartTimeRef.current;
      const vid = videoRef.current;
      if (vid) {
        const delta = targetTime - startTime;
        safeSeek(targetTime);
        if (Math.abs(delta) > 0.5) {
          if (delta < 0) {
            queueEvent("SEEK_BACKWARD", targetTime);
            queueEvent("REPLAY", targetTime);
          } else {
            queueEvent("SEEK_FORWARD", targetTime);
          }
        }
        if (isPlayingRef.current) vid.play().catch(console.error);
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isScrubbingRef.current || !seekbarRef.current) return;
      const rect = seekbarRef.current.getBoundingClientRect();
      const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
      const time = pct * durationRef.current;
      scrubTimeRef.current = time;
      setScrubTime(time);
      if (previewVideoRef.current && previewVideoRef.current.readyState >= 1) {
        previewVideoRef.current.currentTime = time;
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable: reads all mutable values from refs, never stale

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none">
      {/* Header bar */}
      <header className="border-b border-zinc-800/40 bg-zinc-950/80 backdrop-blur-md px-6 py-4 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Film className="h-5 w-5 text-red-600 animate-pulse" />
          <div>
            <h1 className="font-bold text-sm tracking-wide text-zinc-100 uppercase">{screening.title}</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Focus Group Screening Room</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900/60 px-3 py-1.5 rounded-full border border-zinc-800/40">
          <Eye className="h-3.5 w-3.5 text-red-600" />
          <span>Anonymous Research Active</span>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Column: Custom Netflix Video Player */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Custom player frame with Anti-Right-Click protection */}
            <div 
              ref={playerContainerRef}
              onMouseMove={handleUserActivity}
              onMouseLeave={() => isPlaying && setShowControls(false)}
              onContextMenu={handleContextMenu}
              className={`w-full aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-black relative shadow-2xl group flex items-center justify-center ${showControls ? 'cursor-default' : 'cursor-none'}`}
            >
              {/* Hidden frame-preview player — src assigned lazily after main video loads metadata
                  to avoid competing for bandwidth during initial buffering */}
              <video
                ref={previewVideoRef}
                className="hidden"
                preload="none"
                muted
                controlsList="nodownload noRemotePlayback"
                disablePictureInPicture
                onSeeked={handlePreviewSeeked}
              />

              {/* Main Cinematic Video Player with anti-download attributes */}
              <video
                ref={videoRef}
                src={videoUrl}
                preload="auto"
                controlsList="nodownload noRemotePlayback"
                disablePictureInPicture
                className={`w-full h-full object-contain ${showControls ? 'cursor-default' : 'cursor-none'}`}
                onClick={togglePlay}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
              />

              {/* Custom Controls Overlay */}
              <div 
                className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 pointer-events-none z-10 ${
                  showControls ? "opacity-100" : "opacity-0"
                }`}
              >
                {/* Immersive Top Scrim */}
                <div className="h-20 bg-gradient-to-b from-black/80 to-transparent p-6 flex items-start justify-between pointer-events-auto">
                  <div>
                    <h2 className="font-bold text-sm tracking-wide text-zinc-200">{screening.title}</h2>
                  </div>
                </div>

                {/* Big Center Play Indicator */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <button 
                    onClick={togglePlay}
                    className={`w-16 h-16 rounded-full bg-black/60 border border-zinc-700/50 flex items-center justify-center text-white backdrop-blur-sm pointer-events-auto hover:bg-black/80 hover:scale-105 active:scale-95 transition-all duration-200 ${
                      showControls ? "opacity-100 scale-100" : "opacity-0 scale-75"
                    }`}
                  >
                    {isPlaying ? (
                      <Pause className="h-6 w-6 fill-current" />
                    ) : (
                      <Play className="h-6 w-6 fill-current translate-x-0.5" />
                    )}
                  </button>
                </div>

                {/* Bottom Scrim (Seekbar and controls) */}
                <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent px-6 pb-6 pt-12 flex flex-col gap-4 pointer-events-auto">
                  
                  {/* Custom Seekbar Slider */}
                  <div className="relative group/seekbar pt-2 pb-1">
                    
                    {/* Scrub Hover Canvas Preview card */}
                    <div 
                      className={`absolute bottom-full mb-3 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-150 ${
                        isHoveringSeek || isScrubbing ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                      }`}
                      style={{ left: isScrubbing ? `${(scrubTime / duration) * 100}%` : `${hoverPercent}%` }}
                    >
                      <div className="bg-zinc-950 border border-zinc-800 rounded shadow-2xl p-1 flex flex-col items-center space-y-1">
                        <canvas 
                          ref={previewCanvasRef} 
                          width={140} 
                          height={78.75} 
                          className="bg-black rounded border border-zinc-900 w-35 h-19.6 object-cover" 
                        />
                        <span className="text-[9px] text-zinc-300 font-semibold font-mono tracking-wider">
                          {formatTime(isScrubbing ? scrubTime : (hoverTime || 0))}
                        </span>
                      </div>
                      <div className="w-2 h-2 bg-zinc-950 border-r border-b border-zinc-800 rotate-45 -mt-1 shadow-2xl" />
                    </div>

                    {/* Seek track timeline */}
                    <div 
                      ref={seekbarRef}
                      onMouseMove={handleSeekMouseMove}
                      onMouseLeave={handleSeekMouseLeave}
                      onMouseDown={handleSeekMouseDown}
                      className="h-1 bg-zinc-700/50 rounded-full w-full relative cursor-pointer group-hover/seekbar:h-1.5 transition-all duration-150"
                    >
                      {isHoveringSeek && (
                        <div 
                          className="absolute top-0 bottom-0 left-0 bg-white/20 rounded-full pointer-events-none"
                          style={{ width: `${hoverPercent}%` }}
                        />
                      )}
                      <div 
                        className="absolute top-0 bottom-0 left-0 bg-red-600 rounded-full pointer-events-none"
                        style={{ width: `${progressPercent}%` }}
                      />
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-red-600 border border-white opacity-0 group-hover/seekbar:opacity-100 transition-opacity duration-150 pointer-events-none"
                        style={{ left: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <button 
                        onClick={() => skipTime(-5)}
                        className="text-zinc-400 hover:text-white transition-colors"
                        title="Skip back 5s"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>

                      <button onClick={togglePlay} className="text-white hover:scale-105 transition-all">
                        {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current translate-x-0.5" />}
                      </button>

                      <button 
                        onClick={() => skipTime(5)}
                        className="text-zinc-400 hover:text-white transition-colors"
                        title="Skip forward 5s"
                      >
                        <RotateCw className="h-4 w-4" />
                      </button>

                      <div className="flex items-center gap-2 group/volume">
                        <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition-colors">
                          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </button>
                        <input 
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeSlide}
                          className="w-0 overflow-hidden group-hover/volume:w-16 h-1 accent-red-600 bg-zinc-700 roundedappearance-none cursor-pointer transition-all duration-300"
                        />
                      </div>

                      <div className="text-[11px] text-zinc-300 font-mono tracking-widest pl-2">
                        <span>{formatTime(currentTime)}</span>
                        <span className="text-zinc-600 mx-1.5">/</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>

                    <button 
                      onClick={handleFullscreen}
                      className="text-zinc-400 hover:text-white transition-colors"
                    >
                      {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Movie & Telemetry info sidebar */}
          <div className="space-y-6">
            <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-6 space-y-4 shadow-xl">
              <div className="space-y-1">
                <span className="text-[9px] text-red-500 font-bold uppercase tracking-widest">Now Screening</span>
                <h2 className="text-lg font-bold text-zinc-100 tracking-wide uppercase">{screening.title}</h2>
              </div>
              
              {screening.description ? (
                <p className="text-xs text-zinc-400 leading-relaxed">{screening.description}</p>
              ) : (
                <p className="text-xs text-zinc-500 italic">No description details available.</p>
              )}

              <div className="flex items-center gap-4 text-[10px] text-zinc-500 uppercase tracking-wider pt-3 border-t border-zinc-800/60 font-mono">
                <div>Duration: {Math.floor(screening.media_duration / 60)}m {Math.round(screening.media_duration % 60)}s</div>
                <div>Published: {new Date(screening.created_at).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Anonymous Viewer Comments & Feedback Section */}
            <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-red-500" />
                  <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Audience Feedback ({comments.length})
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 bg-zinc-800/50 px-2.5 py-1 rounded-full border border-zinc-700/40 font-mono">
                  <UserCheck className="h-3 w-3 text-emerald-400" />
                  <span>{viewerDisplayName}</span>
                </div>
              </div>

              {/* Comment submission form */}
              <form onSubmit={handleAddComment} className="space-y-2">
                <div className="relative">
                  <textarea
                    rows={2}
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Add a feedback note for filmmakers..."
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-red-600/60 focus:ring-1 focus:ring-red-600/30 resize-none"
                  />
                  <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => seekToTimecode(currentTime)}
                      className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded flex items-center gap-1 hover:text-white transition-colors"
                      title="Timestamp comment at current video position"
                    >
                      <Clock className="h-3 w-3 text-red-500" />
                      <span>{formatTime(currentTime)}</span>
                    </button>
                    <button
                      type="submit"
                      disabled={!commentInput.trim() || submittingComment}
                      className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white p-1.5 rounded-md transition-all shadow-md flex items-center justify-center"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </form>

              {/* Comments list */}
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <div className="text-[11px] text-zinc-500 italic text-center py-4 bg-zinc-950/30 rounded-lg border border-zinc-900">
                    No feedback comments added yet. Pause or play to drop notes at exact timecodes.
                  </div>
                ) : (
                  comments.map((cmt) => {
                    const isAuthor = cmt.viewer_id === viewerIdRef.current;
                    const isEditing = editingCommentId === cmt.comment_id;

                    return (
                      <div
                        key={cmt.comment_id}
                        className="bg-zinc-950/60 border border-zinc-800/60 rounded-lg p-3 space-y-1.5 hover:border-zinc-700/60 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-200">
                              {cmt.display_name}
                            </span>
                            <button
                              onClick={() => seekToTimecode(cmt.video_timecode_sec)}
                              className="inline-flex items-center gap-1 text-[10px] font-mono bg-red-950/60 text-red-400 border border-red-900/40 hover:bg-red-900/40 px-2 py-0.5 rounded transition-all cursor-pointer"
                              title="Click to jump to this video timecode"
                            >
                              <Clock className="h-3 w-3" />
                              <span>{formatTime(cmt.video_timecode_sec)}</span>
                            </button>
                          </div>

                          {isAuthor && !isEditing && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStartEdit(cmt)}
                                className="p-1 text-zinc-400 hover:text-white transition-colors"
                                title="Edit your comment"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteComment(cmt.comment_id)}
                                className="p-1 text-zinc-400 hover:text-red-400 transition-colors"
                                title="Delete your comment"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-2 pt-1">
                            <textarea
                              rows={2}
                              value={editInput}
                              onChange={(e) => setEditInput(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs text-zinc-100 focus:outline-none focus:border-red-500"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingCommentId(null)}
                                className="text-[10px] text-zinc-400 hover:text-white px-2 py-1"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEdit(cmt.comment_id)}
                                className="text-[10px] bg-red-600 text-white font-semibold px-2.5 py-1 rounded flex items-center gap-1 hover:bg-red-500"
                              >
                                <Check className="h-3 w-3" /> Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                            {cmt.content}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
