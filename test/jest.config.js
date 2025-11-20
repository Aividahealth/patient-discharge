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
  // Transform ES modules in node_modules (like uuid v13+)
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)',
  ],
  // Map uuid to CommonJS version if available
  moduleNameMapper: {
    '^uuid$': require.resolve('uuid'),
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.spec.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageDirectory: './coverage',
};
