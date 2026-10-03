# AI Specification

AI features are **disabled by default** and arrive in phases 15 to 17. This
document defines the boundary before any provider is chosen, so that the boundary
is a design decision rather than an accident of whichever SDK was installed first.

## The problem this document exists to solve

An HRIS holds national identity numbers, salaries, medical leave reasons,
disciplinary records and union agreements. Handing that to a third-party model
provider is a data transfer to an external processor, in most jurisdictions a
notifiable one, and in some a prohibited one regardless of consent.

So the rule is not "use AI carefully". The rule is: **the model never receives
personal data, and receives nothing the user has not already seen.**

## Principles

1. **Disabled by default.** No AI call happens unless `AI_ENABLED=true` *and* the
   feature is enabled for the company. Absence of configuration must never mean
   "on".
2. **Provider-agnostic.** A single interface with multiple adapters. The choice of
   provider is configuration, and switching it is not a code change.
3. **No personal data outbound.** No national identity numbers, no names, no
   salaries, no medical data, no free-text leave reasons, no disciplinary notes.
   Where a task needs narrative, it runs against de-identified aggregates.
4. **The user always reviews.** AI output is a draft. A human approves anything
   that affects an employee's record, entitlement or pay. There is no path where a
   model writes payroll directly.
5. **Deterministic and explainable.** Same input, same output, with the reasoning
   trace retained. A system that computes money must be reproducible.
6. **Bounded and observable.** Hard token and cost ceilings per request, per
   company and per month. Every call logged with token counts and latency.

## Planned features

| Phase | Feature                        | Data sent                     | Human in the loop |
| ----- | ------------------------------ | ----------------------------- | ----------------- |
| 15    | Resume and JD parsing          | The uploaded document         | Yes, always       |
| 15    | Employee self-service FAQ      | Published policy text only    | No, but read-only answers |
| 16    | Payroll anomaly detection      | Aggregates and statistics only | Yes, before any adjustment |
| 16    | Attendance anomaly detection   | Counts and distributions only | Yes                |
| 17    | Attrition risk indicators      | Aggregates only               | Yes, never automated action |
| 17    | Semantic search over policies  | Published documents           | No                 |

### Explicitly never sent to a model

- Individually identifiable performance reviews
- Disciplinary or grievance records
- Medical, disability or accommodation data
- Compensation, payslip or bank detail data
- Union membership and collective bargaining terms
- Immigration status and work permit data
- Exact home addresses or live location history

## Architecture

```
  Application service
        │  (already holds de-identified data)
        ▼
  ┌────────────────────┐
  │  AiGateway         │  enablement, budget, audit, redaction
  └─────────┬──────────┘
            │  AiProvider interface
     ┌──────┼───────┬──────────────┐
     ▼      ▼       ▼              ▼
  OpenAI  Azure   Bedrock    Local model
  (none enabled by default)
```

The gateway is the only component that talks to a provider. Business code depends
on the interface, never on a vendor SDK, so a provider can be added, replaced or
disabled without touching a single feature module.

### Responsibilities

The gateway enforces, in this order:

1. **Enablement** — feature flag, company configuration, user permission.
2. **Redaction** — a deny-by-default filter. Patterns are matched and removed
   before the request is constructed; the caller cannot opt out.
3. **Budget** — per-request token ceiling, per-company monthly spend ceiling.
   Exceeding either fails closed with a clear error, never silently degrading.
4. **Provider call** — with a hard timeout and a retry ceiling.
5. **Audit** — model, version, prompt hash, token counts, latency, cost, and the
   de-identified input. Never the raw personal data.
6. **Output validation** — the response is parsed against an expected schema
   before any caller sees it.

Redaction runs on the request, not on the response. Assuming a model will not
echo sensitive input is how personal data ends up in a transcript.

## Configuration

Already present in `.env.example`, all inert:

| Variable          | Default    | Meaning                                     |
| ----------------- | ---------- | ------------------------------------------- |
| `AI_ENABLED`      | `false`    | Global master switch                         |
| `AI_PROVIDER`     | `openai`   | Which adapter to use                         |
| `AI_API_KEY`      | _(empty)_  | Required only when enabled                   |
| `AI_MODEL`        | _(empty)_  | Defaults to a pinned version per adapter     |
| `AI_TIMEOUT_MS`   | `60000`    | Hard request ceiling                         |

No key is required while the feature is off, so a deployment cannot accidentally
have working credentials for a feature nobody intended to enable.

## Local model support

For jurisdictions where data residency prohibits sending HR data outside the
company, a self-hosted model is a first-class adapter rather than an afterthought.
Because the gateway is the only integration point, supporting it is a
configuration change plus a deployment concern.

## Explicit non-goals

- No model ever writes to the database without human approval.
- No model is used to score an individual employee for disciplinary or termination
  purposes. Employment decisions carry legal consequences and a bias audit
  requirement that a model cannot meet.
- No prompt, response or embedding is retained for provider-side training. Where a
  provider cannot guarantee this in its terms, that provider is not used.
- No facial recognition, emotion inference or health inference from video or
  audio. These are unreliable, legally restricted in several jurisdictions, and
  unacceptable in an employment context.

## Before any feature ships

- [ ] Redaction deny-list tested with adversarial fixtures containing real
      personal-data shapes
- [ ] The provider's data retention and training terms reviewed and recorded
- [ ] Data residency confirmed for the company's jurisdiction
- [ ] Cost ceiling tested by forcing an overrun
- [ ] Output schema validation tested with malformed and hostile responses
- [ ] Human approval step present and tested
- [ ] Audit record written for every call, verified by an automated test
- [ ] AI availability cannot affect a correctness or integrity guarantee: the
      feature degrades to "unavailable", never to "silently wrong"
