const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Metro's "package exports" resolver (on by default since SDK 52) has known
// bugs resolving nested node_modules/expo/node_modules/* packages on Windows
// (e.g. "Unable to resolve expo-asset from .../Expo.fx.tsx" even though the
// file exists) — fall back to plain "main"-field resolution instead.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
