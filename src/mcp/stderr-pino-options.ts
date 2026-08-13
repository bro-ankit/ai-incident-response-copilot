import pino from 'pino';
import type { Options } from 'pino-http';

// Stdio MCP transport uses stdout exclusively for JSON-RPC protocol frames —
// anything else written there (Nest's default logger, pino's stdout stream)
// corrupts the stream and breaks the client. Every log line here must go to
// stderr instead, which is safe for a human/log-collector to read but never
// parsed as protocol traffic. pino's `stream` and `transport` options are
// mutually exclusive, so pick one depending on environment rather than
// setting both.
export function buildStderrPinoHttpOptions(isProduction: boolean): Options {
  return isProduction
    ? { stream: pino.destination(2) }
    : { transport: { target: 'pino-pretty', options: { destination: 2 } } };
}
