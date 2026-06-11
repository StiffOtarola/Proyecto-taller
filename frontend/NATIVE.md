# App nativa (Capacitor) — guía de build

La app web ya está preparada para empaquetarse como app nativa (Android / iOS) con
**Capacitor 8**. La config carga los assets **locales** (offline real) y las llamadas a la
API se redirigen al backend absoluto. Falta solo correr la cadena nativa en tu máquina.

## 0. Requisitos previos (una vez)
- **Android:** Android Studio + SDK + un JDK 17.
- **iOS:** una Mac con Xcode (no se puede compilar iOS en Windows).
- Plugins nativos ya instalados en el proyecto:
  - `@aparajita/capacitor-biometric-auth` (huella / Face ID)
  - `@aparajita/capacitor-secure-storage` (Keystore / Keychain)

## 1. URL del backend  ✅ ya configurada
La app nativa NO puede usar la ruta relativa `/api`. Ya está puesta en
[`src/app/native-config.ts`](src/app/native-config.ts):

```ts
export const NATIVE_API_URL = 'https://proyecto-taller-production-0e4b.up.railway.app';
```

> El `ApiUrlInterceptor` reescribe `/api/...` → `${NATIVE_API_URL}/api/...` **solo en nativo**.
> En web no cambia nada.

## 2. CORS del backend  ⚠️ obligatorio
El WebView nativo tiene origen `capacitor://localhost` (iOS) / `http://localhost` (Android).
En **Railway**, agregá ese origen a la variable `CORS_ORIGIN` del backend (separá con coma si
hay varios), por ejemplo:

```
CORS_ORIGIN=https://proyecto-taller-production-0e4b.up.railway.app,capacitor://localhost,http://localhost
```

## 3. Agregar plataformas
```bash
cd frontend
npm install            # asegura node_modules
npx ng build --configuration production   # genera www/
npx cap add android    # crea android/  (en Mac: npx cap add ios)
npx cap sync           # copia www/ + plugins a las plataformas
```

## 4. Permisos nativos (biometría)
- **Android** — en `android/app/src/main/AndroidManifest.xml`:
  ```xml
  <uses-permission android:name="android.permission.USE_BIOMETRIC" />
  ```
- **iOS** — en `ios/App/App/Info.plist`:
  ```xml
  <key>NSFaceIDUsageDescription</key>
  <string>Usamos Face ID para que ingreses más rápido y seguro.</string>
  ```

## 5. Compilar / abrir
```bash
npx cap open android   # abre Android Studio → Run / Build APK
npx cap open ios       # (en Mac) abre Xcode
```

## Flujo recurrente al cambiar el frontend
```bash
npx ng build --configuration production && npx cap sync
```

## Notas
- **Biometría:** tras un login exitoso, la app ofrece activarla; guarda las credenciales
  cifradas y en el próximo arranque aparece "Ingresar con huella / Face ID". Todo está
  gateado por `Capacitor.isNativePlatform()` → en web es invisible.
- **Offline real:** al cargar assets locales, el shell de la app funciona sin conexión; los
  datos ya vistos se sirven desde el cache local (ver `PortalService`). El banner global avisa
  cuando no hay conexión.
- **appId / appName** se configuran en [`capacitor.config.ts`](capacitor.config.ts)
  (`cr.msmotos.app` / `MS Motos`). Cambialos si necesitás otro identificador para las tiendas.
