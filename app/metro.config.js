// Metro config for the Expo app inside a pnpm monorepo.
//
// pnpm's symlinked + .pnpm/ store layout can resolve react / react-native /
// react-native-web through more than one path, which leaves Metro bundling
// duplicate copies. Two copies of React mean a Context registered with one
// instance is unreadable by the other, surfacing as the cryptic
// "Cannot read properties of null (reading 'useContext')" inside RN-Web
// when components like @expo/vector-icons hit Text/View internals.
//
// This config:
//   • watches the workspace root so changes outside /app trigger reloads;
//   • points resolution at both the project's node_modules and the
//     workspace root's node_modules (so hoisted packages resolve);
//   • disables hierarchical lookup to make resolution deterministic — Metro
//     uses only the explicit nodeModulesPaths above.
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

config.resolver.disableHierarchicalLookup = true;

module.exports = config;
