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
