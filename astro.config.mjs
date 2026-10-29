import { defineConfig, fontProviders } from 'astro/config';
import starpod from 'starpod';

import starpodConfig from './starpod.config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://turbulentinsights.com',
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'MiSans',
      cssVariable: '--astro-font-misans',
      display: 'swap',
      fallbacks: ['system-ui', 'sans-serif'],
      options: {
        variants: [
          { src: ['./fonts/MiSans-Regular.woff2'], weight: 400, style: 'normal' },
          { src: ['./fonts/MiSans-Bold.woff2'], weight: 700, style: 'normal' }
        ]
      }
    }
  ],
  integrations: [
    starpod(starpodConfig, {
      customCss: ['./src/styles/fonts.css'],
      components: { Platforms: './src/components/Platforms.astro' },
      // Options you can enable later:
      // database: true, // per-episode guests/sponsors via Turso + Drizzle
    })
  ]
});
