// Configuración específica de la app nativa (Capacitor).
//
// En web, el frontend y el backend viven en el mismo origen (Railway sirve el build),
// por eso las llamadas usan la ruta relativa '/api'. En la app NATIVA el WebView carga
// desde capacitor://localhost, así que '/api' no llegaría al backend: hay que apuntar a
// la URL ABSOLUTA del servidor de producción.
//
// 👉 Reemplazá esto por la URL pública de tu backend en Railway (sin barra final),
//    p. ej. 'https://proyecto-taller-production.up.railway.app'.
export const NATIVE_API_URL = 'https://CAMBIAME.up.railway.app';
