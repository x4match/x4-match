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

const config = {
  ...appJson.expo,
  plugins,
  ios: {
    ...appJson.expo.ios,
    bundleIdentifier: appJson.expo.ios?.bundleIdentifier ?? 'com.x4match.app',
  },
  android: {
    ...appJson.expo.android,
    package: appJson.expo.android?.package ?? 'x4.match',
  },
} as ExpoConfig;

export default config;
