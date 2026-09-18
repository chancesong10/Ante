// Minimal react-native stand-in for the Node-environment unit tests.
//
// The real package ships untranspiled Flow and JSX, and jest.config.js
// deliberately skips node_modules in transformIgnorePatterns, so any module
// under test that imports react-native takes the whole suite down with a
// parse error. That started mattering when SyncContext began listening to
// AppState to retry a failed sync on foreground.
//
// Only the surface the contexts actually touch is modelled. Anything else
// should fail loudly rather than silently return undefined, so add to this
// deliberately rather than broadening it.
module.exports = {
  AppState: {
    currentState: 'active',
    // Returns the subscription shape the callers unsubscribe through.
    addEventListener: () => ({ remove: () => {} }),
  },
  Platform: {
    OS: 'ios',
    select: (options) => (options && 'ios' in options ? options.ios : options?.default),
  },
};
