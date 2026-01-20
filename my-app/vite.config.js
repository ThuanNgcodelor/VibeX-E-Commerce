import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      open: true,
      host: true,
      proxy: {
        // Proxy API requests to Gateway
        '/v1': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8080',
          changeOrigin: true,
        },
        // Proxy WebSocket to Gateway (for notifications/chat)
        '/ws': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          ws: true, // Enable WebSocket proxy
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            router: ['react-router-dom'],
            ui: ['swiper', 'react-icons'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
    },
    css: {
      devSourcemap: true,
    },
  }
})