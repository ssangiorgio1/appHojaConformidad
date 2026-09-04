const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Metro only watches/resolves within projectRoot by default. @wara/shared is
// a symlink pointing outside mobile/ (into ../packages/shared), so the
// monorepo root needs to be an explicit watch folder for Metro to see it.
config.watchFolders = [...config.watchFolders, workspaceRoot];

// pnpm's virtual store (normally node_modules/.pnpm, inside workspaceRoot)
// can be relocated elsewhere via `virtualStoreDir` in pnpm-workspace.yaml —
// done on some Windows machines to keep dependency paths under the 260-char
// limit. When relocated, package real files live outside workspaceRoot, so
// Metro can't resolve them unless that location is also a watch folder.
// Metro maps a resolved file's URL by taking its path relative to
// `server.unstable_serverRoot` (defaults to projectRoot) — a relocated store
// living outside workspaceRoot needs a "../"-free relative path, so the
// server root has to move up to a common ancestor of both, or requests 404.
try {
  const reactNativeRealPath = fs.realpathSync(path.join(workspaceRoot, 'node_modules', 'react-native'));
  const storeRoot = path.dirname(path.dirname(path.dirname(reactNativeRealPath)));
  if (!reactNativeRealPath.startsWith(workspaceRoot)) {
    if (!config.watchFolders.includes(storeRoot)) config.watchFolders.push(storeRoot);
    config.server.unstable_serverRoot = path.parse(workspaceRoot).root;
  }
} catch {}

// packages/shared uses explicit ".js" extensions on relative imports (e.g.
// `./checklist.js`), as required by the api package's NodeNext TypeScript
// resolution. Metro resolves import specifiers literally and doesn't know
// that convention, so teach it: if a requested "*.js" doesn't exist, retry
// as the sibling ".ts"/".tsx" source file.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isRelativeJs = moduleName.endsWith('.js') && (moduleName.startsWith('./') || moduleName.startsWith('../'));

  if (isRelativeJs) {
    const originDir = path.dirname(context.originModulePath);
    for (const ext of ['.ts', '.tsx']) {
      const candidate = moduleName.slice(0, -3) + ext;
      if (fs.existsSync(path.resolve(originDir, candidate))) {
        return context.resolveRequest(context, candidate, platform);
      }
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
