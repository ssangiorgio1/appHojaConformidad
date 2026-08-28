import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @wara/shared ships raw TypeScript (no build step, see packages/shared/package.json) —
  // Next needs to know to transpile it instead of treating it as pre-built JS.
  transpilePackages: ['@wara/shared'],
  // Lets devices on the LAN (phones, other laptops) hit the dev server by IP
  // instead of only localhost.
  allowedDevOrigins: ['192.168.0.152'],
  turbopack: {
    // packages/shared's internal imports use explicit ".js" extensions on
    // relative specifiers (e.g. `./checklist.js`), as required by the api
    // package's NodeNext TypeScript resolution (and replicated for Metro
    // via mobile/metro.config.js's custom resolver). Turbopack has no
    // built-in "resolve .js to sibling .ts" behavior and no generic
    // extensionAlias option, so alias each one explicitly — targets are
    // resolved relative to this config file (web/), not to the importing
    // module, so they must point back into packages/shared/src.
    resolveAlias: {
      './checklist.js': '../packages/shared/src/checklist.ts',
      './equipo.js': '../packages/shared/src/equipo.ts',
      './photoSlots.js': '../packages/shared/src/photoSlots.ts',
      './types.js': '../packages/shared/src/types.ts',
    },
  },
};

export default nextConfig;
