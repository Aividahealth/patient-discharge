module.exports = {
  displayName: 'DischargeExport',
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
  testMatch: [
    '<rootDir>/**/*.spec.ts',
    '<rootDir>/**/*.test.ts',
  ],
  collectCoverageFrom: [
    '../**/*.ts',
    '!../**/*.spec.ts',
    '!../**/*.test.ts',
    '!../**/index.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/../../$1',
  },
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testTimeout: 10000,
  verbose: true,
};
