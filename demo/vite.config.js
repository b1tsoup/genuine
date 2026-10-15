import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'genuine-react/styles.css': fileURLToPath(new URL('../genuine-react/src/genuine.css', import.meta.url)),
      'genuine-react': fileURLToPath(new URL('../genuine-react/src/index.jsx', import.meta.url)),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: { fs: { allow: ['..'] } },
})
