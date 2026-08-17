import pino from 'pino';
import type { Options } from 'pino-http';

export function buildStderrPinoHttpOptions(isProduction: boolean): Options {
  return isProduction
    ? { stream: pino.destination(2) }
    : { transport: { target: 'pino-pretty', options: { destination: 2 } } };
}
