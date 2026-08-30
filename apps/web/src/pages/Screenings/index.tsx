import { useEffect, useState } from 'react';
import { Plus, Film, Link as LinkIcon, BarChart2, X, ClipboardCheck, Clock, AlertTriangle } from 'lucide-react';

interface Screening {
  screening_id: string;
  media_id: string;
  title: string;
  description: string | null;
  media_filename: string;
  media_duration: number;
  created_at: string;
  status: string;
  public_token: string;
  share_url: string;
}

interface Stats {
  total_sessions: number;
  unique_viewers: number;
  total_events: number;
  completed_sessions: number;
  event_breakdown: Record<string, number>;
}

export default function Screenings() {
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal & Creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  // Stats Modal state
  const [selectedStatsScreening, setSelectedStatsScreening] = useState<Screening | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Copy success indicator
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Fetch screenings
  const fetchScreenings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/screenings');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to load screenings list.");
      }
      const data = await res.json();
      setScreenings(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load screenings list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScreenings();
  }, []);

  // Fetch stats for a specific screening
  const openStatsModal = async (s: Screening) => {
    setSelectedStatsScreening(s);
    setLoadingStats(true);
    setStats(null);
    try {
      const res = await fetch(`/api/v1/screenings/${s.screening_id}/stats`);
      if (!res.ok) throw new Error("HTTP error " + res.status);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to load screening stats from ClickHouse:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Helper to read video duration using standard HTML5 video metadata parsing
  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => {
        resolve(0); // Fallback if parsing fails
      };
      video.src = URL.createObjectURL(file);
    });
  };

  const uploadMediaWithProgress = (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", file);

      xhr.open("POST", "/api/v1/screenings/upload");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentCompleted = Math.round((event.loaded * 100) / event.total);
          setUploadProgress(percentCompleted);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error("Failed to parse server response"));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData.detail || "Upload failed"));
          } catch (e) {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network connection error during upload"));
      };

      xhr.send(formData);
    });
  };

  // Handle screening creation and file uploading
  const handleCreateScreening = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !title) return;

    try {
      setUploadProgress(0);
      setUploadStatus("Ingesting video metadata...");
      
      // 1. Get exact video duration from browser player
      const duration = await getVideoDuration(selectedFile);
      
      // 2. Perform multipart upload with progress tracking via XMLHttpRequest helper
      setUploadStatus("Uploading media cut...");
      const { media_filename } = await uploadMediaWithProgress(selectedFile);

      // 3. Register screening metadata in backend
      setUploadStatus("Finalizing screening room configuration...");
      const createRes = await fetch('/api/v1/screenings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          description,
          media_filename,
          media_duration: duration
        })
      });
      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to finalize screening room");
      }

      // Reset and refresh list
      setUploadProgress(null);
      setUploadStatus('');
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      setShowCreateModal(false);
      fetchScreenings();
    } catch (err: any) {
      setUploadProgress(null);
      setUploadStatus('');
      alert(err.message || "Upload failed. Enforce file limits and try again.");
    }
  };

  // Copy share link helper
  const handleCopyLink = (publicToken: string) => {
    const shareUrl = `${window.location.origin}/screening/${publicToken}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedToken(publicToken);
      setTimeout(() => setCopiedToken(null), 2000);
    }).catch(() => {
      alert(`Shareable Link: ${shareUrl}`);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Studio Screening Room Manager</h1>
          <p className="text-sm text-muted-foreground">Provision private screenings, upload cut sequences, and collect ClickHouse telemetry.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded text-sm hover:bg-primary/95 transition-all shadow-md"
        >
          <Plus className="h-4 w-4" /> Provision Screening
        </button>
      </div>

      {/* Screenings Grid/List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 flex items-center gap-3 text-rose-500">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm">{error}</span>
        </div>
      ) : screenings.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-studio-900 flex items-center justify-center text-muted-foreground">
            <Film className="h-6 w-6 text-primary/80" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="font-semibold text-foreground text-sm">No screenings provisioned</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Create a screening room session, upload a rough or final cut, and distribute shareable links to collect audience event signals.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b bg-studio-950/50 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                <th className="p-4">Film Screening details</th>
                <th className="p-4">Video duration</th>
                <th className="p-4">Creation date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {screenings.map((s) => (
                <tr key={s.screening_id} className="hover:bg-studio-900/10 transition-colors">
                  <td className="p-4 font-medium text-foreground">
                    <div>{s.title}</div>
                    {s.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 max-w-md truncate">{s.description}</div>
                    )}
                  </td>
                  <td className="p-4 text-muted-foreground flex items-center gap-1.5 pt-6">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{Math.floor(s.media_duration / 60)}m {Math.round(s.media_duration % 60)}s</span>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button 
                      onClick={() => handleCopyLink(s.public_token)}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border hover:text-foreground rounded px-3 py-1.5 transition-all"
                    >
                      {copiedToken === s.public_token ? (
                        <>
                          <ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-emerald-500">Copied!</span>
                        </>
                      ) : (
                        <>
                          <LinkIcon className="h-3.5 w-3.5" />
                          <span>Get Share Link</span>
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => openStatsModal(s)}
                      className="inline-flex items-center gap-1.5 text-xs text-primary border border-primary/20 hover:bg-primary/10 rounded px-3 py-1.5 transition-all"
                    >
                      <BarChart2 className="h-3.5 w-3.5" />
                      <span>Telemetry Stats</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Creation Modal dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-studio-950 border rounded-xl shadow-2xl p-6 relative space-y-4">
            <button 
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider">Provision Screening Room</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Define metadata and upload a video file under 150MB.</p>
            </div>
            
            <form onSubmit={handleCreateScreening} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Film Title</label>
                <input 
                  type="text" 
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Horizon Line - Fine Cut v2"
                  className="w-full bg-studio-900 border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Description (Optional)</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Focus group testing regarding segment pacing..."
                  rows={3}
                  className="w-full bg-studio-900 border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Upload Video Cut</label>
                <input 
                  type="file"
                  required
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-studio-900 file:text-primary file:cursor-pointer hover:file:bg-studio-800"
                />
              </div>

              {uploadProgress !== null && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span className="animate-pulse">{uploadStatus}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-studio-900 h-1.5 rounded-full overflow-hidden border">
                    <div 
                      className="bg-primary h-full transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded text-xs hover:bg-studio-900"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={uploadProgress !== null}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded text-xs hover:bg-primary/95 disabled:opacity-50"
                >
                  Create Screening
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ClickHouse Telemetry Stats Modal */}
      {selectedStatsScreening && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-studio-950 border rounded-xl shadow-2xl p-6 relative space-y-6">
            <button 
              onClick={() => setSelectedStatsScreening(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider">{selectedStatsScreening.title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Direct analytical metrics aggregated from ClickHouse</p>
            </div>

            {loadingStats ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            ) : stats ? (
              <div className="space-y-6">
                {/* Stats Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-studio-900 border rounded-lg space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Total Sessions</div>
                    <div className="text-xl font-bold text-foreground">{stats.total_sessions}</div>
                  </div>
                  <div className="p-4 bg-studio-900 border rounded-lg space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Unique Viewers</div>
                    <div className="text-xl font-bold text-foreground">{stats.unique_viewers}</div>
                  </div>
                  <div className="p-4 bg-studio-900 border rounded-lg space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Telemetry Events</div>
                    <div className="text-xl font-bold text-foreground">{stats.total_events}</div>
                  </div>
                  <div className="p-4 bg-studio-900 border rounded-lg space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Completions</div>
                    <div className="text-xl font-bold text-foreground">{stats.completed_sessions}</div>
                  </div>
                </div>

                {/* Event Breakdown */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider">Event Breakdown</h3>
                  {Object.keys(stats.event_breakdown).length === 0 ? (
                    <div className="text-xs text-muted-foreground italic bg-studio-900 p-4 border rounded text-center">
                      No interaction events recorded yet. Distribute the screening link to begin collecting data.
                    </div>
                  ) : (
                    <div className="border bg-studio-900/40 rounded-lg overflow-hidden divide-y">
                      {Object.entries(stats.event_breakdown).map(([event, count]) => (
                        <div key={event} className="flex justify-between items-center px-4 py-2 text-xs">
                          <span className="font-semibold text-foreground tracking-wider">{event}</span>
                          <span className="text-muted-foreground">{count} events</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-rose-500 bg-rose-500/5 p-4 border border-rose-500/20 rounded">
                Failed to load stats details. Ensure ClickHouse connection is active.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
