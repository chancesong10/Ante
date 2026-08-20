module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  transform: {
    '^.+\\.js$': ['babel-jest', { configFile: './babel.test.config.js' }],
  },
  transformIgnorePatterns: ['/node_modules/'],
};
