// Metro config for the Expo app inside a pnpm monorepo.
//
// pnpm's symlinked + .pnpm/ store layout can resolve some packages through
// more than one path. Two copies of React mean a Context registered with
// one instance is unreadable by the other, surfacing as the cryptic
// "Cannot read properties of null (reading 'useContext')" inside RN-Web.
//
// This config:
//   • watches the workspace root so changes outside /app trigger reloads;
//   • points resolution at both the project's node_modules and the
//     workspace root's node_modules (so hoisted packages resolve).
//
// We previously also set `disableHierarchicalLookup: true` to fight a
// duplicate react-native-web bug on web. Disabling hierarchical lookup
// breaks NATIVE builds though — packages like whatwg-fetch (an Expo
// metro-runtime peer dep) live in a deeply-hoisted path that the
// hierarchical walker is the only resolver that finds. So we keep
// hierarchical lookup on; the explicit nodeModulesPaths above are
// sufficient to deduplicate on web.
//
// Reference: https://docs.expo.dev/guides/monorepos/

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Firebase v11 (and many other packages) ship multiple builds via
// package.json `exports` conditions. Without explicitly telling Metro
// to prefer the `react-native` condition, the bundler picks the
// browser build on native — which uses XMLHttpRequest paths that don't
// work in React Native and surface as auth/network-request-failed on
// every Firebase Auth call. Adding it to unstable_conditionNames makes
// Metro pick the RN-specific exports for firebase/auth, etc.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['require', 'react-native', 'default'];

module.exports = config;
