import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages deploys to https://khalecl.github.io/supply-chain-idle/
// So we need base: '/supply-chain-idle/' for GH Pages.
// For Vercel or local dev, '/' works fine — Vite ignores base in dev mode.
export default defineConfig({
  base: '/supply-chain-idle/',
  plugins: [react()],
  server: {
    port: 3000,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
