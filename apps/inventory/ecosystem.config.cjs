module.exports = {
  apps: [
    {
      name: 'ryp-inventory',
      script: '.output/server/index.mjs',
      cwd: 'C:/Users/Mac/Desktop/ATR/monorepo/apps/inventory',
      interpreter: 'C:/Users/Mac/AppData/Roaming/npm/node_modules/bun/bin/bun.exe',
      env: {
        NODE_ENV: 'production',
        PORT: '3002',
      },
    },
  ],
}
