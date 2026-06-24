import { environment } from '../environments/environment';

// En la app nativa (Capacitor) el WebView carga desde capacitor://localhost,
// así que '/api' no llegaría al backend: hay que apuntar a la URL absoluta.
export const NATIVE_API_URL = environment.nativeApiUrl;
