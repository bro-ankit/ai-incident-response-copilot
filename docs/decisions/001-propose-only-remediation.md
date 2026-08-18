# ADR-001: Remediation Is Propose-Only

**Status:** Accepted
**Date:** 2026-08-13

## Context

`RemediationAgent` produces concrete, actionable steps (rollback, scale up, restart, config change)
from a root-cause hypothesis. Nothing in the architecture prevents wiring those steps to an execution
layer that actually carries them out — a "fully autonomous" incident responder is a natural-sounding
next step, and one worth deciding against explicitly rather than by omission.

## Decision

### The system investigates and recommends; it never acts

`RemediationResponse` is a list of proposed steps with a rationale and risk level per step — a data
structure, not a callable action. There is no code path anywhere in this project that executes a
remediation step; every step requires a human to read it, decide, and carry it out themselves. This
was true from the project's original framing ("a copilot, not an autonomous actor") and stayed true
through implementation rather than getting relaxed under "we already built the pipeline, may as well
wire it up" pressure.

### Confidence gating is a second, independent layer in front of the first

Even before a remediation proposal is generated, `OrchestratorService` checks the root-cause
hypothesis's confidence against `ROOT_CAUSE_CONFIDENCE_THRESHOLD` and skips remediation entirely below
it, flagging the case for human review instead. So there are two separate gates, not one: "is the
diagnosis itself trustworthy enough to act on" (confidence threshold, before remediation runs), and
"should this proposal ever be carried out" (human approval, always, regardless of confidence). Neither
gate substitutes for the other — a highly confident hypothesis still only produces a _proposal_.

### The reasoning behind this generalizes past this one project

An LLM's self-reported confidence is not a calibrated probability — a model can be confidently wrong,
and there is no way to guarantee a hallucination-free root-cause hypothesis. Rather than chase that
unreachable guarantee, the system is designed so a wrong output can't cause real damage: the worst
case for a bad hypothesis is a human reads a bad suggestion and ignores it, not a bad suggestion
executing against production. This is the same principle a mature eval/observability practice
reinforces after the fact (Milestone 6's judge scores correctness and groundedness precisely so
confidence can eventually be _empirically_ calibrated against outcomes, rather than trusted at face
value) — but the propose-only boundary doesn't depend on the eval harness existing or being accurate;
it holds even if every hypothesis this system ever produces turns out wrong.

## Consequences

- Adding real execution later (e.g. a "confirm and run" button that calls a deployment API) is a
  deliberate, separate, explicitly-approved feature — not a natural extension that falls out of
  existing code, which is intentional friction.
- The API contract (`InvestigationResultDto.remediationSteps`) can only ever be null or a list of
  proposals — there is no "status: executed" state to design around, keeping the response shape
  simple.
- Any future action-authorization work (role-scoped approval, an audit trail on who approved what) is
  additive on top of this boundary, not a replacement for it — the propose-only line stays fixed
  regardless of how approval itself gets built out.
