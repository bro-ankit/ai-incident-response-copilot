# AI Incident Response Copilot

Multi-agent system that investigates an incident (alert, error log, or short description) and
produces a ranked root-cause hypothesis with a proposed remediation. A copilot, not an autonomous
actor — any action with a real consequence is gated behind explicit human approval.

Phase 2 of a two-project portfolio arc, following `smart-semantic-bookmarking-and-memory-engine`
(RAG-over-bookmarks). This project's focus: multi-agent orchestration, MCP as real tool-connective
tissue, and higher-stakes safety gating. See `docs/phase-1-planning-doc.md` for the full rationale.

**Status:** scaffolding. No agents built yet.

## Stack

- NestJS + TypeScript, pnpm
- PostgreSQL + `pgvector` (Docker)
- Gemini API
- MCP (`@modelcontextprotocol/sdk`) for agent tool access

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm start:dev
```
