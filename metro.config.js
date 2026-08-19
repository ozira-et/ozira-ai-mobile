// OZIRA Mobile -- Metro configuration.
//
// Default Expo Metro config does not follow symlinks. packages/ozira-app-core
// (in the ozira-ai repo) is linked here via a `file:` dependency, which npm
// installs as a real symlink -- see docs/app-platform/adr/0001 in ozira-ai
// for why (a `file:` dependency across two independently-shipping git repos,
// not a monorepo restructuring). Without this, Metro reports the shared
// package as unresolvable even though it is physically present via the
// symlink.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enableSymlinks = true;
// Belt and braces alongside unstable_enableSymlinks: Metro's Windows symlink
// handling has known gaps, so the real ozira-ai/packages directory is also
// watched directly and its packages resolved explicitly by name below.
// ozira-app-core's own internal `require('../../ozira-contracts')` needs
// ozira-contracts watched too, not just ozira-app-core itself.
const OZIRA_AI_PACKAGES = path.resolve(__dirname, '..', 'ozira-ai', 'packages');
config.watchFolders = [...(config.watchFolders || []), OZIRA_AI_PACKAGES];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'ozira-app-core': path.join(OZIRA_AI_PACKAGES, 'ozira-app-core'),
  'ozira-contracts': path.join(OZIRA_AI_PACKAGES, 'ozira-contracts'),
};

module.exports = config;
