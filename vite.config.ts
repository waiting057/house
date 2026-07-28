import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const envDir = 'environments'
  const env = loadEnv(mode, envDir, '')

  return {
    base: env.VITE_BASE_PATH || '/',
    envDir,
    server: { host: true, port: 5173 },
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    define: {
      APP_VERSION: JSON.stringify(env.VITE_APP_VERSION),
      APP_NAME: JSON.stringify(env.VITE_APP_NAME),
    },
  }
})
