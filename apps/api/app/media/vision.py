import os
import shutil
import base64
import logging
import tempfile
import subprocess
from typing import List, Dict, Any, Tuple, Optional

logger = logging.getLogger("frame_sense.media.vision")


def extract_anomaly_frames(
    video_path: str,
    start_sec: float,
    end_sec: float,
    max_frames: int = 4
) -> Tuple[Optional[str], List[Dict[str, Any]]]:
    """
    Extracts a small, representative sample of JPEG frames around an anomaly timecode window using FFmpeg.
    Returns (temp_dir_path, list_of_frame_metadata_objects).
    Each frame object contains: time_sec, path, base64_image.
    """
    if not video_path or not os.path.exists(video_path):
        logger.warning(f"Video path does not exist for frame extraction: {video_path}")
        return None, []

    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        logger.warning("FFmpeg executable not found in system PATH. Skipping frame extraction.")
        return None, []

    # Calculate padded context window (2s before and after)
    p_start = max(0.0, float(start_sec) - 2.0)
    p_end = float(end_sec) + 2.0
    duration = max(1.0, p_end - p_start)
    
    count = max(1, min(max_frames, 6))
    if count == 1:
        timecodes = [round((start_sec + end_sec) / 2.0, 1)]
    else:
        step = duration / (count - 1)
        timecodes = [round(p_start + i * step, 1) for i in range(count)]

    temp_dir = tempfile.mkdtemp(prefix="frame_sense_vision_")
    extracted_frames = []

    for t in timecodes:
        out_filename = f"frame_{t:.1f}s.jpg"
        out_path = os.path.join(temp_dir, out_filename)
        
        # FFmpeg command: fast seek with -ss before -i, extract 1 frame with high JPEG quality (-q:v 2)
        cmd = [
            ffmpeg_bin,
            "-y",
            "-ss", str(t),
            "-i", video_path,
            "-vframes", "1",
            "-q:v", "2",
            out_path
        ]
        
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
            if res.returncode == 0 and os.path.exists(out_path) and os.path.getsize(out_path) > 0:
                with open(out_path, "rb") as f:
                    img_bytes = f.read()
                    b64_str = base64.b64encode(img_bytes).decode("utf-8")
                
                extracted_frames.append({
                    "time_sec": t,
                    "path": out_path,
                    "bytes": img_bytes,
                    "base64": f"data:image/jpeg;base64,{b64_str}"
                })
            else:
                logger.warning(f"FFmpeg failed for timecode {t}s: {res.stderr.decode()[:150]}")
        except Exception as e:
            logger.error(f"Error extracting frame at {t}s: {e}")

    return temp_dir, extracted_frames


def cleanup_temp_frames(temp_dir: Optional[str]) -> None:
    """Safely removes temporary extracted frame artifacts directory."""
    if temp_dir and os.path.exists(temp_dir):
        try:
            shutil.rmtree(temp_dir)
        except Exception as e:
            logger.warning(f"Failed to clean up temp frames dir {temp_dir}: {e}")
