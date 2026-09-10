import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from a GitHub Pages project page, so assets resolve under the repo
// name in production and from the root in dev.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/luc-evaluation-platform/' : '/',
  plugins: [react(), tailwindcss()],
}))
