// Monorepo: resolve shared packages from the repo root (see https://docs.expo.dev/guides/monorepos/)
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
// Work around Metro + package exports issues for some ESM bundles (e.g. engine.io-client)
// by falling back to CommonJS entry resolution.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
