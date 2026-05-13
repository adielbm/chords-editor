import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Hosted at https://adielbm.github.io/chords-editor
export default defineConfig({
  base: '/chords-editor/',
  plugins: [react()],
});
