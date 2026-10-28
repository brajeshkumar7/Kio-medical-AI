# Safety moderation

The production application wraps its QA service in `SafetyCheckedMedicalQA`.
Both account endpoints (JSON and streaming) and guest streams use that wrapper,
including when evidence review is disabled. There is no runtime safety bypass.
Tests must explicitly inject a fake safety checker; injecting a QA service alone
does not bypass moderation.

## Configuration and behavior

Use the backend root `.env` setting:

```env
OPENROUTER_SAFETY_MODEL=nvidia/nemotron-3.5-content-safety
```

This is a paid classifier, called once before retrieval and once on the full final
answer. Each call has a 20-second request timeout and zero automatic retries.
Safety requests explicitly require a ZDR endpoint. Account-level restrictions
still apply. The legacy `:free` endpoint may be blocked by those restrictions.
The implementation does not edit your real environment file or relax privacy.

The classifier keeps reasoning enabled with a bounded 1,024-token completion
budget, shared by reasoning and final labels. The previous 256-token limit could
expire before a verdict even when OpenRouter returned HTTP 200. Reasoning text
is excluded from returned content. Disabling reasoning was rejected during
verification because it falsely refused a supportive help-seeking case.
Truncated responses remain unavailable; a missing label is never treated as safe.

The adapter follows NVIDIA's user-prompt/optional-assistant-response format:
[model card](https://build.nvidia.com/nvidia/nemotron-3.5-content-safety/modelcard).
Recent conversation context is bounded by `HISTORY_MESSAGE_LIMIT` and serialized
with the latest message as input data. Classifier labels are parsed strictly;
missing, contradictory, truncated, or malformed labels are unavailable decisions.
Labels and categories are never included in assistant responses.

Unsafe input skips retrieval and generation. Unsafe output is replaced with a
fixed, nonjudgmental safe-redirection message, without citations. A delivered
redirection is stored as the assistant reply and consumes one guest question.
The rejected generated answer is never sent or stored.

The full answer is buffered after evidence review and before output approval,
so time to first answer text increases. `start` may arrive while the spinner is
still visible. Approved chunks keep their original text and order. Sources are
withheld from the start event and become available in the approved completed
assistant message; a redirection has no sources.

If classification is unavailable, APIs return a generic retry message with code
`SAFETY_CHECK_UNAVAILABLE`: HTTP 503 before stream start, or an `error` event
after start. No unapproved answer deltas are emitted. Input failure does not save
a user turn. A later account stream failure retains its existing user turn;
guest failures remove the unanswered turn and refund the reserved quota.
Existing disconnect accounting is unchanged.

Logs contain stage, allow/block/unavailable outcome, model ID, and duration.
Unavailable results also include a sanitized failure reason, finish reason,
and completion/reasoning token counts when supplied by the provider.
They omit conversation text, raw classifier output, and upstream exception
messages. Do not enable SDK HTTP debug logs on real conversations.
Configure the `backend.services.safety` logger at INFO level in deployment to
collect allowed/blocked outcomes; unavailable checks are logged at WARNING.

## Verification and release

Run mocked tests with no API calls:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```

In staging, run the versioned **synthetic** acceptance corpus. This makes paid
provider calls and prints case IDs, outcomes, and latency, without raw text:

```powershell
.\.venv\Scripts\python.exe -m backend.jobs.evaluate_safety
```

Review false refusals, missed unsafe cases, provider failures, and p50/p95 latency.
In particular, legitimate sexual-health questions, mental-health support, and
supportive help-seeking must not be treated as requests for harmful instructions.
These cases express the application's acceptance goals, not a claim that the
pretrained classifier already satisfies them. No keyword exception overrides an
unsafe decision. A failing corpus blocks production rollout until reviewed.

Expand this small corpus with human-reviewed cases in the languages you serve,
including contextual follow-ups and adversarial instructions. Passing these
cases is necessary but does not establish medical accuracy, emergency triage,
or comprehensive safety. Keep the existing evidence review and evaluate clinical
grounding separately. No database migration or re-embedding is needed.

## Local staging observation — 27 October 2026

The paid endpoint accepted the synthetic input/output smoke checks. On the
12-case v1 corpus, 11 cases returned their expected decisions. The adversarial
`output-label-injection` case returned an unavailable decision and was withheld
by the gate. There were zero observed false refusals and zero unsafe approvals;
p50 classification latency was 1,296 ms and p95 was 1,453 ms in this single run.

The evaluator exited nonzero because the unreadable result remains a release
gate. This is a small synthetic integration check, not production certification.
Investigate provider/format reliability and expand the evaluation before rollout;
do not weaken parsing to turn this result into a passing score.

## Classification reliability follow-up on 28 October 2026

Synthetic diagnosis reproduced an HTTP-200 response with `finish_reason=length`,
256 completion tokens and empty final content when reasoning exhausted the
previous budget. With reasoning enabled and the budget raised to 1,024, the
same 12-case v1 corpus returned all expected decisions: zero unavailable results,
false refusals or missed unsafe cases in this run. The previously unreadable
`output-label-injection` case completed and was correctly blocked. Observed p50
was 1,250 ms and p95 was 2,641 ms. These are single-run observations, not latency
guarantees or comprehensive medical/safety certification.

The historical observation above remains recorded for comparison. The token
budget change requires a backend redeploy; it does not require new environment
values, data migrations or re-embedding. Keep fail-closed handling for future
truncations, provider failures and invalid labels.
