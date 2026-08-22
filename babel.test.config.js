// Babel config used ONLY by Jest (see jest.config.js). Kept separate from
// Metro's bundling pipeline, which has no babel.config.js of its own and
// should not be affected by adding a test setup.
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
};
