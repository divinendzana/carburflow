import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  // Activer avec: VITE_TUNNEL=1 npm run dev
  // (requis pour Dev Tunnels / Cloudflare — HMR en wss:443)
  const tunnel = env.VITE_TUNNEL === '1' || process.env.VITE_TUNNEL === '1'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: true,
      port: 5174,
      strictPort: true,
      // Sans ça, Vite renvoie une page « host not allowed » (pas du JS)
      // → le navigateur bloque @vite/client (MIME interdit / vide)
      allowedHosts: [
        '.use.devtunnels.ms',
        '.devtunnels.ms',
        '.trycloudflare.com',
        '.ngrok-free.app',
        '.ngrok-free.dev',
        '.ngrok.app',
        '.ngrok.io',
      ],
      ...(tunnel
        ? {
            hmr: {
              protocol: 'wss',
              clientPort: 443,
            },
          }
        : {}),
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8001',
          changeOrigin: true,
        },
        '/docs': {
          target: 'http://127.0.0.1:8001',
          changeOrigin: true,
        },
        '/schema': {
          target: 'http://127.0.0.1:8001',
          changeOrigin: true,
        },
        '/redoc': {
          target: 'http://127.0.0.1:8001',
          changeOrigin: true,
        },
      },
    },
  }
})
