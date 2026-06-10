# Auditoría de Seguridad y Arquitectura — TallerMS

> Fecha: 2026-06-10 · Alcance: `/backend` (Express 5 + MySQL) y `/frontend` (Ionic/Angular NgModules).
> Modalidad: **solo lectura** (no se modificó código). Cada hallazgo cita `archivo:línea`.

---

## Resumen ejecutivo

El sistema tiene buenas bases (queries 100% parametrizadas, contraseñas con bcrypt, JWT obligatorio en producción, errores genéricos sin filtrar stack/SQL, rate-limit en login, control de cupo atómico con `FOR UPDATE`). **Pero hay un defecto crítico de control de acceso**: el middleware de personal `auth` (`middleware/auth.js`) verifica la firma del JWT pero **no comprueba que el token sea de personal** (`tipo`/`rol`). Como los tokens del portal de clientes se firman con el **mismo** `JWT_SECRET`, **cualquier cliente autenticado del portal puede invocar las rutas de personal que solo usan `auth` sin `requireRol`** (clientes, motos, órdenes, citas, garantías), leyendo y modificando datos de **todos** los clientes (PII: nombre, teléfono, email, cédula, dirección) y manipulando órdenes/citas. Secundariamente, varias rutas de personal carecen de piso de rol, por lo que un `tecnico` puede gestionar datos que el diseño reserva a recepción/admin. No se hallaron inyecciones SQL ni secretos versionados.

**Arreglar primero:** endurecer `auth` para exigir token de staff (corta de raíz el acceso cruzado) y agregar `requireRol` a los routers `clientes`, `motos`, `ordenes`, `citas`, `garantias`.

---

## Tabla de hallazgos por severidad

| # | Sev | Categoría | Ubicación | Problema | Por qué importa / cómo se explota |
|---|-----|-----------|-----------|----------|-----------------------------------|
| 1 | **CRÍTICO** | AuthN/AuthZ — confusión de audiencia | `middleware/auth.js:10`; tokens en `auth.routes.js:48-51` y `portal.routes.js:21-24` | `auth` hace `jwt.verify` pero **no valida `tipo`/`rol`**. El token del portal (mismo `JWT_SECRET`, `tipo:'cliente'`, sin `rol`) es aceptado por todas las rutas de staff que solo usan `auth`. | Un cliente se registra en `/api/portal/registro`, obtiene token y lo manda como `Bearer` a rutas de personal → ver hallazgos 2-6. Es el origen de todos los accesos cruzados. |
| 2 | **CRÍTICO** | IDOR / fuga masiva de PII | `routes/clientes.routes.js:8` (`router.use(auth)` sin rol) → `GET /` (15), `GET /:id` (50), `GET /:id/motos` (111), `GET /:id/ordenes` (123), `POST /` (33), `PUT /:id` (97), `PATCH /:id/cortesia` (61) | Sin piso de rol. Reachable por **cualquier** token válido, incluido el de un cliente. | `GET /api/clientes` con token de cliente devuelve **toda** la base de clientes (nombre, teléfono, email, cédula, dirección). `PUT /api/clientes/:id` permite **editar** datos de cualquier cliente. |
| 3 | **CRÍTICO** | IDOR — órdenes de trabajo | `routes/ordenes.routes.js:8` (`router.use(auth)`) → `GET /` (11), `GET /:id` (90), `POST /` (41), `PATCH /:id/estado` (147), `POST /:id/avances` (204), `POST /:id/repuestos` (235), `PUT /:id/repuestos/:rid` (269), checklist (309/326), `POST /:id/fotos` (381) | Sin piso de rol salvo en `PUT /:id` (tecnico), cancelar/cerrar/borrar (admin). | Un cliente puede listar/leer **todas** las órdenes (con PII y montos), crear órdenes, **cambiar el estado** de cualquiera (p. ej. forzar `lista_entrega`/`en_reparacion`), inyectar avances/repuestos y alterar costos vía repuestos. Sabotaje del taller + manipulación de facturación. |
| 4 | **CRÍTICO** | IDOR — citas | `routes/citas.routes.js:15` (`router.use(auth)`) → `GET /` (17), `GET /:id` (64), `PATCH /:id/estado` (96) | `GET` y `PATCH estado` no tienen piso de rol; el control inline solo restringe a `tecnico` (`citas.routes.js:105`). Un cliente tiene `rol` indefinido → no entra en ese `if` → **pasa**. | Un cliente puede leer toda la agenda y **cambiar el estado de cualquier cita** (incl. `entregado`/`cancelado`), disparando `notificarCambioEstado` a terceros. |
| 5 | **ALTO** | IDOR — garantías | `routes/garantias.routes.js:7` (`router.use(auth)`) → `GET /` (26), `GET /:id` (47), `POST /` (59), `POST /:id/fotos` (108), `DELETE /:id/fotos/:fid` (124) | Sin piso de rol (solo `PATCH /:id/estado` exige admin). | Un cliente puede listar **todos** los reclamos de garantía (incluyen PII de cliente y datos de orden) y crear reclamos sobre órdenes ajenas. |
| 6 | **MEDIO** | AuthZ horizontal entre staff | `clientes.routes.js:8`, `motos.routes.js:6`, `citas.routes.js:17/64/96` | Sin piso de rol, un **`tecnico`** puede crear/editar clientes y leer toda su PII, pese a que el diseño reserva la agenda a recepción/admin (`citas` POST/PUT usan `soloRoles(recepcion,admin)`, `citas.routes.js:47/82`). Inconsistencia de modelo de permisos. | Rol intermedio con permisos no previstos sobre PII y registros de clientes. |
| 7 | **MEDIO** | Transiciones de estado sin máquina de estados | `ordenes.routes.js:147-184`; `citas.routes.js:96-114`; `mecanico.routes.js:111-140` | Se acepta cualquier `estado` válido sin validar la transición desde el estado actual (p. ej. `entregado → agendado`, o saltarse `esperando_aprobacion`). | Estados imposibles, métricas/tiempos (`orden_tiempos`) inconsistentes, posibilidad de "entregar" sin aprobación del cliente. |
| 8 | **MEDIO** | Credenciales semilla conocidas | `db/migrate.js:26-38` (`Admin2024!`, `Recep2024!`, emails fijos) | El seed crea `admin@taller.com`/`Admin2024!` y `recepcion@taller.com`/`Recep2024!`. Si se corre `npm run migrate` en producción y no se rotan, son credenciales públicas (constan en el repo/README). | Acceso admin con credenciales conocidas. Verificar que en Railway se hayan rotado. **No verificable desde el repo** si están activas en prod. |
| 9 | **MEDIO** | Validación de rol / `usuarios` | `routes/usuarios.routes.js:21-58` | `POST /` y `PUT /:id` no validan que `rol ∈ {recepcion,tecnico,admin}` ni que `email` tenga formato; `PUT /:id` no valida campos requeridos (puede dejar `nombre`/`email` en `null`). Sin protección de "último admin" ni de auto-desactivación (`PATCH /:id/activo:60`). | Un admin puede crear un usuario con `rol` inválido (queda sin acceso por `JERARQUIA.indexOf = -1`) o desactivarse/locked-out a sí mismo. Integridad, no escalada. |
| 10 | **BAJO** | Cupo no aplicado en alta de staff | `citas.routes.js:47-62` | `POST /api/citas` (recepción/admin) no aplica `max_citas_hora` (el portal sí lo hace con `FOR UPDATE`, `portal.routes.js:547-567`). | Sobre-reserva de franjas desde el mostrador. Probablemente intencional como override; documentar. |
| 11 | **BAJO** | Enumeración de usuarios por timing | `auth.routes.js:34-51` | `bcrypt.compare` solo se ejecuta si el email existe; si no, responde rápido. El mensaje es genérico (bien), pero el tiempo de respuesta difiere. | Oráculo de existencia de cuentas. Bajo impacto (rate-limit por email mitiga). |
| 12 | **BAJO** | Rate-limit parcial | `utils/rate-limit.js`; `auth.routes.js:28` | Limita por **email**, no por IP; en memoria y por instancia única (se reinicia en cada deploy). Un atacante puede rotar emails sin tope global. | Fuerza bruta distribuida por cuentas / password spraying con tope laxo. Aceptable a esta escala, pero anotado. |
| 13 | **BAJO** | Sin CSP / helmet | `server.js:28-37` | Headers básicos presentes (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS en prod) pero **sin Content-Security-Policy**. | Menor superficie anti-XSS. Aceptable, anotado. |
| 14 | **BAJO** | Sesión JWT sin revocación | `auth.routes.js:11` | Tokens de 8 h, sin `aud`/`iss`, sin lista de revocación; `logout` es solo client-side (borra `localStorage`). | Un token filtrado es válido hasta expirar. Estándar para esta escala; anotado. |
| 15 | **BAJO** | Posible link muerto admin → `/tabs` | `app-routing.module.ts:18-22` + `guards/rol-home.guard.ts:14-20`; enlace en `admin-shell.page.html` ("Órdenes y agenda" → `/tabs/ordenes`) | `RolHomeGuard` está en el padre `tabs` y redirige **admin → /admin**, por lo que cualquier `/tabs/**` reabre `/admin`. El enlace del shell admin a `/tabs/ordenes` quedaría rebotado. | Funcional, no de seguridad. **No verificado en runtime**; confirmar navegando. |
| 16 | **INFO** | DoS de almacenamiento por base64 | `server.js:43` (`limit:'10mb'`) + fotos/logo como data URL en DB (`ordenes.routes.js:381`, `promos`, `configuracion.logo`) | Imágenes base64 en columnas `MEDIUMTEXT`/`LONGTEXT` sin tope por cuenta. | Crecimiento de DB / abuso de almacenamiento por usuarios autenticados. Bajo. |

### Lo que está BIEN (verificado)
- **SQL Injection:** no se halló. Todas las queries usan placeholders `?`. En `admin.routes.js:73-205` se interpola `rango(col)` pero `col` es un literal fijo del código y `periodo` está en lista blanca (`admin.routes.js:75-78`); `empleado` se castea a entero. Sin concatenación de input.
- **Hashing:** bcrypt(10) en todos los flujos (`auth.routes.js:38/48`, `clientes.routes.js:89`, `usuarios.routes.js:27`, perfiles). Nunca se devuelve `password_hash` (`clientes.routes.js:11`).
- **Secretos:** no hay `.env` versionado (`.gitignore` cubre `**/.env`); `.env.example` solo placeholders; `RESEND_API_KEY` vacío; `JWT_SECRET` aborta en prod si falta (`server.js:17-24`). Sin claves hardcodeadas.
- **Errores:** `utils/responder.js:3-6` loguea el detalle y responde genérico; handler global `server.js:61-64` idem. Test lo cubre (`test/responder.test.js`).
- **Portal (cliente):** **correctamente** acotado por `req.cliente.id` en motos/órdenes/citas/perfil (`portal.routes.js` passim). El sentido staff→portal está protegido: `auth-cliente.js:13` rechaza tokens que no sean `tipo:'cliente'`. El agujero es solo en sentido cliente→staff (hallazgo 1).
- **Concurrencia:** control de cupo con transacción + `FOR UPDATE` (`portal.routes.js:547-567`); `numero_orden` atómico con contador por año (`utils/ordenes.js:19-33`); cierre+fidelización en transacción (`ordenes.routes.js:339-378`). Conexiones liberadas en `finally`.

---

## Matriz de endpoints vs roles

Convención: **R**=recepcion, **T**=tecnico, **A**=admin, **C**=cliente(portal). "Esperado" = quién debería poder; "Real" = lo que el middleware permite hoy. 🔴 = brecha.

### Personal (`/api/...`)

| Método | Ruta | Esperado | Protección real | ¿OK? |
|--------|------|----------|-----------------|------|
| POST | `/auth/login` | público | público + rate-limit `auth.routes.js:28` | ✅ |
| GET | `/auth/me` | R/T/A | `auth` | ✅ |
| GET/POST | `/clientes` `/clientes/:id` … | R/A (¿T?) | `auth` **sin rol** | 🔴 **acepta C y T** (#2,#6) |
| PATCH | `/clientes/:id/portal` | A | `auth+requireRol('admin')` `:75` | ✅ |
| GET/POST/PUT | `/motos` `/motos/:id` … | R/T/A | `auth` **sin rol** | 🔴 **acepta C** (#1) |
| GET/POST | `/ordenes` `/ordenes/:id` | R/T/A | `auth` **sin rol** | 🔴 **acepta C** (#3) |
| PUT | `/ordenes/:id` (costos) | T/A | `requireRol('tecnico')` `:116` | ✅ |
| PATCH | `/ordenes/:id/estado` | R/T/A | `auth`; cancelar exige A `:155` | 🔴 **acepta C** (#3) |
| PATCH | `/ordenes/:id/tecnico` | A | `requireRol('admin')` `:187` | ✅ |
| DELETE | `/ordenes/:id/repuestos/:rid`, `/fotos/:fid` | A | `requireRol('admin')` `:290/:412` | ✅ |
| PATCH | `/ordenes/:id/cerrar` | A | `requireRol('admin')` `:339` | ✅ |
| POST/PUT | `/ordenes/:id/repuestos`, `/avances`, `/checklist`, `/fotos` | T/A | `auth` **sin rol** | 🔴 **acepta C** (#3) |
| GET | `/citas` `/citas/:id` | R/T/A | `auth` **sin rol** | 🔴 **acepta C** (#4) |
| POST/PUT | `/citas` `/citas/:id` | R/A | `soloRoles(recepcion,admin)` `:47/:82` | ✅ |
| PATCH | `/citas/:id/estado` | T(own)/R/A | `auth` + inline `tecnico` `:105` | 🔴 **acepta C** (#4) |
| PATCH | `/citas/:id/asignar` | A | `requireRol('admin')` `:118` | ✅ |
| ALL | `/usuarios/**` | A | `auth+requireRol('admin')` `:8` | ✅ (ver #9) |
| ALL | `/dashboard/**` | A | `auth+requireRol('admin')` `:7` | ✅ |
| GET/POST | `/garantias` `/garantias/:id` `/fotos` | R/T/A | `auth` **sin rol** | 🔴 **acepta C** (#5) |
| PATCH | `/garantias/:id/estado` | A | `requireRol('admin')` `:83` | ✅ |
| GET | `/promos` | R/T/A | `auth` **sin rol** | 🟠 acepta C (expone inactivas) |
| POST/PUT/PATCH/DELETE | `/promos/**` | A | `requireRol('admin')` `:20/36/52/63` | ✅ |
| ALL | `/mecanico/**` | T/A | `auth+requireRol('tecnico')` `:9` | ✅ (acota por `req.usuario.id`) |
| ALL | `/recepcion/**` | R/T/A | `auth+requireRol('recepcion')` `:13` | ✅ |
| ALL | `/admin/**` | A | `auth+requireRol('admin')` `:10` | ✅ |

### Portal cliente (`/api/portal/...`) — `auth-cliente`
Login/registro/recuperar públicos (con rate-limit). El resto exige `tipo:'cliente'` y **filtra por `req.cliente.id`** (motos, órdenes, citas, notificaciones, perfil). ✅ Sin IDOR detectado en el portal. La protección staff→portal funciona (`auth-cliente.js:13`).

### Frontend (guards de ruta)
| Ruta | Guard | Roles | ¿Coincide con backend? |
|------|-------|-------|------------------------|
| `/mecanico` | `AuthGuard+RolGuard` | `tecnico,admin` | ✅ (= `/api/mecanico`) |
| `/recepcion` | `AuthGuard+RolGuard` | `recepcion,admin` | ✅ |
| `/admin`, `/usuarios`, `/garantias`, `/nueva-orden`, `/cita-form`, `/promociones` | `AuthGuard+RolGuard` | `admin` | ✅ |
| `/detalle-orden/:id`, `/cliente-*`, `/moto-*`, `/factura/:id` | `AuthGuard` (sin rol) | cualquier staff | ⚠️ Coincide con backend laxo; el backend es la brecha real (#2-#4). Los guards del front **no sustituyen** la AuthZ del backend. |

> Nota: el rol que leen los guards proviene de `localStorage` (`auth.service.ts:53-64`), manipulable por el usuario. Esto **no** es vulnerabilidad si el backend valida (defensa en profundidad), pero hoy el backend no valida en #2-#5, así que la única barrera efectiva en esas rutas es inexistente.

---

## Fase 2 — Flujos y huecos lógicos

- **Cita → Orden:** `POST /api/recepcion/citas/:id/crear-orden` (`recepcion.routes.js:88`) enlaza `citas.orden_id` y es **idempotente** (si ya existe, la devuelve). Bien. La sincronización orden→cita (`utils/ordenes.js:37-65`) mapea estados y notifica; nunca lanza. Bien.
- **Orden → cotización → aprobación → cierre:** el cliente aprueba/rechaza con guard de estado (`portal.routes.js:605-619`, exige `esperando_aprobacion`). Pero el atajo de recepción `POST /api/recepcion/cotizaciones/:id/aprobar` (`recepcion.routes.js:565`) marca `aprobado` **sin** validar el estado actual → puede "aprobar" una orden que no está esperando aprobación. Inconsistencia (MEDIO, relacionado con #7).
- **Transiciones libres (#7):** ni `ordenes/:id/estado` ni `citas/:id/estado` validan la transición desde el estado vigente. Posible "entregar" sin pasar por aprobación; `orden_tiempos` puede abrir/cerrar etapas en orden ilógico.
- **Cupos:** portal con `FOR UPDATE` correcto; alta por recepción sin tope (#10).
- **Doble canal de facturación:** citas (`monto`) vs órdenes (`costo_*`). El código evita doble conteo con `id NOT IN (SELECT orden_id ...)` (`admin.routes.js:26-28`, `portal.routes.js:189-205`). Coherente, pero frágil ante cambios de esquema.

## Fase 4 — Calidad / consistencia
- `schema.sql` + `auto-migrate.js` (`ensureSchema`) son idempotentes y defensivos (`tryStep`, `addColumnIfMissing`, `crearIndiceSiFalta`). El enum de `rol` se reduce a `recepcion/tecnico/admin` (`auto-migrate.js:219-236`), coherente con `middleware/roles.js:1`. ✅
- Errores async: todas las rutas envuelven en `try/catch` con `fail`. Conexiones de transacción liberadas en `finally`. No se hallaron promesas sin `await` que rompan estado. ✅
- `utils/servicios.js` (HORAS legacy) quedó como fallback; el flujo real usa `utils/configuracion.js`. No verifiqué cobertura de tests más allá de los 19 que pasan (no cubren AuthZ).

---

## Recomendaciones priorizadas (NO aplicadas)

**P0 — cortar el acceso cruzado (raíz):**
1. Endurecer `middleware/auth.js` para **rechazar tokens que no sean de staff**: tras `jwt.verify`, exigir `payload.rol` presente y `payload.tipo !== 'cliente'` → si no, 401/403. Esto neutraliza #1-#5 de un solo cambio. (Opcional y más robusto: añadir `aud` distinto al firmar staff vs cliente y verificar `aud`.)
2. Añadir piso de rol explícito a cada router aunque #1 esté resuelto (defensa en profundidad): `clientes` y `citas`(GET/estado) → `requireRol('recepcion')`; `ordenes` y `motos` → `requireRol('recepcion')` (o `tecnico` donde corresponda); `garantias` → `requireRol('recepcion')`. Decidir explícitamente si `tecnico` debe gestionar clientes (#6).

**P1 — integridad de datos y flujos:**
3. Validar `rol ∈ {recepcion,tecnico,admin}` y formato de email en `usuarios` POST/PUT; impedir desactivar/last-admin (#9).
4. Implementar una **máquina de estados** para órdenes y citas (tabla de transiciones permitidas) (#7); y exigir `estado='esperando_aprobacion'` en el atajo de aprobación de recepción.
5. Aplicar `max_citas_hora` también en `POST /api/citas` de personal, o documentar el override (#10).

**P2 — endurecimiento:**
6. Rotar/forzar cambio de las credenciales semilla en producción y documentar que `migrate.js` es solo para bootstrap local (#8).
7. Rate-limit adicional por IP en `/auth/login`; considerar `aud`/`iss` en el JWT y acortar expiración o agregar revocación (#11,#14).
8. Evaluar CSP (#13) y límites de tamaño/uso para imágenes base64 (#16).
9. Confirmar en runtime el link admin→`/tabs/ordenes` y el comportamiento de `RolHomeGuard` (#15).

---

### Notas de verificación
- Hallazgos #1-#6 verificados por **lectura de código** (middleware + routers). No se ejecutó un PoC en vivo contra la instancia de Railway.
- #8 (credenciales en prod) y #15 (link muerto) **no son verificables solo desde el repo**; requieren probar el entorno desplegado.
- No se auditó el contenido de `package-lock.json` por vulnerabilidades de dependencias (fuera de alcance de esta pasada; recomendado `npm audit` aparte).

---

## Changelog de remediación

> Cambios mínimos, sin dependencias nuevas. `npm test` (19/19) en verde tras cada fix.

| # | Sev | Fix aplicado | Archivo(s) |
|---|-----|--------------|------------|
| 1 | CRÍTICO | `auth` rechaza (403) tokens que no sean de staff (`tipo==='cliente'` o sin `rol`). Corta de raíz el acceso cruzado cliente→staff. | `backend/src/middleware/auth.js` |
| 2 | CRÍTICO | Piso `requireRol('recepcion')` en el router de clientes (defensa en profundidad; preserva `admin` en `/:id/portal`). | `backend/src/routes/clientes.routes.js` |
| 3 | CRÍTICO | Piso `requireRol('recepcion')` en el router de órdenes (preserva guards `tecnico`/`admin` por endpoint). | `backend/src/routes/ordenes.routes.js` |
| 4 | CRÍTICO | Piso `requireRol('recepcion')` en el router de citas (preserva `soloRoles`/inline existentes). | `backend/src/routes/citas.routes.js` |
| 5 | ALTO | Piso `requireRol('recepcion')` en el router de garantías (preserva `admin` en `/:id/estado`). | `backend/src/routes/garantias.routes.js` |
| 9 | MEDIO | `usuarios`: whitelist de `rol`, validación de email y campos requeridos (POST/PUT), y anti-lockout (el admin no puede auto-desactivarse ni quitarse el rol admin). | `backend/src/routes/usuarios.routes.js` |
| 6 | MEDIO | `clientes`: piso elevado a `soloRoles('recepcion','admin')` — excluye a `tecnico` del CRUD de PII. | `backend/src/routes/clientes.routes.js` |
| 8 | MEDIO | `migrate.js`: cuentas semilla sin contraseñas hardcodeadas; ahora se leen de `SEED_*_PASSWORD` y se omiten (con aviso) si faltan. `JWT_SECRET` y vars de seed documentadas. | `backend/src/db/migrate.js`, `backend/.env.example` |
| 7 | MEDIO | Máquina de estados: transiciones válidas para órdenes y citas (nuevo `utils/transiciones.js`), aplicadas en `PATCH /ordenes/:id/estado`, `PATCH /citas/:id/estado` y `PATCH /mecanico/citas/:id/estado` (no-op permitido; rechazo 400 en saltos ilógicos). Front alineado: quitado el atajo roto "Entregada" en detalle-orden (la entrega va por `/cerrar`) y el `<select>` del mecánico ahora ofrece solo transiciones válidas. | `backend/src/utils/transiciones.js`, `backend/src/routes/ordenes.routes.js`, `backend/src/routes/citas.routes.js`, `backend/src/routes/mecanico.routes.js`, `frontend/.../detalle-orden.page.ts`, `frontend/.../mecanico.page.ts`, `frontend/.../mecanico.page.html` |
| 15 | BAJO | `RolHomeGuard` redirige al admin a `/admin` solo en el índice de `/tabs`; respeta los deep-links operativos (arregla el link muerto "Órdenes y agenda" → `/tabs/ordenes`). | `frontend/src/app/guards/rol-home.guard.ts` |
| 11 | BAJO | Login: `bcrypt.compare` señuelo cuando el correo no existe, para no delatar cuentas por timing (anti-enumeración). | `backend/src/routes/auth.routes.js` |

### Tests añadidos
- `backend/test/auth.test.js` — token de cliente/sin-rol → 403; staff → `next()` + `req.usuario`; 401 sin/inválido token. (cubre #1)
- `backend/test/roles.test.js` — jerarquía de `requireRol` y membresía exacta de `soloRoles`. (cubre #2-#6)
- `backend/test/transiciones.test.js` — avances válidos, saltos/retrocesos bloqueados, no-op, cancelar. (cubre #7)
- Total suite: **35/35**.

### Pendiente (decisión del usuario / acción de entorno, no código)
- **#12** (rate-limit por IP en login): requiere `app.set('trust proxy', 1)` para Railway — pendiente de confirmación.
- **#10** (cupo en alta de citas desde recepción): ¿override intencional del mostrador? Pendiente de decisión.
- **#13/#14/#16**: evaluados y omitidos por riesgo/proporción (ver tabla de hallazgos).
- **Rotar en Railway** las claves semilla `Admin2024!`/`Recep2024!` si ya quedaron creadas (no se puede desde el repo).

