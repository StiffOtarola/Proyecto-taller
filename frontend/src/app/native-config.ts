// Configuración específica de la app nativa (Capacitor).
//
// En web, el frontend y el backend viven en el mismo origen (Railway sirve el build),
// por eso las llamadas usan la ruta relativa '/api'. En la app NATIVA el WebView carga
// desde capacitor://localhost, así que '/api' no llegaría al backend: hay que apuntar a
// la URL ABSOLUTA del servidor de producción.
//
// URL pública del backend en Railway (sin barra final ni ruta). El interceptor le
// agrega '/api/...' a cada llamada cuando la app corre en nativo.
export const NATIVE_API_URL = 'https://proyecto-taller-production-0e4b.up.railway.app';
