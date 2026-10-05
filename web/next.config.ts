import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
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
      './serviceMode.js': '../packages/shared/src/serviceMode.ts',
      './types.js': '../packages/shared/src/types.ts',
      './printHtml.js': '../packages/shared/src/printHtml.ts',
    },
  },
};

export default nextConfig;
