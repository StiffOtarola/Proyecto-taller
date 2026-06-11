import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cr.msmotos.app',
  appName: 'MS Motos',
  webDir: 'www',
  // Sin `server.url`: la app carga su shell desde los assets locales del dispositivo
  // (offline real). Las llamadas a la API van al backend absoluto (ver native-config.ts).
};

export default config;
