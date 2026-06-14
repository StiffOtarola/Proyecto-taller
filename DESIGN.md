# Design System: TallerMS — "Crimson Ops"

> Fuente única de verdad para generar pantallas en **Google Stitch** que calcen con
> la app real (Ionic/Angular). Pegá este archivo como contexto y pedí una pantalla a
> la vez. Atmósfera: **Density 7 (cockpit operativo), Variance 4 (estructura clara con
> acentos), Motion 5 (físico y sobrio)**. Todos los textos de interfaz en **español
> (Costa Rica)**, moneda en colones con símbolo **₡**.

## 1. Visual Theme & Atmosphere
Herramienta operativa premium para un taller de motocicletas — densa pero respirable,
tipo "panel de control de taxista pro" cruzado con Linear/Things. Superficies limpias
y neutras, un único acento carmesí que aparece con disciplina (estados activos, totales,
acciones primarias), datos siempre en monoespaciada para lectura rápida. Sensación:
**técnica, confiable, sin adornos**. La marca vive en el contraste y la tipografía, no
en gradientes ni brillos.

## 2. Color Palette & Roles
- **Canvas Bruma** (#FAFAFA) — Fondo principal de la app (modo claro)
- **Superficie Pura** (#FFFFFF) — Relleno de tarjetas y contenedores
- **Tinta Carbón** (#0A0A0A) — Texto primario (Zinc-950, nunca negro puro #000000)
- **Grafito Medio** (#737373) — Texto secundario, metadatos, etiquetas
- **Borde Susurro** (rgba(10,10,10,0.07)) — Líneas hairline de 1px, bordes de tarjeta
- **Carmesí Mecánico** (#E11D48) — **único acento**: CTA primario, estado activo, totales, FAB, foco
  - Presionado/hover: **Carmesí Profundo** (#BE123C)
  - Tinte de fondo: **Carmesí Niebla** (#FFF1F2) con borde #FECDD3
- **Esmeralda** (#059669 / fondo #ECFDF5) — éxito, "a tiempo", "OK"
- **Ámbar** (#D97706 / fondo #FEF3C7) — advertencia, "por vencer", pendiente
- **Rojo Alerta** (#DC2626) — peligro, "requiere aprobación", atrasada
- **Índigo** (#4F46E5 / fondo #EEF2FF) — presupuesto/aprobación, rol técnico
- **Modo oscuro:** lienzo #0A0A0A, tarjetas #171717, texto #FAFAFA, bordes rgba(255,255,255,0.08). El carmesí pasa a #F43F5E.

Restricciones: **un solo acento**, sin púrpura/azul neón, sin glows, sin gradientes en
botones, sin fluctuar entre grises cálidos y fríos (toda la escala es neutral Zinc).

## 3. Typography Rules
- **Display** (`Outfit`, 700–800, tracking -0.03em) — títulos, montos grandes, números hero. Jerarquía por peso y color, no por tamaño gritado.
- **Cuerpo** (`Plus Jakarta Sans`, 400–700) — texto, etiquetas, ~65ch máx, color secundario para metadatos.
- **Mono** (`JetBrains Mono`) — **obligatorio** para montos ₡, fechas, placas, IDs de orden (densidad > 7). Cifras tabulares.
- **Banned:** `Inter`, fuentes del sistema para contexto premium, cualquier serif en UI de software.

## 4. Component Stylings
- **Botones:** Relleno sólido carmesí para primario; outline/fantasma para secundario. Sin glow. Feedback táctil `scale(0.97)` al presionar. Radio 16px. CTA destacados en MAYÚSCULAS con tracking 0.08em.
- **Tarjetas:** Esquinas 24px (`--radius-card`), borde hairline 1px + sombra difusa **tintada al fondo** (cálido-neutra, nunca negra pura). Entran con un `cardRise` sutil. En layouts densos, reemplazar tarjeta por divisores border-top.
- **Inputs:** Etiqueta arriba (o flotante en formularios), radio 12px, anillo de foco carmesí, error debajo. Nada de placeholders como única etiqueta.
- **Badges/Pills:** Píldora full-round, 11px, peso 700. Estado por color semántico (carmesí/esmeralda/ámbar/índigo/gris).
- **Segmentos/Tabs:** Contenedor píldora neutro (#F5F5F5) con indicador carmesí deslizante; contadores en mini-badge.
- **Stat-cards (KPIs):** Tarjeta blanca, número gigante en `Outfit` carmesí, etiqueta diminuta en mayúsculas, adorno de círculo en esquina.
- **Timeline:** Línea vertical carmesí de 1.5px con nodos de anillo; completados rellenos, actual con halo.
- **FAB:** Círculo carmesí con sombra tintada; rota 90° en hover.
- **Loaders:** Skeleton shimmer con la forma exacta del contenido. **Nunca** spinner circular genérico.
- **Empty states:** Composición con ícono de línea fina + texto + acción sugerida.

## 5. Layout Principles
- Grilla CSS primero; sin hacks de `calc()` por porcentaje.
- Contenedores con max-width (dashboard ~1240px centrado; detalle/formularios ~760–860px).
- **Mobile-first:** todo colapsa a una columna < 768px; sin scroll horizontal jamás.
- En escritorio, las tarjetas fluyen en una **grilla responsiva** que se autoajusta por ancho (`grid` con `auto-fill`/`minmax`, p. ej. `repeat(auto-fill, minmax(360px, 1fr))`, o `1fr 1fr` en detalle), colapsando a una columna en móvil. **No se usa masonry real** (`grid-template-rows: masonry` es experimental y `columns` rompe el orden de lectura/tabulación): se prioriza la accesibilidad por teclado y el orden del DOM. <!-- Si en el futuro se quisiera el efecto visual masonry en alguna pantalla puntual de tarjetas muy desiguales, se evaluaría una solución JS que preserve el orden del DOM; no implementado. -->
- Toolbars **limpias de superficie** (no barras de color sólido); el acento es detalle, no fondo de barra. Header con hairline inferior.
- Tap targets mínimo 44px. Full-height con `min-h-[100dvh]`, nunca `h-screen`.

## 6. Motion & Interaction
- Easing físico real: `cubic-bezier(0.32, 0.72, 0, 1)` (sin linear).
- Presión táctil en tarjetas y botones (`scale` sutil); revelado en cascada de listas.
- Animar solo `transform` y `opacity`. Respetar `prefers-reduced-motion`.
- Micro-loops sobrios (shimmer en carga, pulso suave en "requiere aprobación").

## 7. Anti-Patterns (Banned)
- Sin `Inter` ni serifs en UI.
- Sin negro puro (#000000) — usar #0A0A0A.
- Sin glows/neón, sin acentos sobresaturados, sin gradientes en botones.
- Sin tres tarjetas iguales en fila como "feature row" — usar grilla asimétrica o scroll horizontal.
- Sin elementos superpuestos: cada uno en su zona espacial limpia.
- Sin textos de relleno ("Scroll", flechas que rebotan), sin cursores custom.
- Sin nombres genéricos ("John Doe", "Acme") ni números redondos falsos — usar datos ticos reales (Honda CB190R, placa MOT-123, ₡75.000, Juan Pérez).
- Sin imágenes rotas — usar avatares SVG o `picsum.photos`.

## Apéndice — Pantallas existentes (para mantener coherencia al generar nuevas)
App del **personal**: Login (negro, tarjeta marco de teléfono, logo llave+martillo
cruzados en carmesí), Dashboard gerencial (stat-cards + semáforo en píldoras + KPIs +
facturación + tiempo por etapa), Lista de órdenes (cards con barra de estado lateral),
Detalle de OT (estado, costos mono, repuestos en pills, timeline, checklist, facturación,
evidencia, garantía, WhatsApp), Garantías, Promociones, Factura imprimible.
**Portal del cliente**: Mis órdenes (fidelidad en tarjeta negra con bloques + ofertas en
carrusel con degradado + órdenes con barra lateral), Detalle (presupuesto para aprobar
con borde índigo + seguimiento + encuesta de estrellas), Citas.
Estados de OT (con color de badge): recepción → diagnóstico → esperando aprobación →
esperando repuestos → en reparación → lista para entrega → entregada (o cancelada).
