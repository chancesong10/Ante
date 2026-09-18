module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  transform: {
    '^.+\\.js$': ['babel-jest', { configFile: './babel.test.config.js' }],
  },
  transformIgnorePatterns: ['/node_modules/'],
  // react-native ships untranspiled Flow/JSX and node_modules is deliberately
  // not transformed above, so a context that imports it (SyncContext needs
  // AppState) would fail the whole suite at parse time. See the mock for what
  // it covers.
  moduleNameMapper: {
    '^react-native$': '<rootDir>/test/mocks/react-native.js',
  },
};
