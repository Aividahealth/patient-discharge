module.exports = {
  displayName: 'Portal Integration Tests',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/portals-integration.spec.ts'],
  testTimeout: 120000, // 2 minutes for setup
  verbose: true,
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.spec.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageDirectory: './coverage',
};
