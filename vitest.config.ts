import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core:unit',
          root: 'core',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'core:server',
          root: 'core',
          include: ['tests/server/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['tests/setup-server.ts'],
        },
      },
      {
        test: {
          name: 'core:dev',
          root: 'core',
          include: ['tests/dev/**/*.test.ts'],
          environment: 'node',
        },
        define: {
          'import.meta.dev': true,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'core/server/**/*.ts',
        'core/app/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/tests/**',
        '**/.nuxt/**',
        '**/.output/**',
        '**/node_modules/**',
      ],
    },
  },
})
