# MS Motos — Gestión de taller

Sistema de gestión para un taller de motos: **citas**, **órdenes de trabajo**,
**portal de clientes**, **garantías**, **fidelización** y paneles por rol.

App **Ionic + Angular** (NgModules) con API **Node.js + Express 5** y base **MySQL 8.x**.
Desplegada en **Railway** (auto-deploy desde `main`).

```
Proyecto Taller/
├── frontend/   → App Ionic + Angular (navegador / móvil)
└── backend/    → API REST Express + MySQL
```

El frontend no toca MySQL directo: llama por HTTP a la API, y la API es la única
que abre conexiones a la base. En producción, Express también sirve el build de Angular.

```
[Ionic/Angular] --HTTP--> [Express API] --SQL--> [MySQL]
```

---

## Roles

Tres roles (jerarquía `recepcion` < `tecnico` < `admin`):

- **recepcion** — mostrador: clientes, órdenes de trabajo, cotizaciones, mensajería.
- **tecnico** (mecánico) — su agenda de citas, tareas asignadas, perfil.
- **admin** — panel `/admin` (resumen, citas, empleados, reportes, tareas, promociones)
  y el dashboard operativo `/tabs`.

Los clientes entran por el **portal** (`/portal`): registro, agenda de citas con cupos,
seguimiento de su moto, aprobación de presupuestos y calificación.

---

## Requisitos

- Node.js 18+
- MySQL Server 8.x
- Ionic CLI y Angular CLI

---

## 1. Base de datos

Creá la base y configurá `backend/.env` (copia de `backend/.env.example`):

```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=taller_motos
CORS_ORIGIN=http://localhost:8100
RESEND_API_KEY=          # opcional; sin key, los códigos se imprimen en consola
```

Cargá el esquema y los usuarios semilla:

```bash
cd backend
node src/db/migrate.js
```

Crea las tablas (`backend/schema.sql`) y dos cuentas de prueba:

- **admin@taller.com** / `Admin2024!` (rol admin)
- **recepcion@taller.com** / `Recep2024!` (rol recepción)

> La API además corre **migraciones idempotentes** (`ensureSchema`) en cada arranque,
> así que el esquema se mantiene al día solo en cada deploy.

---

## 2. Backend (API)

```bash
cd backend
npm install
npm run dev        # recarga automática (nodemon)
# o
npm start
npm test           # tests unitarios
```

API en **http://localhost:3000**, montada bajo `/api` (auth, clientes, motos, citas,
ordenes, recepcion, mecanico, admin, garantias, promos, portal…).

---

## 3. Frontend (Ionic)

En otra terminal, con el backend corriendo:

```bash
cd frontend
npm install
ionic serve                              # http://localhost:8100
npx ng build --configuration production  # build de producción
```

La URL de la API se configura en `frontend/src/environments/`.

---

## Deploy

Railway despliega automáticamente al hacer **push a `main`**. La API sirve el build
del frontend y ejecuta las migraciones al arrancar; no hay pasos manuales de base de datos.
