import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Served from https://advk2k4.github.io/farewise/ on GitHub Pages
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/farewise/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 5173 },
  // React, Motion, Radix and Leaflet make up the main chunk (~185 kB gzipped); the other views load on demand
  build: { chunkSizeWarningLimit: 700 },
})
