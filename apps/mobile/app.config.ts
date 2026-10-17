import { existsSync } from 'fs';
import { resolve } from 'path';
import type { ExpoConfig } from 'expo/config';
import appJson from './app.json';

const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
const iosUrlScheme = iosClientId
  ? `com.googleusercontent.apps.${iosClientId.replace(/\.apps\.googleusercontent\.com$/, '')}`
  : undefined;

const basePlugins = (appJson.expo.plugins ?? []) as NonNullable<ExpoConfig['plugins']>;
const plugins: NonNullable<ExpoConfig['plugins']> = [...basePlugins];

// Plugin de Google Sign-In: en iOS exige iosUrlScheme (reversed client id).
// En Android el módulo se enlaza por autolinking; el plugin solo aporta el URL scheme de iOS.
if (iosUrlScheme) {
  plugins.push([
    '@react-native-google-signin/google-signin',
    { iosUrlScheme },
  ]);
}

const googleServicesPath = resolve(__dirname, 'google-services.json');
const hasGoogleServicesFile = existsSync(googleServicesPath);

if (process.env.EAS_BUILD_PLATFORM === 'android' && !hasGoogleServicesFile) {
  console.warn(
    '[app.config] Falta apps/mobile/google-services.json. Sin ese archivo (y FCM V1 en EAS) las push de Android no llegan.',
  );
}

const androidFromJson = { ...(appJson.expo.android ?? {}) } as NonNullable<ExpoConfig['android']>;
delete androidFromJson.googleServicesFile;

const config = {
  ...appJson.expo,
  plugins,
  ios: {
    ...appJson.expo.ios,
    bundleIdentifier: appJson.expo.ios?.bundleIdentifier ?? 'com.x4match.app',
  },
  android: {
    ...androidFromJson,
    package: appJson.expo.android?.package ?? 'x4.match',
    // Solo referenciar el archivo si existe: evita romper prebuild local sin Firebase.
    ...(hasGoogleServicesFile ? { googleServicesFile: './google-services.json' } : {}),
  },
} as ExpoConfig;

export default config;
