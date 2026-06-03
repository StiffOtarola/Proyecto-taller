# PLAN MAESTRO — TallerMS (Sistema de Gestión de Taller de Motocicletas)

> Pega este documento al inicio de cualquier sesión de Claude Code para dar contexto completo del proyecto.

---

## 1. CONTEXTO: LO QUE YA ESTÁ CONSTRUIDO

### Infraestructura operativa (NO TOCAR)
- **Monorepo**: carpeta raíz con subcarpetas `frontend/` y `backend/`
- **Repositorio**: `StiffOtarola/Proyecto-taller` en GitHub
- **Deploy**: Railway — deploy automático con cada `git push` a rama `main`
- **Build**: `nixpacks.toml` instala dependencias, compila Angular, arranca Express
- **URL producción**: `https://proyecto-taller-production-0e4b.up.railway.app`
- **Base de datos**: MySQL corriendo como servicio interno en Railway
- **Conexión DB**: El pool lee `DB_*` en local (archivo `.env`) y `MYSQL_URL` en Railway
- **CORS**: Ya configurado en Express — no modificar

### Stack tecnológico (DEFINITIVO — no agregar Laravel ni otros frameworks)
- **Frontend**: Ionic + Angular con arquitectura **NgModules** (NO migrar a standalone)
- **Backend**: Node.js + Express 5 con `mysql2`
- **Base de datos**: MySQL

### Estado actual del código
- Existe una tabla `items` temporal en la base de datos → **ELIMINAR**
- El frontend tiene una página CRUD básica sobre `items` → **REEMPLAZAR COMPLETAMENTE**
- Los environments de Angular ya están configurados:
  - Local → `http://localhost:3000/api`
  - Producción → `/api` (relativo, sin CORS)

---

## 2. QUÉ ES ESTA APLICACIÓN

**TallerMS** es un sistema de gestión para taller de motocicletas con dos objetivos:

1. **Control operativo interno**: flujo completo de motos desde recepción hasta entrega, técnicos, repuestos y tiempos
2. **Experiencia del cliente**: citas, seguimiento de estado, aprobación de presupuestos, notificaciones

### Dominio principal
El núcleo es la **Orden de Trabajo (OT)**: documento que sigue a una moto desde que entra al taller hasta que es entregada al cliente. Cada OT tiene un flujo de estados, técnico asignado, repuestos, avances y costos.

---

## 3. ROLES Y PERMISOS

| Rol | Código | Acceso |
|-----|--------|--------|
| Recepción | `recepcion` | Crear clientes, motos, órdenes, citas |
| Técnico | `tecnico` | Ver órdenes asignadas, registrar avances y repuestos |
| Jefe de Taller | `jefe_taller` | Todo lo anterior + asignar técnicos + cambiar estados |
| Administración | `admin` | Todo + facturación + reportes |
| Gerencia | `gerencia` | Acceso total + dashboard gerencial |

**Jerarquía de privilegios**: `gerencia` > `admin` > `jefe_taller` > `tecnico` > `recepcion`

---

## 4. FLUJO DE ESTADOS DE UNA ORDEN DE TRABAJO

```
[recepcion] → [diagnostico] → [esperando_aprobacion] → [esperando_repuestos]
                                        ↓                         ↓
                                  [en_reparacion] ←──────────────┘
                                        ↓
                                  [lista_entrega]
                                        ↓
                                    [entregada]
                                        
En cualquier punto → [cancelada] (solo admin o gerencia)
```

### Reglas de transición
- `tecnico`: solo puede avanzar al siguiente estado en su flujo
- `jefe_taller`, `admin`, `gerencia`: pueden mover hacia adelante o atrás
- Al cambiar de estado → registrar automáticamente en tabla `orden_tiempos`
- `cancelada` → solo `admin` o `gerencia`

---

## 5. ESQUEMA COMPLETO DE BASE DE DATOS

> Ejecutar estas sentencias SQL en orden para migrar la base de datos.

```sql
-- =============================================
-- PASO 1: Eliminar tabla temporal
-- =============================================
DROP TABLE IF EXISTS items;

-- =============================================
-- PASO 2: Usuarios del sistema (empleados)
-- =============================================
CREATE TABLE IF NOT EXISTS usuarios (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  email       VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol         ENUM('recepcion','tecnico','jefe_taller','admin','gerencia') NOT NULL DEFAULT 'tecnico',
  activo      TINYINT(1) DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================
-- PASO 3: Clientes
-- =============================================
CREATE TABLE IF NOT EXISTS clientes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  apellido    VARCHAR(100) NOT NULL,
  telefono    VARCHAR(20) NOT NULL,
  email       VARCHAR(100),
  cedula      VARCHAR(20),
  direccion   TEXT,
  activo      TINYINT(1) DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================
-- PASO 4: Motocicletas
-- =============================================
CREATE TABLE IF NOT EXISTS motos (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id       INT NOT NULL,
  marca            VARCHAR(50) NOT NULL,
  modelo           VARCHAR(100) NOT NULL,
  anio             YEAR,
  placa            VARCHAR(20),
  color            VARCHAR(50),
  numero_motor     VARCHAR(50),
  numero_chasis    VARCHAR(50),
  kilometraje_actual INT DEFAULT 0,
  foto_url         VARCHAR(500),
  activa           TINYINT(1) DEFAULT 1,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

-- =============================================
-- PASO 5: Órdenes de trabajo (entidad central)
-- =============================================
CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  numero_orden          VARCHAR(20) UNIQUE NOT NULL,   -- Formato: OT-2024-0001 (generado en backend)

  -- Relaciones
  moto_id               INT NOT NULL,
  cliente_id            INT NOT NULL,
  recepcionista_id      INT,
  tecnico_id            INT,

  -- Estado del flujo
  estado                ENUM(
                          'recepcion',
                          'diagnostico',
                          'esperando_aprobacion',
                          'esperando_repuestos',
                          'en_reparacion',
                          'lista_entrega',
                          'entregada',
                          'cancelada'
                        ) NOT NULL DEFAULT 'recepcion',

  -- Datos de recepción
  problema_reportado    TEXT NOT NULL,
  kilometraje_ingreso   INT,
  nivel_combustible     ENUM('vacio','cuarto','mitad','tres_cuartos','lleno') DEFAULT 'cuarto',
  accesorios_entregados TEXT,
  estado_fisico         TEXT,

  -- Clasificación
  prioridad             ENUM('normal','urgente','emergencia','garantia') DEFAULT 'normal',
  categoria             ENUM('rapido','garantia','emergencia','diagnostico','preventivo','mayor') DEFAULT 'diagnostico',

  -- Diagnóstico
  diagnostico           TEXT,
  tiempo_estimado_horas DECIMAL(5,2),

  -- Costos (en colones costarricenses CRC)
  costo_mano_obra       DECIMAL(10,2) DEFAULT 0,
  costo_repuestos       DECIMAL(10,2) DEFAULT 0,
  descuento             DECIMAL(10,2) DEFAULT 0,

  -- Aprobación del cliente
  aprobado_por_cliente  TINYINT(1) DEFAULT 0,
  fecha_aprobacion      TIMESTAMP NULL,

  -- Fechas
  fecha_ingreso         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_estimada_entrega DATE,
  fecha_entrega_real    TIMESTAMP NULL,

  -- Cierre
  metodo_pago           ENUM('efectivo','sinpe','tarjeta','transferencia') NULL,
  garantia_dias         INT DEFAULT 0,
  observaciones_finales TEXT,

  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (moto_id) REFERENCES motos(id),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (recepcionista_id) REFERENCES usuarios(id),
  FOREIGN KEY (tecnico_id) REFERENCES usuarios(id)
);

-- =============================================
-- PASO 6: Repuestos por orden
-- =============================================
CREATE TABLE IF NOT EXISTS orden_repuestos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  orden_id        INT NOT NULL,
  nombre          VARCHAR(200) NOT NULL,
  cantidad        INT NOT NULL DEFAULT 1,
  costo_unitario  DECIMAL(10,2) DEFAULT 0,
  estado          ENUM('disponible','pendiente','pedido_especial') DEFAULT 'pendiente',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id)
);

-- =============================================
-- PASO 7: Avances / notas de progreso
-- =============================================
CREATE TABLE IF NOT EXISTS orden_avances (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  orden_id    INT NOT NULL,
  usuario_id  INT NOT NULL,
  descripcion TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- =============================================
-- PASO 8: Fotos adjuntas a órdenes
-- =============================================
CREATE TABLE IF NOT EXISTS orden_fotos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  orden_id    INT NOT NULL,
  url         VARCHAR(500) NOT NULL,
  tipo        ENUM('ingreso','diagnostico','avance','entrega') DEFAULT 'ingreso',
  descripcion VARCHAR(200),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id)
);

-- =============================================
-- PASO 9: Tiempos por etapa (para métricas)
-- =============================================
CREATE TABLE IF NOT EXISTS orden_tiempos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  orden_id    INT NOT NULL,
  etapa       ENUM('recepcion','diagnostico','esperando_aprobacion','esperando_repuestos','en_reparacion','lista_entrega') NOT NULL,
  inicio      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fin         TIMESTAMP NULL,
  FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id)
);

-- =============================================
-- PASO 10: Checklist de entrega
-- =============================================
CREATE TABLE IF NOT EXISTS orden_checklist (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  orden_id            INT UNIQUE NOT NULL,
  prueba_realizada    TINYINT(1) DEFAULT 0,
  lavado              TINYINT(1) DEFAULT 0,
  calidad_revisada    TINYINT(1) DEFAULT 0,
  facturacion_lista   TINYINT(1) DEFAULT 0,
  cliente_notificado  TINYINT(1) DEFAULT 0,
  observaciones       TEXT,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id)
);

-- =============================================
-- PASO 11: Citas / Agenda
-- =============================================
CREATE TABLE IF NOT EXISTS citas (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id  INT NOT NULL,
  moto_id     INT,
  usuario_id  INT,                    -- quien agendó
  fecha       DATE NOT NULL,
  hora        TIME NOT NULL,
  motivo      TEXT NOT NULL,
  estado      ENUM('pendiente','confirmada','cancelada','completada') DEFAULT 'pendiente',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (moto_id)    REFERENCES motos(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
```

---

## 6. ESTRUCTURA DEL BACKEND

### Dependencias nuevas a instalar en `backend/`
```bash
npm install jsonwebtoken bcrypt
```

### Árbol de archivos del backend
```
backend/
├── src/
│   ├── db/
│   │   ├── connection.js          # YA EXISTE — pool MySQL con soporte local/Railway
│   │   └── migrate.js             # Script nuevo para ejecutar el schema SQL
│   ├── middleware/
│   │   ├── auth.js                # Valida JWT en cabecera Authorization: Bearer <token>
│   │   └── roles.js               # Verifica que el rol del usuario tenga permiso mínimo
│   ├── routes/
│   │   ├── auth.js                # Login + me
│   │   ├── clientes.js            # CRUD clientes
│   │   ├── motos.js               # CRUD motos + historial
│   │   ├── ordenes.js             # CRUD órdenes + flujo completo
│   │   ├── citas.js               # CRUD citas
│   │   ├── usuarios.js            # CRUD usuarios (solo admin+)
│   │   └── dashboard.js           # Métricas y resumen gerencial
│   └── index.js                   # Servidor Express principal
├── .env                           # Variables locales (DB_HOST, DB_USER, etc. + JWT_SECRET)
└── package.json
```

### Variables de entorno en `.env` (agregar)
```
JWT_SECRET=clave_super_secreta_cambiar_en_produccion
JWT_EXPIRES_IN=8h
```

### Todas las rutas API

#### Autenticación
```
POST   /api/auth/login        → body: { email, password } → res: { token, usuario }
GET    /api/auth/me           → header: Bearer token → res: { usuario }
```

#### Clientes
```
GET    /api/clientes              → lista, acepta ?q= para búsqueda por nombre/teléfono
POST   /api/clientes              → crear cliente
GET    /api/clientes/:id          → detalle del cliente
PUT    /api/clientes/:id          → editar cliente
GET    /api/clientes/:id/motos    → motos registradas del cliente
GET    /api/clientes/:id/ordenes  → historial de órdenes del cliente
```

#### Motos
```
GET    /api/motos                 → lista, acepta ?cliente_id= y ?q=
POST   /api/motos                 → registrar moto
GET    /api/motos/:id             → detalle de la moto
PUT    /api/motos/:id             → editar moto
GET    /api/motos/:id/historial   → todas las órdenes de trabajo de esa moto
```

#### Órdenes de Trabajo
```
GET    /api/ordenes                         → lista con filtros: ?estado= ?tecnico_id= ?fecha_desde= ?fecha_hasta=
POST   /api/ordenes                         → crear nueva orden (genera numero_orden automático)
GET    /api/ordenes/:id                     → detalle completo (incluye moto, cliente, técnico, repuestos, avances)
PUT    /api/ordenes/:id                     → editar datos básicos de la orden
PATCH  /api/ordenes/:id/estado              → cambiar estado del flujo (registra en orden_tiempos)
PATCH  /api/ordenes/:id/tecnico             → asignar o reasignar técnico (jefe_taller+)
POST   /api/ordenes/:id/avances             → agregar nota de progreso
GET    /api/ordenes/:id/avances             → listar avances de la orden
POST   /api/ordenes/:id/repuestos           → agregar repuesto a la orden
GET    /api/ordenes/:id/repuestos           → listar repuestos de la orden
PUT    /api/ordenes/:id/repuestos/:rid      → editar un repuesto
DELETE /api/ordenes/:id/repuestos/:rid      → eliminar un repuesto
PATCH  /api/ordenes/:id/aprobar             → marcar como aprobado por el cliente
POST   /api/ordenes/:id/checklist           → guardar/actualizar checklist de entrega
GET    /api/ordenes/:id/checklist           → obtener checklist de la orden
PATCH  /api/ordenes/:id/cerrar              → cerrar orden (registra pago, garantía, fecha entrega)
```

#### Citas
```
GET    /api/citas                 → lista con filtros: ?fecha= ?estado=
POST   /api/citas                 → crear cita
GET    /api/citas/:id             → detalle de la cita
PUT    /api/citas/:id             → editar cita
PATCH  /api/citas/:id/estado      → confirmar / cancelar cita
```

#### Usuarios
```
GET    /api/usuarios              → lista de empleados (requiere admin o gerencia)
POST   /api/usuarios              → crear usuario con password (requiere admin o gerencia)
PUT    /api/usuarios/:id          → editar datos del usuario (requiere admin o gerencia)
PATCH  /api/usuarios/:id/activo   → activar o desactivar usuario (requiere admin o gerencia)
```

#### Dashboard / Métricas
```
GET    /api/dashboard/resumen     → { motos_activas, motos_atrasadas, facturacion_hoy, ordenes_por_estado }
GET    /api/dashboard/tecnicos    → productividad: órdenes completadas, tiempo promedio por técnico
GET    /api/dashboard/tiempos     → promedio de tiempo por etapa del flujo
```

### Lógica del número de orden
El `numero_orden` se genera en el backend al crear la orden:
```javascript
// Formato: OT-YYYY-XXXX
// Ejemplo: OT-2024-0001
const year = new Date().getFullYear();
const [{ count }] = await pool.query('SELECT COUNT(*) as count FROM ordenes_trabajo WHERE YEAR(created_at) = ?', [year]);
const numero = String(count + 1).padStart(4, '0');
const numero_orden = `OT-${year}-${numero}`;
```

### Seed: usuario administrador inicial
Al ejecutar la migración, crear el primer usuario con bcrypt:
```javascript
const bcrypt = require('bcrypt');
const hash = await bcrypt.hash('Admin2024!', 10);
await pool.query(
  'INSERT IGNORE INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)',
  ['Administrador', 'admin@taller.com', hash, 'gerencia']
);
```

---

## 7. ESTRUCTURA DEL FRONTEND

### Dependencias nuevas en `frontend/`
```bash
npm install @ionic/storage-angular
```

### Árbol de páginas (Ionic + Angular NgModules)
```
frontend/src/app/
├── guards/
│   └── auth.guard.ts                  # Redirige a /login si no hay token válido
├── interceptors/
│   └── auth.interceptor.ts            # Agrega header Authorization: Bearer <token> a cada request
├── services/
│   ├── auth.service.ts                # Login, logout, getUsuario(), isLoggedIn()
│   ├── clientes.service.ts            # Llamadas HTTP a /api/clientes
│   ├── motos.service.ts               # Llamadas HTTP a /api/motos
│   ├── ordenes.service.ts             # Llamadas HTTP a /api/ordenes
│   ├── citas.service.ts               # Llamadas HTTP a /api/citas
│   └── dashboard.service.ts           # Llamadas HTTP a /api/dashboard
└── pages/
    ├── login/                         # Formulario email + password
    │
    ├── tabs/                          # Contenedor de tabs principal (post-login)
    │
    ├── dashboard/                     # Tab Home: resumen de motos activas, atrasadas, facturación
    │
    ├── ordenes/                       # Tab Órdenes: lista con filtros por estado (chips/segmento)
    │                                  # Swipe para acciones rápidas
    ├── nueva-orden/                   # Formulario recepción: buscar/crear cliente → buscar/crear moto → datos OT
    ├── detalle-orden/                 # Vista completa de la OT:
    │                                  #   - Header con estado actual (color semáforo)
    │                                  #   - Botón cambiar estado
    │                                  #   - Sección diagnóstico y costos
    │                                  #   - Lista de repuestos (agregar/editar)
    │                                  #   - Timeline de avances
    │                                  #   - Checklist de entrega (cuando aplica)
    │                                  #   - Asignar técnico (jefe_taller+)
    │
    ├── clientes/                      # Tab Clientes: lista con búsqueda
    ├── cliente-form/                  # Crear o editar cliente
    ├── cliente-detalle/               # Detalle cliente + sus motos + historial de órdenes
    │
    ├── motos/                         # Lista de motos con búsqueda
    ├── moto-form/                     # Crear o editar moto
    ├── moto-historial/                # Historial completo de servicios de una moto
    │
    ├── citas/                         # Tab Agenda: lista de citas con filtro por fecha y estado
    ├── cita-form/                     # Crear o editar cita
    │
    ├── usuarios/                      # Gestión de empleados (solo admin / gerencia)
    └── reportes/                      # Reportes básicos: facturación, tiempos, técnicos (solo admin+)
```

### Semáforo visual de estados
Los estados de la OT deben mostrar colores consistentes en toda la UI:

| Estado | Color | Significado |
|--------|-------|-------------|
| `recepcion` | azul (`primary`) | Recién ingresada |
| `diagnostico` | naranja (`warning`) | En evaluación |
| `esperando_aprobacion` | amarillo | Aguardando cliente |
| `esperando_repuestos` | morado | Bloqueada por falta de partes |
| `en_reparacion` | verde claro | Trabajo activo |
| `lista_entrega` | verde (`success`) | Lista para retirar |
| `entregada` | gris | Cerrada |
| `cancelada` | rojo (`danger`) | Cancelada |

### Lógica del auth.service.ts
```typescript
// Guardar token en localStorage (Ionic/Browser)
// Exponer observable del usuario actual
// El interceptor lee el token y agrega el header en cada petición HTTP
// El guard verifica isLoggedIn() antes de activar rutas protegidas
```

---

## 8. PLAN DE IMPLEMENTACIÓN — FASE 1 MVP

Implementar en este orden exacto:

### Backend (primero)
1. Ejecutar el script SQL completo para migrar la base de datos
2. Crear seed del usuario admin inicial con bcrypt
3. Crear `middleware/auth.js` (validar JWT) y `middleware/roles.js` (verificar rol mínimo)
4. Implementar `POST /api/auth/login` y `GET /api/auth/me`
5. Implementar rutas de **clientes** (CRUD completo)
6. Implementar rutas de **motos** (CRUD + historial)
7. Implementar rutas de **órdenes** (todo el flujo completo)
8. Implementar rutas de **citas**
9. Implementar rutas de **usuarios** (solo admin+)
10. Implementar rutas de **dashboard** (resumen básico)

### Frontend (después del backend)
1. Configurar `AuthService` + `AuthInterceptor` + `AuthGuard`
2. Implementar página **Login**
3. Implementar estructura de **Tabs** (navbar principal)
4. Implementar **Dashboard** (home tab con cards de resumen)
5. Implementar lista de **Órdenes** con filtros por estado
6. Implementar **Detalle de Orden** (vista completa del flujo)
7. Implementar formulario **Nueva Orden** (búsqueda de cliente/moto + recepción)
8. Implementar páginas de **Clientes** (lista, form, detalle)
9. Implementar páginas de **Motos** (lista, form, historial)
10. Implementar páginas de **Citas** (lista y form)
11. Implementar página de **Usuarios** (solo admin+)

---

## 9. FASE 2 (DESPUÉS DEL MVP — NO IMPLEMENTAR AHORA)

- Integración con WhatsApp / SMS automático al cambiar estado
- Aprobación digital de presupuesto desde el celular del cliente
- App cliente (módulo separado o vistas públicas)
- Dashboard gerencial avanzado con gráficas (Chart.js o similar)
- Reportes financieros detallados con exportación PDF/Excel
- Integración con inventario y Qupos
- Encuesta de satisfacción al cierre

---

## 10. DECISIONES TÉCNICAS IMPORTANTES

| Aspecto | Decisión |
|---------|----------|
| Autenticación | JWT con `jsonwebtoken`. Secret en `JWT_SECRET` del `.env`. Expiración: `8h` (turno laboral). |
| Contraseñas | `bcrypt` con `saltRounds: 10`. Nunca almacenar en texto plano. |
| Moneda | Colones costarricenses (CRC). Campos `DECIMAL(10,2)`. |
| Zona horaria | `America/Costa_Rica` (UTC-6, sin horario de verano). |
| Angular | Mantener arquitectura **NgModules**. NO migrar a standalone components. |
| Deploy | No modificar `nixpacks.toml` ni la lógica de `MYSQL_URL`. Funciona perfectamente. |
| Total de orden | Calcular en el backend: `total = costo_mano_obra + costo_repuestos - descuento`. |
| IDs | Todos `INT AUTO_INCREMENT`. No usar UUIDs. |
| Soft delete | Usar campo `activo TINYINT(1)` en clientes, motos y usuarios. No borrar físicamente. |

---

## 11. REGLAS PARA CLAUDE CODE

1. **Siempre respetar la estructura de monorepo** — no mover archivos entre `frontend/` y `backend/`
2. **No modificar el sistema de conexión a base de datos** existente en `connection.js`
3. **No modificar `nixpacks.toml`** — el build de Railway ya funciona
4. **No cambiar los environments de Angular** — ya apuntan correctamente a la API
5. **Las rutas del backend siempre bajo `/api/`** para que el proxy de Angular funcione
6. **Usar `pool.query()` del pool existente** — no crear conexiones nuevas directas
7. **Todo el manejo de errores con try/catch** y respuestas JSON consistentes:
   ```json
   { "error": "Mensaje descriptivo del error" }
   ```
8. **Respuestas exitosas** con formato consistente:
   ```json
   { "data": [...], "message": "Operación exitosa" }
   ```
9. **Verificar rol en cada ruta sensible** usando el middleware `roles.js`
10. **Al crear la primera versión del SQL**, confirmar que las tablas se crean en orden correcto (respetar FK)
