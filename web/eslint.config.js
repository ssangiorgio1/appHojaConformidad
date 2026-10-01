import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default [
  // components/charts y shimmering-text son código de bklit-ui copiado por shadcn: no se lintea.
  { ignores: ['.next/**', 'node_modules/**', 'src/components/charts/**', 'src/components/shimmering-text.tsx'] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
