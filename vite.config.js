import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  base: './', // Allows hosting anywhere (GitHub Pages, Vercel, Netlify, subpaths)
  server: {
    host: true, // Exposes to Office Wi-Fi / LAN
    port: 5173
  }
})
