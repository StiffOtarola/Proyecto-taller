# Escalabilidad — TallerMS / MS Motos

Notas de capacidad y la ruta para crecer. La idea es **no optimizar antes de tiempo**:
hacer cada paso cuando los números reales lo pidan, no antes. Documentado para que la
decisión esté tomada de antemano y no nos agarre con la base llena de datos.

> Estado actual: hosting de prueba en Railway (un solo proceso Node + una sola MySQL,
> `connectionLimit: 10`). Destino real: app de escritorio + móvil (App Store / Play Store).

---

## Ya hecho (hardening de bajo riesgo, sirve a cualquier escala)

- **Compresión** (`compression`) de respuestas → menos ancho de banda, sobre todo en listados.
- **Rate limiting** (`express-rate-limit`):
  - General: 600 req/min por IP en toda la API.
  - Auth (login/registro/recuperar): 30 intentos / 15 min por IP (protege CPU de bcrypt + fuerza bruta).
  - `/api/health` exento; `trust proxy` activado en producción para ver la IP real tras Railway.
- **Listado global de motos** (`GET /api/motos`) ya **no** devuelve la foto base64; expone
  `tiene_foto` y la imagen se sirve en el detalle. Aligera la respuesta más pesada del panel.

---

## Realidad: "1 millón a la vez"

Hay que separar **usuarios registrados** (alcanzable con buen código + infra modesta) de
**usuarios concurrentes en el mismo segundo** (problema de arquitectura, no de código).
Una sola caja Node + una sola MySQL no sirve 1M concurrentes por más limpio que esté el
código. Para ese número se necesita la ruta de abajo.

---

## Pendiente — por prioridad (impacto / esfuerzo)

### 1. Paginación en listados globales  ⟶ *medio esfuerzo, alto impacto al crecer*
Las listas **por cliente** están acotadas por naturaleza (una persona tiene pocas motos/citas).
Las **globales de admin/recepción** devuelven todo sin `LIMIT` y se degradan con el volumen:
- `GET /api/motos` (todas las motos del taller)
- listados de todas las citas / órdenes / clientes
- `GET /api/promos`

Acción: `LIMIT`/`OFFSET` (o keyset por `id`/`created_at`) + parámetros `?page=&limit=`, y
búsqueda server-side. Hoy la búsqueda de motos usa `LIKE '%texto%'` (comodín inicial → no usa
índice): a escala grande, pasar a índice de prefijo o FULLTEXT.

### 2. Imágenes fuera de la base de datos (object storage + CDN)  ⟶ *alto esfuerzo, alto impacto — LOCK-IN DE DATOS*
Hoy las imágenes viven en base64 dentro de columnas `MEDIUMTEXT`/`LONGTEXT`:
`clientes.foto`, `motos.foto`, `promos.imagen`, `orden_fotos.url`, `garantia_fotos.url`,
`configuracion.logo`.

Problemas al crecer: base64 pesa +33% vs binario, no se cachea en navegador/CDN, infla
backups y replicación, y contamina el buffer pool de MySQL (menos filas útiles en RAM).

Acción: subir a object storage (S3 / Cloudflare R2 / Cloudinary), guardar **solo la URL**,
servir por CDN. **Cuanto antes se decida, mejor**: migrar es más caro cuantas más fotos haya
acumuladas. Hacerlo antes del lanzamiento real.

### 3. Escalado horizontal de la app  ⟶ *cuando un proceso no da abasto*
- Varias instancias de Node detrás de un **load balancer**; usar todos los cores (`cluster`/PM2).
- Implica mover el estado compartido fuera del proceso:
  - **Rate limit** → store en **Redis** (hoy es en memoria, por proceso).
  - **Cache de `getConfig()`** → hoy es por proceso; con varias instancias un cambio de config
    no invalida las demás hasta reiniciar. Mover a Redis o invalidar por pub/sub.
- Servir el **frontend estático desde un CDN**, no desde Node (`express.static`), para que no
  compita con la API.

### 4. Base de datos para lectura intensiva  ⟶ *cuando la DB sea el cuello*
- MySQL gestionada con **réplicas de lectura**; mandar los `SELECT` de listados a las réplicas.
- Revisar `connectionLimit` (hoy 10/proceso) junto con `max_connections` de la DB y el nº de
  instancias. Es el techo de concurrencia de DB por proceso.
- Índices compuestos para los filtros globales más usados (p. ej. `citas(estado, fecha)`).

---

## Regla práctica
Medir antes de optimizar. Cuando aparezca lentitud real: mirar **logs de queries lentas**,
tiempos de respuesta por endpoint y uso de CPU/memoria, y atacar el cuello concreto — no el
hipotético. Los pasos 1 y 2 son los que más conviene no postergar (paginación es barata; las
imágenes tienen lock-in de datos).
