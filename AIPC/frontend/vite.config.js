import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/aipc',
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/aipc-api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        ws: true,
      },
      '/aipc/docs': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/aipc\/docs/, '/aipc-api/docs'),
      },
      '/aipc/redoc': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/aipc\/redoc/, '/aipc-api/redoc'),
      },
      '/aipc/health': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/aipc\/health/, '/aipc-api/health'),
      },
      '/aipc/openapi.json': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/aipc\/openapi\.json/, '/aipc-api/openapi.json'),
      },
    },
  },
})
