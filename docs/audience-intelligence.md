# Audience Intelligence & Core Engine Specification

## 1. Purpose

Audience Intelligence is Frame Sense's analytical layer sitting on top of the ClickHouse telemetry pipeline. Its core responsibility is:

> **OBSERVE → MEASURE → DETECT → INVESTIGATE**

It measures audience behavior, detects statistically significant anomalies, and collaborates with the **Gemini Multimodal Vision Engine** to generate scientific editorial findings.

---

## 2. Statistical Joint Gating & Sample Awareness

Viewer sample size is a fundamental constraint in Frame Sense. Event counts alone must never override an insufficient viewer sample size.

### Sample Exposure Categories

| Sample Size $n$ | Category | Behavior | Confidence Cap | Severity Cap |
|---|---|---|---|---|
| $n < 5$ | `INSUFFICIENT_DATA` | Sample too small to infer reliable anomaly | `LOW` ($\le 0.35$) | `LOW` |
| $5 \le n < 10$ | `PRELIMINARY_SIGNAL` | Preliminary signal; directional hint | `MEDIUM` ($\le 0.65$) | `MEDIUM` |
| $10 \le n < 30$ | `SUFFICIENT_SIGNAL` | Adequate screening sample | Based on $z$-score & Wilson bound | Based on $z$-score |
| $n \ge 30$ | `STRONG_SIGNAL` | High-confidence statistical evidence | Full confidence calculation | Full severity calculation |

---

## 3. Laplace Smoothing & Wilson Confidence Bounds

To prevent pathological 0% or 100% rate representations on small samples (e.g. 1 exit out of 1 viewer):

### Laplace Smoothed Rate
$$\hat{p}_{\text{smoothed}} = \frac{k + 1}{n + 2}$$
where $k$ is the event count and $n$ is active viewers. Raw event count $k$ and raw rate $k/n$ are ALWAYS retained in evidence.

### Wilson Lower Bound
$$\hat{p}_{\text{lower}} = \frac{\hat{p} + \frac{z^2}{2n} - z \sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}$$
where $\hat{p} = \min(1.0, \max(0.0, k/n))$ and $z = 1.96$ ($95\%$ confidence level). Wilson bounds are used as uncertainty/evidence quality metrics.

---

## 4. Local Baseline Methodology

To compute z-scores without self-pollution from the anomaly window itself:
- Baseline mean $\mu_{\text{local}}$ and standard deviation $\sigma_{\text{local}}$ are computed across all time buckets **excluding a $\pm 15\text{s}$ window around the evaluated time bucket**.
- Z-score:
  $$z = \frac{x_t - \mu_{\text{local}}}{\sigma_{\text{local}} + \epsilon}$$

---

## 5. Viewer Sequence Trajectory Reasoning

Events are **not** viewers. Frame Sense tracks each viewer's session journey relative to candidate anomaly windows $[t_{\text{start}}, t_{\text{end}}]$:

- **`unique_exposed`**: Count of unique viewers present in the timecode window.
- **`unique_permanent_exits`**: Viewers whose session ended around the window and **never returned or continued playback**.
- **`unique_replayed_and_continued`**: Viewers who rewound/replayed in the window and continued watching to completion.
- **`unique_continued`**: Viewers who continued playback past $t_{\text{end}} + 3\text{s}$.

### Classification & Editorial Mapping Rules

| Trajectory Condition | Anomaly Taxonomy Title | Domain | Editorial Recommendation |
| :--- | :--- | :--- | :--- |
| $N_{\text{replayed}} \ge 1 \land N_{\text{continued}} \ge N_{\text{exits}}$ | `Emotional Scene Replay Hotspot` | `EMOTIONAL` | **B-Roll Reaction Insert & Sound Design**: Insert 1.2s B-Roll reaction shot to reward viewer curiosity. |
| $N_{\text{paused}} \ge 1 \land N_{\text{continued}} > N_{\text{exits}}$ | `Cognitive Comprehension Barrier` | `COGNITIVE` | **Dialogue Enhancement & B-Roll Re-Pacing**: Boost dialogue clarity (+3dB), duck score (-4dB), or extend shot +1.2s — do NOT trim video. |
| $N_{\text{perm\_exits}} \ge 1 \land N_{\text{perm\_exits}} \ge N_{\text{continued}} \land \text{rate} \ge 0.15$ | `Critical Scene Exit Drop` | `RETENTION` | **Scene Cut & Match Cut**: Re-anchor visual perspective with an over-the-shoulder medium close-up. |

---

## 6. Scientific Honesty Taxonomy

Every generated editorial finding is structured strictly into 4 parts:

1. **`OBSERVATION`**: Pure empirical telemetry evidence (counts, rates, z-scores, Wilson bounds, viewer trajectory counts).
2. **`INTERPRETATION`**: Behavioral meaning of signals (e.g., audience abandonment vs dialogue comprehension friction).
3. **`HYPOTHESIS`**: Multimodal visual/narrative rationale derived from Gemini 3.5 Flash / Gemini 3.5 Flash-Lite keyframe analysis.
4. **`VALIDATION`**: Proposed editing action, evidence quality tier, and sample exposure category.

---

## 6. Real-Anchored Telemetry Simulator

The synthetic audience simulator supports testing at scale (1,000+ viewers) while preserving real viewer patterns:

| Mode | Real Viewer Threshold | Behavior |
|---|---|---|
| `REAL_ANCHORED` | $\ge 10$ real viewers | Time-local probabilities derived directly from actual ClickHouse telemetry. |
| `HYBRID` | $1–9$ real viewers | Blends observed real behavioral fingerprint with generic priors. |
| `COLD_START` | $0$ real viewers | Generic probabilistic profile model & ground truth. |

---

## 7. API Endpoints

```
GET /api/v1/screenings/{screening_id}/audience/overview
GET /api/v1/screenings/{screening_id}/audience/retention?bucket_sec=10
GET /api/v1/screenings/{screening_id}/audience/signals?bucket_sec=10
GET /api/v1/screenings/{screening_id}/audience/anomalies?bucket_sec=10
POST /api/v1/screenings/{screening_id}/dev/simulate?num_viewers=1000
```
