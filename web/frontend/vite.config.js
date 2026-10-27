import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During development (`npm run dev`) API calls are forwarded to the Python server.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8000' } },
})
