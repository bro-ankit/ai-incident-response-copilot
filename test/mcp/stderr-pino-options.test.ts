import { buildStderrPinoHttpOptions } from '../../src/mcp/stderr-pino-options';

describe('Given buildStderrPinoHttpOptions', () => {
  describe('When isProduction is false', () => {
    test('Then it returns a pino-pretty transport pointed at stderr (fd 2), with no stream option', () => {
      const options = buildStderrPinoHttpOptions(false);

      expect(options).toEqual({ transport: { target: 'pino-pretty', options: { destination: 2 } } });
    });
  });

  describe('When isProduction is true', () => {
    test('Then it returns a raw pino destination stream targeting fd 2, with no transport option', () => {
      const options = buildStderrPinoHttpOptions(true);

      expect(options).toEqual({ stream: expect.any(Object) });
      expect((options as unknown as { stream: { fd: number } }).stream.fd).toBe(2);
    });
  });
});
