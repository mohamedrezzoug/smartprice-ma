import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// base './' = relative paths, so the build works at the site root AND under a sub-path
// (e.g. https://<user>.github.io/smartprice-ma/).
export default defineConfig({ base: './', plugins: [react()] })
