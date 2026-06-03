# Proyecto Taller

App **Ionic + Angular** con backend **Node.js + Express** y base de datos **MySQL**.

```
Proyecto Taller/
├── frontend/   → App Ionic + Angular (corre en navegador / móvil)
└── backend/    → API REST Node + Express (habla con MySQL)
```

Ionic no se conecta directamente a MySQL: el **frontend** llama por HTTP a la **API**,
y la API es la única que abre conexiones a la base de datos.

```
[Ionic/Angular] --HTTP--> [Express API] --SQL--> [MySQL]
   :8100                     :3000                :3306
```

---

## Requisitos

- Node.js 18+ (tienes v24 ✓)
- MySQL Server 8.x corriendo (tienes 8.4.3 ✓)
- Ionic CLI y Angular CLI (ya instalados globalmente)

---

## 1. Base de datos

Ya está creada (`proyecto_taller`) con la tabla `items` y datos de ejemplo.
Para recrearla desde cero, en MySQL Workbench abre y ejecuta `backend/schema.sql`,
o por terminal:

```bash
mysql -u root -p < backend/schema.sql
```

---

## 2. Backend (API)

```bash
cd backend
# Configura credenciales (ya hay un .env listo para root sin password)
npm run dev        # con recarga automática (nodemon)
# o
npm start          # modo normal
```

La API queda en **http://localhost:3000**. Endpoints:

| Método | Ruta              | Descripción            |
|--------|-------------------|------------------------|
| GET    | `/api/health`     | Comprueba que vive     |
| GET    | `/api/items`      | Lista todos            |
| GET    | `/api/items/:id`  | Uno por id             |
| POST   | `/api/items`      | Crear `{nombre, descripcion}` |
| PUT    | `/api/items/:id`  | Actualizar             |
| DELETE | `/api/items/:id`  | Borrar                 |

Configuración en `backend/.env` (copiado de `.env.example`):

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=          # vacío en tu instalación
DB_NAME=proyecto_taller
CORS_ORIGIN=http://localhost:8100
```

---

## 3. Frontend (Ionic)

En **otra terminal** (deja el backend corriendo):

```bash
cd frontend
ionic serve
```

Abre **http://localhost:8100**. Verás el CRUD de `items`:
crear, listar, editar (deslizar a la izquierda) y borrar.

La URL de la API se configura en `frontend/src/environments/environment.ts`.

---

## Cómo adaptarlo a tu app real

Cuando definas qué tipo de app es, los puntos a tocar son:

1. **`backend/schema.sql`** → cambia la tabla `items` por tus tablas reales.
2. **`backend/src/routes/`** → crea rutas para tus entidades (copia `items.routes.js`).
3. **`backend/src/server.js`** → registra las nuevas rutas con `app.use(...)`.
4. **`frontend/src/app/models/`** y **`services/`** → un modelo y servicio por entidad.
5. **`frontend/src/app/`** → páginas/UI para tus entidades (`ionic generate page ...`).
