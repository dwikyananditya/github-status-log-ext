import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'GH Status Log',
    description: 'Mencatat perubahan status project issue GitHub per anggota team',
    permissions: ['storage'],
    browser_specific_settings: {
      gecko: {
        id: 'gh-status-log@datfooldive',
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  },
  suppressWarnings: {
    firefoxDataCollection: true,
  },
});
