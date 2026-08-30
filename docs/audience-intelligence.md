# Audience Intelligence

## 1. Purpose

Audience Intelligence is Frame Sense''s analytical layer that sits on top of the
Screening Room telemetry pipeline. Its sole responsibility is:

> **OBSERVE → MEASURE → DETECT**

It answers the question: *"What unusual audience behavior is occurring, and where?"*

It does NOT answer: *"Why did viewers behave this way?"*

Semantic interpretation is delegated to the future Gemini Investigation Agent.

---

## 2. Real Screening Telemetry

The normal Frame Sense workflow is:

```
Real viewer watches screening
         ↓
Screening Room (browser player)
         ↓
Viewer interaction events emitted
         ↓
FastAPI telemetry ingestion batch API
         ↓
ClickHouse viewer_events table
         ↓
Audience Intelligence (this layer)
```

Audience Intelligence works exclusively against the `viewer_events` table.
No second telemetry store is created.

---

## 3. Synthetic Simulator Purpose

**The simulator is a developer/demo tool, not part of the normal screening workflow.**

It exists for:
- Development and integration testing without real viewers
- Stress testing ClickHouse at scale (10,000 viewers, 1M+ events)
- Reproducible experiments with known behavioral patterns
- Hackathon demonstration

It uses the EXACT same `ViewerEvent` telemetry contract as the real browser client.
No parallel schema exists. Simulated events enter `viewer_events` directly.

---

## 4. Why Synthetic Data Exists

Real screenings may have only a handful of viewers in early-stage testing.
Audience Intelligence requires statistical volume to produce meaningful signal.
The simulator makes it possible to:

- Generate ground-truth behavioral anomalies at known positions
- Validate that the analytics engine correctly detects them
- Demonstrate the system at scale without waiting for real audience recruitment

---

## 5. Viewer Behavioral Simulation

The simulator assigns each synthetic viewer a hidden behavioral profile.
These profiles **exist only inside the simulator** and are **never written to ClickHouse**.

| Profile | Description |
|---|---|
| NORMAL | Standard watch behaviour; moderate completion rate |
| ENGAGED | High retention, frequent pauses and replays |
| EARLY_ABANDONER | Exits within first 10-30% of video |
| PACING_SENSITIVE | Seek-forward spikes in pacing anomaly windows |
| COMPREHENSION_SENSITIVE | Pause and rewind spikes in comprehension windows |
| AUDIO_SENSITIVE | Volume change and rewind spikes in audio windows |

Default profile distribution:
- NORMAL: 45%
- ENGAGED: 20%
- EARLY_ABANDONER: 10%
- PACING_SENSITIVE: 10%
- COMPREHENSION_SENSITIVE: 10%
- AUDIO_SENSITIVE: 5%

---

## 6. Telemetry Signals

Observable events recorded per viewer session:

| Event Type | Description |
|---|---|
| PLAY | Viewer starts or resumes playback |
| PAUSE | Viewer pauses playback |
| PROGRESS | Periodic heartbeat during active playback |
| COMPLETE | Viewer reaches end of video |
| EXIT | Viewer closes or navigates away |
| SEEK_FORWARD | Viewer scrubs forward in timeline |
| SEEK_BACKWARD | Viewer scrubs backward in timeline |
| REPLAY | Viewer rewinds to re-watch a section |
| VOLUME_CHANGE | Viewer adjusts audio volume |
| TAB_VISIBLE | Browser tab becomes active |
| TAB_HIDDEN | Browser tab becomes hidden |

---

## 7. Retention Methodology

For each time bucket `t` (configurable, default 10s):

1. For each viewer, compute their **maximum watched timecode** across
   `PLAY`, `PROGRESS`, `PAUSE`, and `COMPLETE` events (proxy for how far they watched).
2. Count viewers whose max timecode >= `t`.
3. `retention_rate(t) = viewers_at_t / total_starters`

This gives a monotonically decreasing (generally) retention curve.
All aggregation runs inside ClickHouse.

---

## 8. Baseline Methodology

For each behavioral metric `M` (exit_rate, rewind_rate, pause_rate, skip_rate, replay_rate):

```
baseline_mean(M) = mean(M across all time buckets)
baseline_std(M)  = population std(M across all time buckets)
z_score(M, t)    = (M_at_t - baseline_mean) / (baseline_std + ε)
```

This is a simple, transparent, population-level z-score baseline.

**No ML model is used.** The methodology is fully explainable and documented here.

---

## 9. Anomaly Detection Methodology

After baseline calculation, each time bucket is evaluated:

```
For each metric M in [exit_rate, rewind_rate, pause_rate, skip_rate]:
  If z_score(M, t) > threshold AND direction is anomalous (high):
    Flag bucket t as containing a behavioral anomaly signal for M
```

Severity thresholds:

| Severity | z-score |
|---|---|
| HIGH | ≥ 3.0σ |
| MEDIUM | ≥ 2.0σ |
| LOW | ≥ 1.5σ |

A bucket containing multiple signals receives the severity of the strongest signal.

Evidence strings report observed vs baseline measurements only.
No semantic interpretation is generated.

---

## 10. Engagement Detection

Exceptional engagement is detected when:

```
replay_rate z-score > 2.0
OR
replay_rate z-score > 1.5 AND exit_rate z-score < -1.0
```

This identifies moments where viewers actively re-watch content with unusually
low abandonment.

---

## 11. Sample-Size Handling

| Viewers | Status | Label |
|---|---|---|
| < 10 | INSUFFICIENT_DATA | "Insufficient audience data for reliable anomaly detection." |
| 10–99 | PRELIMINARY_SIGNAL | "Preliminary signal (N viewers)." |
| ≥ 100 | STRONG_SIGNAL | "Strong screening signal (N viewers)." |

When `INSUFFICIENT_DATA`, anomaly detection returns empty results rather than
potentially misleading signals from tiny samples.

---

## 12. Hidden Ground Truth

The synthetic simulator supports a hidden ground truth configuration.
The demo default (300s video) embeds anomalies at:

| Time Range | Simulated Pattern |
|---|---|
| 72-84s | Pacing issue: seek-forward + exit spikes |
| 96-104s | Exceptional engagement: replay + completion spikes |
| 151-163s | Comprehension issue: pause + rewind spikes |
| 221-230s | Audio issue: volume-change + rewind spikes |

**Ground truth exists ONLY inside the simulator.**
It is never written to ClickHouse event data.
It is never returned by any Audience Intelligence API endpoint.
The analytics engine must discover anomalies from raw telemetry alone.

---

## 13. ClickHouse Role

- Sole telemetry store for all viewer events (real and synthetic)
- All retention, signal, and anomaly aggregations run as ClickHouse SQL
- Python never loads raw event rows for computation
- Supports 1M+ events efficiently through ClickHouse columnar aggregation
- Deletions use ClickHouse async mutations (`ALTER TABLE DELETE`)

---

## 14. API Contracts

### Audience Intelligence (Public)

```
GET /api/v1/screenings/{screening_id}/audience/overview
GET /api/v1/screenings/{screening_id}/audience/retention?bucket_sec=10
GET /api/v1/screenings/{screening_id}/audience/signals?bucket_sec=10
GET /api/v1/screenings/{screening_id}/audience/anomalies?bucket_sec=10
```

### Developer Simulator (Isolated - NOT public API)

```
POST /api/v1/screenings/{screening_id}/dev/simulate?num_viewers=1000&seed=42
```

### Anomaly Response Schema (for future Gemini agent consumption)

```json
{
  "anomaly_id": "anm_abc123",
  "screening_id": "sc_xxx",
  "start_time_sec": 134,
  "end_time_sec": 144,
  "type": "BEHAVIORAL_ANOMALY",
  "severity": "HIGH",
  "signals": {
    "exit_rate": 0.284,
    "baseline_exit_rate": 0.062,
    "exit_rate_ratio": 4.6,
    "rewind_rate": 0.37,
    "baseline_rewind_rate": 0.10,
    "rewind_rate_ratio": 3.7
  },
  "evidence": [
    "Exit Rate is 4.6x above baseline (observed 28.4%, baseline 6.2%)",
    "Rewind Rate is 3.7x above baseline (observed 37.0%, baseline 10.0%)"
  ]
}
```

---

## 15. Known Limitations

1. **Retention proxy**: Max timecode is used as a proxy for watch-through. A viewer
   who pauses at the beginning and resumes later may be undercounted at intermediate
   times.

2. **Z-score sensitivity**: With very short videos (few buckets), the population
   baseline has high variance, reducing anomaly detection reliability.

3. **First bucket excluded**: The t=0 bucket is excluded from anomaly scoring to
   avoid startup-sequence noise (e.g., all viewers emitting TAB_VISIBLE + PLAY).

4. **No adjacent-window smoothing**: Anomalies are detected per-bucket independently.
   A persistent anomaly across adjacent windows appears as multiple separate anomalies
   rather than a merged time range.

5. **ClickHouse mutation latency**: Deletion of events uses async ClickHouse mutations.
   Event counts may remain visible briefly after deletion is requested.

---

## 16. Intentionally Deferred to Future Layers

The following are explicitly OUT OF SCOPE for Audience Intelligence:

- **Gemini semantic investigation**: Why did viewers behave this way?
- **Editorial recommendations**: What should the filmmaker change?
- **Script analysis / video understanding**: What is happening at this moment?
- **Audio diagnosis**: What audio issues caused viewer discomfort?
- **EDL generation**: Automated edit decision lists

These belong to the future Gemini Investigation Agent layer.
