import type { CapacitorConfig } from '@capacitor/cli';
import { serverUrl } from './server-url.mjs';

// The app is a native shell around the deployed site: sign-in, data and updates work exactly as on the web,
// and a new deploy reaches the app without publishing a new version. www/ only holds the offline page.
const config: CapacitorConfig = {
  appId: 'com.hacktrack.app',
  appName: 'HackTrack',
  webDir: 'www',
  server: {
    url: serverUrl,
    // Plain http is only for testing against a computer on the same network
    cleartext: serverUrl.startsWith('http://'),
    // Shown when the site cannot be reached when the app opens
    errorPath: 'offline.html',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#18213a',
      showSpinner: false,
    },
  },
};

export default config;
