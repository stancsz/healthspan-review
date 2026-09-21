# Local Measurement Review Pack v0.1

The local-first review workflow turns a SECA TableView CSV into an auditable
packet without uploading the source file. The visible and downloaded packet
records the source format and measurement date, each mapped value and unit,
observed-versus-derived provenance, unmapped rows, unit warnings, derivations,
and the remaining minimum-viable-vector inputs.

The packet does not calculate an FI from a SECA scan alone. It displays null
numerator and denominator fields until the existing MVV-gated assessment path
is completed, and explains that missing FI items are excluded rather than
imputed. When two dated scans exist, deltas are descriptive matched-label
equipment measurements only. They are not evidence of improved health or an
action effect.

Users can download deterministic JSON or print the packet locally. The packet
does not contain the raw CSV or a patient identifier. It is for research and
wellness measurement review only, with no diagnosis, treatment advice, or
validated biological/system age. E-005 remains blocked.

This implementation prepares the frozen workflow surface for the five-user IR1
comparison in `docs/CLINICIAN_WORKFLOW_STUDY.md`. No participant sessions or
real-user results have been completed.

## Clinician-flow interaction prototype, 2026-09-19

An owner-private interaction prototype tests one end-user sequence: clinicians
start with a synthetic measurement ledger, inspect units, provenance and a
missing-input warning, read the FI numerator/denominator caveat, then request a
clinician-edited documentation draft. Its MiniMax M3 endpoint accepts only the
fixed synthetic demo record and rejects every other payload. It is not a
patient-data service, clinical deployment, usability study, or evidence of
clinical utility. The five-user IR1 comparison remains required.
