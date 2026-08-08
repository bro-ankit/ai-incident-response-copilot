# Next Project Plan: AI Incident Response Copilot (new repo)

## Context

This document exists because the `smart-semantic-bookmarking-and-memory-engine` session got long and Phase 1 of that project is done (17/17 eval cases, 0.94 avg relevance, 1.0 avg faithfulness, hybrid search + reranking + human review + agent tool use, all shipped and documented). Full history/reasoning for Phase 1 lives in that repo's `.claude/roadmap.md` and `docs/decisions/*.md` — read those first if you need the "why" behind any Phase 1 choice referenced here.

**This plan replaces an earlier draft that proposed a standalone MCP-server repo wrapping the bookmark engine.** That idea was explicitly rejected: MCP is a thin protocol adapter, not a new domain, and wrapping an existing project in a new protocol doesn't "widen the horizon" — it's the same skills in a new coat of paint. The actual decision made: build something in a genuinely new domain, and use MCP _inside_ it as real connective tissue (agents reaching real external tools), not as the whole point of the repo.

---

## Why This Domain

Phase 1 (RAG-over-bookmarks) already covers: hybrid retrieval, reranking, evals, human review, and single-agent tool use (one agent, one control loop, calling its own tools). The single biggest gap it does _not_ cover, and the one Ankit's own job-market gap analysis flagged as high priority, is **multi-agent orchestration** — multiple specialized agents coordinating, handing off findings to each other, and a system that has to keep working when one sub-agent fails.

An incident response copilot is a strong vehicle for that specifically because:

- It requires genuinely different agents doing genuinely different jobs (log analysis vs. runbook search vs. root-cause synthesis vs. remediation), not four agents that could secretly be one agent with more tools
- It's directly authentic to Ankit's real production background (payments reliability at scale, Kubernetes, on-call, resilience patterns already demonstrated in Phase 1) — this is a system he's lived the pain of needing, not a toy demo picked for portfolio optics
- It raises the stakes on "never blindly trust AI output" past where Phase 1 left it: Phase 1's human review gates _content_ before it's trusted; this project's remediation step gates _actions with real consequences_ (restart a service, roll back a deploy) — a meaningfully harder and more relevant safety problem for 2026 AI engineering interviews
- It's a legitimate, non-contrived reason to use MCP: agents need to reach log sources and a runbook knowledge base, which are exactly the kind of external tool connections MCP exists for

---

## What to Build

A multi-agent system that takes an incident (an alert, an error log snippet, or a short incident description) and produces an investigated, ranked diagnosis with a proposed remediation — not an autonomous "fix it" system, a copilot that investigates and recommends, gated by human approval before anything real happens.

### Agents

- **Orchestrator / Planner** — receives the incident, decides which sub-agents to dispatch and in what order, collects their findings, decides when investigation is sufficient vs. needs another pass
- **Log Analysis Agent** — searches/parses logs for error patterns, stack traces, and timing correlation around the incident window
- **Runbook Search Agent** — semantic + lexical search (this is where Phase 1's hybrid search + reranking pattern gets _reused as a skill_, applied to a new corpus: runbooks and past postmortems, not bookmarks) for similar past incidents and known fixes
- **Root-Cause Hypothesis Agent** — synthesizes log findings and runbook matches into a ranked list of probable root causes with reasoning and confidence
- **Remediation Agent** — given the hypothesized root cause, proposes concrete remediation steps (rollback, scale up, restart, config change) — proposes only, never executes without explicit human approval

### MCP layer

Agents reach their tools (log search, runbook search) through actual MCP servers, not direct in-process function calls — this is the real, motivated use of MCP the earlier standalone-wrapper plan was missing. Start with:

- One MCP server wrapping a log search tool (a synthetic/seeded incident log dataset is fine to start — the point is learning the protocol and multi-server client behavior, not sourcing real production log access)
- One MCP server wrapping the runbook knowledge base search

Multiple MCP servers being called by the same orchestrator is itself a meaningful step beyond Phase 1's single in-process tool executor — it's the first time this portfolio has an agent client managing more than one external tool connection through a standard protocol.

### Failure recovery (the actual multi-agent skill)

Design explicitly for: what happens when the Log Analysis Agent times out, the log source is unreachable, or the Root-Cause Hypothesis Agent's confidence is too low to proceed. This should degrade gracefully — the orchestrator reports partial findings and flags what it couldn't determine, the same "tell the user rather than hallucinate" discipline from Phase 1's Day 10 agent (`searchBookmarks` returning 0 results), leveled up to a multi-agent context where the failure of one specialist shouldn't silently corrupt the whole investigation.

### Evals

Reuse the LLM-as-judge methodology from Phase 1, applied to a new question: given a seeded incident with a known ground-truth root cause, did the system's hypothesis correctly identify it, and was the reasoning grounded in what the sub-agents actually found (not hallucinated)? This is the strongest single piece of evidence that the eval-harness skill from Phase 1 generalizes — it's not "I know how to eval RAG," it's "I know how to eval whether a multi-agent system reached the right conclusion for the right reasons."

---

## What You Learn / Interview Story Value

- **Multi-agent orchestration**: specialized agents with genuinely different jobs, coordinated by a planner, handing off findings — not four tools bolted onto one agent
- **MCP in a real multi-server context**: an orchestrator managing more than one external tool connection through the protocol, not a single wrapper demo
- **Higher-stakes safety design**: gating _actions with consequences_ behind human approval, a step up from Phase 1's gating of _content_
- **Evals as a transferable skill**: the same LLM-as-judge discipline applied to "did this system diagnose the right root cause," proving the methodology isn't RAG-specific
- **A genuinely different interview story**: "I built a multi-agent incident response copilot, informed by my own production on-call experience" is a distinct narrative from the RAG/bookmarking project, which is exactly the portfolio breadth this was meant to solve

---

## Suggested Build Order

1. Scaffold the new repo (NestJS, same pattern as Phase 1 — reuse the framework knowledge, spend the new-concept budget on the multi-agent architecture, not on relearning a framework)
2. Build a synthetic incident/log dataset — seed a small set of realistic incidents with known ground-truth root causes (this is also what the eval harness will score against later, so design it with that in mind from the start)
3. Build the Runbook Search Agent first in isolation — it's the most similar to Phase 1's existing hybrid search work, lowest new-concept risk, good warm-up
4. Stand up the two MCP servers (log search, runbook search) and verify a single agent can call each one correctly before adding orchestration
5. Build the Orchestrator + remaining agents, get one incident flowing end to end through the full pipeline
6. Add the failure-recovery paths deliberately — don't just handle the happy path and hope; explicitly test what happens when a sub-agent fails or times out
7. Build the eval harness against the seeded incident set, get a real baseline score
8. README with the same rigor as Phase 1: architecture diagram, example incident walkthrough, eval numbers, and ADRs for the genuinely new decisions (why MCP with multiple servers, how failure recovery works, why remediation is propose-only)

---

## Deferred, Not Forgotten

- **Chunking strategies**: still not needed yet. Only becomes necessary once ingesting long, unchunked source documents (a Phase 3 "multi-agent research system" concern from the old plan, or possibly relevant here if runbooks/postmortems turn out to be long documents — reassess once the runbook corpus is actually being built in step 3 above)
- **Fine-tuning export**: still a Phase 1 loose end (the `corrections` table extension), unrelated to this project, pick up separately once Phase 1's review queue has accumulated real correction data

---

## Immediate Next Action

Start a new session/repo for the incident response copilot. Bring this file along as context. First concrete step: seed the synthetic incident dataset (step 2 above) before writing any agent code — the eval harness and the Runbook Search Agent both depend on that dataset existing first.
