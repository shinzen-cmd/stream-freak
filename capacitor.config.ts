import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.streamhub.app',
  appName: 'Stream Freak',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    // cleartext removed — use HTTPS only to prevent MITM attacks.
    // All embed providers support HTTPS. If a specific embed needs HTTP,
    // handle it at the WebView level with allowMixedContent below.
  },
  android: {
    allowMixedContent: true, // Required for third-party embed iframes that load mixed content
  },
  plugins: {
    App: {
      // Back button behavior is handled in CapacitorBackHandler component
    },
  },
};

export default config;
