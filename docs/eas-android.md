# EAS — Android & iOS

Todos los comandos se corren desde `apps/mobile`.

```bash
cd apps/mobile
```

API incrustada en los perfiles EAS: `https://api.x4match.com`  
Proyecto: `x4match` · Owner: `fosorio`

| Plataforma | Identificador |
|---|---|
| Android | Package `x4.match` |
| iOS | Bundle ID `com.x4match.app` |

---

## 1. CLI

```bash
npm install -g eas-cli
eas --version
eas login
eas whoami
eas logout
```

En iOS hace falta Apple Developer (cuenta paga) y, la primera vez, login de Apple en el CLI cuando EAS pida credenciales.

---

## 2. Perfiles (`eas.json`)

| Perfil | Android | iOS | Para qué |
|---|---|---|---|
| `preview` | AAB interno | IPA ad-hoc / internal | Probar (Play interno / TestFlight o dispositivos registrados) |
| `production` | AAB store | IPA store | Google Play / App Store |
| `development` | Dev client | Dev client (dispositivo) | Dispositivo físico + Metro |
| `development-simulator` | — | Dev client (simulador) | Simulador iOS + Metro |

Un **AAB** no se instala en el emulador. En Android, para instalar a mano usá el perfil `development` o Play Console.

Un **IPA de store/ad-hoc** no se sideloadea como un APK genérico: va por TestFlight, App Store o dispositivos provisionados. Para simulador usá `development-simulator`.

---

## 3. Generar build

### Preview (prueba interna)

```bash
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

### Production (stores)

```bash
eas build --profile production --platform android
eas build --profile production --platform ios
```

### Ambas plataformas a la vez

```bash
eas build --profile production --platform all
```

### Sin prompts interactivos

```bash
eas build --profile production --platform android --non-interactive
eas build --profile production --platform ios --non-interactive
```

### Forzar rebuild (ignorar cache)

```bash
eas build --profile preview --platform android --clear-cache
eas build --profile preview --platform ios --clear-cache
```

---

## 4. Seguir / bajar el build

```bash
eas build:list --platform android --limit 5
eas build:list --platform ios --limit 5
eas build:view
eas build:download --platform android
eas build:download --platform ios
```

El artefacto queda en Expo y se puede descargar desde la URL que imprime el CLI, o desde [expo.dev](https://expo.dev).

---

## 5. Subir a las stores

### Google Play

```bash
eas submit --platform android --profile production --latest
```

### App Store / TestFlight

`preview` **no** sube a la tienda (es interno / Ad Hoc). Para App Store usá **siempre** `production`.

Conviene `npx eas-cli@latest` (eas-cli viejo ya rompió un build de store).

```bash
# 1. Compilar IPA de store
npx eas-cli@latest build --platform ios --profile production

# 2. Cuando el build esté Finished, mandarlo a App Store Connect
npx eas-cli@latest submit --platform ios --profile production --latest
```

O en un solo paso:

```bash
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

Build concreto:

```bash
eas submit --platform android --id <BUILD_ID>
eas submit --platform ios --id <BUILD_ID>
```

Si pide login de Apple, usá la cuenta del **Apple Developer Program** (team de Franco / `X4Y4NKY96Z`), no un Gmail de marca si no es esa cuenta.

Tras el submit, el IPA entra a App Store Connect → TestFlight (procesamiento ~5–30 min). Eso **no** lo manda a review solo.

**En App Store Connect (versión nueva o reemplazar un IPA en review):**

1. App → la versión (hoy `1.0.0`).
2. **Build**: sacá el IPA viejo y elegí el nuevo (`buildNumber` que incrementó EAS).
3. Completá **App Review Information** (cuentas demo + Notes + link del video si Apple lo pidió).
4. **Add for Review** / **Submit**.
5. Si Apple ya preguntó algo en Resolution Center, respondé ahí con el mismo texto.

Un IPA ya enviado a review **no** incluye cambios posteriores (p. ej. Eliminar cuenta). Hasta que no elijan el build nuevo, Apple sigue viendo el anterior.

La primera vez, EAS pide Apple ID o App Store Connect API Key (recomendado: API Key en Expo o al correr `eas submit`).

---

## 6. Credenciales

### Android

```bash
eas credentials -p android
```

Ahí se ven keystore, SHA-1 y SHA-256 (Google Sign-In).

#### Google Sign-In (`DEVELOPER_ERROR`)

El **Web Client ID** de la app no se toca. Google exige un **cliente OAuth tipo Android** en el mismo proyecto, con:

- Package: `x4.match` (no `com.x4match.app`)
- SHA-1 de **cada** firma que instala la app

Creá un cliente Android por SHA-1 (mismo package):

1. **EAS upload** — `eas credentials -p android` → Keystore → SHA-1
2. **Play App Signing** — Play Console → Configuración → Integridad de la app → Huella SHA-1 del *certificado de firma de la app*
3. **Debug / emulador** — solo si probás `pnpm android`

Tras crear/editar el cliente, esperá 5–10 min. No hace falta rebuild de la app.

### iOS

```bash
eas credentials -p ios
```

Ahí se gestionan Distribution Certificate, Provisioning Profiles y Push Key (si aplica).

EAS puede crear/renovar certificados y perfiles automáticamente (opción recomendada salvo que ya uses un flujo Apple manual).

#### Google Sign-In (iOS)

- Bundle ID: `com.x4match.app`
- Cliente OAuth tipo **iOS** en el mismo proyecto de Google Cloud (el `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`)
- El reversed client ID se inyecta como URL scheme vía `app.config.ts` + plugin `@react-native-google-signin/google-signin`
- Si cambiás el iOS Client ID, hace falta **rebuild** (el scheme queda en el binario nativo)

#### Sign in with Apple

La app ya declara `usesAppleSignIn` y el plugin `expo-apple-authentication`. En Apple Developer / App Store Connect el capability **Sign In with Apple** debe estar activo para `com.x4match.app`.

---

## 7. Variables de entorno

Los `EXPO_PUBLIC_*` del build **no** salen del `.env` local: salen de `eas.json` → `build.<perfil>.env`.

Hoy en `preview`, `production`, `development` y `development-simulator`:

- `EXPO_PUBLIC_API_URL=https://api.x4match.com`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...`

Cambiar la URL implica **un build nuevo**. Un OTA (`eas update`) no alcanza si el binario nativo quedó con otra URL.

```bash
# Ver envs remotas de EAS (si las usás en el dashboard)
eas env:list
```

---

## 8. Versión de la app (automático)

No edites a mano `versionCode` (Android) ni `buildNumber` (iOS) en `app.json`. EAS los incrementa solo en cada build de `preview` o `production`.

- `cli.appVersionSource: remote` — el número vive en Expo, no en el repo
- `autoIncrement: true` — `eas build` suma +1 antes de compilar (por plataforma)

Flujo: `eas build` → artefacto con código nuevo → subir a Play / App Store Connect.

```bash
# Solo para mirar el número actual (no hace falta en el día a día)
eas build:version:get -p android
eas build:version:get -p ios
```

`eas build:version:set` es de emergencia (si la store y EAS se desincronizan). No es parte del flujo normal.

---

## 9. Dev local (no store)

```bash
# Android — dev client + emulador/dispositivo
pnpm android

# iOS — dispositivo / simulador local (Mac + Xcode)
pnpm ios
# o
npx expo run:ios

# Dev client EAS para simulador iOS (si no compilás en local)
eas build --profile development-simulator --platform ios

# Metro (limpia cache de env)
npx expo start --dev-client -c
```

`.env` local solo aplica a Metro (`__DEV__`), no a los binarios de EAS.

Google Sign-In no funciona en Expo Go: hace falta development build (`pnpm android` / `pnpm ios` o perfiles `development` / `development-simulator`).

---

## 10. Flujo típico

### Android (AAB)

```bash
cd apps/mobile
eas whoami
eas build --profile preview --platform android
eas build:list --platform android --limit 1
```

Para Play Store: `--profile production` y después `eas submit --platform android --latest`.

### iOS — probar (preview, no store)

```bash
cd apps/mobile
eas whoami
npx eas-cli@latest build --profile preview --platform ios
eas build:list --platform ios --limit 1
```

### iOS — nueva versión a App Store

```bash
cd apps/mobile
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

Después: App Store Connect → versión → elegir el build nuevo → Submit for Review. Detalle en §5.
