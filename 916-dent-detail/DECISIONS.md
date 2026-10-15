# 916 Dent & Detail — project decisions & assumptions
| ID | Decision / assumption | Why |
|---|---|---|
| P-001 | Project lives in `916-dent-detail/` inside the org repo (branch `claude/916-dent-detail-build`). | Repo is the only persistent store; containers are ephemeral. |
| P-002 | Source video has an AAC audio stream and an embedded MJPEG cover stream; both stripped. 241 frames @24fps → ~120 frames means every 2nd frame. | Verified with ffprobe. |
| P-003 | No hero-video-wide.mp4 supplied → desktop uses the vertical scrub in a tall rounded panel (55% width) over blurred hero-beading.png. | Spec fallback. |
| P-004 | Everything external (Supabase, Stripe, Twilio, Resend, Anthropic, GA4, Meta) has a mock/no-key mode. | Hard gate: no accounts/spend by agents; app must run with zero keys. |
