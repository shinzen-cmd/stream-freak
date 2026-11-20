import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.streamhub.app',
  appName: 'Stream Freak',
  webDir: 'out',
  server: {
    // Live instant updates: the native Android shell loads streamfreak.xyz directly,
    // so UI/feature/server updates go live automatically without requiring APK reinstalls,
    // while keeping native Google Sign-In, FCM Push, and native ad-blocking active.
    url: 'https://streamfreak.xyz',
    androidScheme: 'https',
    allowNavigation: ['streamfreak.xyz', '*.streamfreak.xyz'],
  },
  android: {
    allowMixedContent: true, // Required for third-party embed iframes that load mixed content
  },
  plugins: {
    App: {
      // Back button behavior is handled in CapacitorBackHandler component
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
