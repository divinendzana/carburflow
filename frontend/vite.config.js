import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Seuls /api (endpoints REST + analytiques via /api/v1) et les pages de
// documentation sont proxifiés vers Django. Les routes /dashboard/, /sites/,
// /cuves/, /groupes/ appartiennent au SPA React et ne doivent PAS être
// proxifiées, sinon un rechargement de page renvoie le HTML de Django.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/docs': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/schema': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/redoc': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
