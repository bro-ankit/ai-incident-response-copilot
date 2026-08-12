import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'test/tsconfig.json' }],
    '^.+\\.js$': ['ts-jest', { tsconfig: 'test/tsconfig.json', diagnostics: false }],
  },
  transformIgnorePatterns: ['/node_modules/(?!.*cockatiel)'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  injectGlobals: true,
  forceExit: true,
  maxWorkers: 1,
};

export default config;
