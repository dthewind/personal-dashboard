import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const APP_TITLE = 'Dustin'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'html-title',
      transformIndexHtml: (html) =>
        html.replace(
          '%VITE_APP_TITLE%',
          mode === 'production' ? APP_TITLE : `${APP_TITLE} TEST`,
        ),
    },
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8001',
    },
  },
}))
