---
phase: 04-session-persistence-history
plan: 02
subsystem: ui
tags: [history-view, dexie, react, relative-time, css]

requires:
  - phase: 04-session-persistence-history
    plan: 01
    provides: "persistence/ seam (saveSession/listNewestFirst), StoredSession shape, minimal HistoryView, App.tsx view toggle + hide-not-unmount wrapper"
provides:
  - "relativeTime(startedAt, now?) — helper de tiempo relativo sin dependencia nueva"
  - "resolveMetrics(s) — guardia de recompute-if-stale (D-05), dormant hasta Fase 5"
  - "HistoryRow con las siete columnas D-11/D-12: fecha relativa+absoluta, wpm, accuracy, source label, idioma, longitud en code points, chip de tecla más lenta"
  - "Estilos .history-list/.history-row/.history-row-primary/.history-row-meta/.history-empty/.history-loading + estado activo del toggle vía [aria-current=page]"
  - "Endurecimiento y test de regresión del contrato D-08 hide-not-unmount"
affects: [05-symbol-adjusted-wpm, 06-cross-session-analytics]

tech-stack:
  added: []
  patterns:
    - "resolveMetrics vive en ui/, nunca en persistence/ — mantiene repository.ts como wrapper delgado de Dexie (D-03)"
    - "now del recompute viene siempre de completedAtTMs (dominio event.timeStamp), nunca de startedAt (reloj de pared) — RESEARCH Pitfall 2"
    - "El toggle de vista activo se distingue por relleno de superficie + peso 600, nunca por --color-accent (04-UI-SPEC.md)"

key-files:
  created:
    - src/ui/relative-time.ts
    - src/ui/relative-time.test.ts
    - src/ui/history-metrics.ts
    - src/ui/history-metrics.test.ts
    - src/ui/HistoryView.test.tsx
  modified:
    - src/ui/HistoryView.tsx
    - src/ui/App.tsx
    - src/ui/App.test.tsx
    - src/index.css

key-decisions:
  - "relativeTime usa un único Intl.RelativeTimeFormat a nivel de módulo y una escalera de unidades descendente (año→segundo); por debajo de 1000ms cae al tramo 'second', que Intl.RelativeTimeFormat renderiza como 'now' para diff redondeado a 0 — sin dependencia nueva (discreción de RESEARCH)"
  - "El chip de idioma reutiliza .key-chip con background: var(--color-bg) (no --color-surface) para mantenerse legible sobre la card .history-row — regla explícita de 04-UI-SPEC.md Color"
  - "El label de unidad 'wpm' en HistoryRow reutiliza las clases results-stat-label + text-muted en vez de introducir una regla CSS nueva — .results-stat-label no tenía su propia regla previa, text-muted ya la resuelve"

requirements-completed: [PERS-02]

coverage:
  - id: D1
    description: "Una fila de historial completamente poblada muestra las siete columnas D-11/D-12 derivadas end-to-end vía resolveMetrics/relativeTime/glyphFor; slowest5 vacío omite el chip sin afectar el resto; un carácter más lento de espacio renderiza '·'"
    requirement: "PERS-02"
    verification:
      - kind: unit
        ref: "src/ui/HistoryView.test.tsx — fully-populated row, slowest5 vacío, glyph de espacio, orden newest-first con tiebreak por id"
        status: pass
      - kind: unit
        ref: "src/ui/relative-time.test.ts — tabla dorada de la escalera de unidades, caso futuro, caso 'now'"
        status: pass
      - kind: unit
        ref: "src/ui/history-metrics.test.ts — referencia idéntica en el camino feliz; argumentos de recompute (completedAtTMs) en el camino stale"
        status: pass
    human_judgment: false
  - id: D2
    description: "La lista de historial y el toggle de header cumplen 04-UI-SPEC: cards con borde en superficie secundaria, sin color de acento en el toggle activo, sin coloreado por umbral de rendimiento"
    requirement: "PERS-02"
    verification:
      - kind: automated_ui
        ref: "src/ui/App.test.tsx — invariante de un solo toggle activo (aria-current='page') across setView"
        status: pass
      - kind: visual
        ref: "src/index.css — .history-* + selector [aria-current='page'] / :not([aria-current='page'])"
        status: pass
    human_judgment: true
    rationale: "Verificación visual completa en Chromium (colores reales, sin verde/rojo en wpm/accuracy) diferida al lote human-verify de fin de fase (workflow.human_verify_mode=end-of-phase)"
  - id: D3
    description: "Cambiar a History a mitad de ejercicio y volver preserva el estado de captura en progreso (D-08): mismo charLog, mismos estados por carácter, misma identidad del nodo textarea, misma posición del caret"
    verification:
      - kind: automated_ui
        ref: "src/ui/App.test.tsx — 'typing, switching to History, then back to Trainer preserves...'"
        status: pass
    human_judgment: true
    rationale: "happy-dom no tiene motor de layout y no puede verificar selección/IME real sobre un textarea no controlado tras un toggle display:none real (RESEARCH Open Question 1 / Assumption A1) — diferido al lote human-verify de fin de fase; el código documenta el fallback (ref-based capture buffer) si el check en Chromium falla"

duration: ~35min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan 2: History View Full Fidelity Summary

**`HistoryRow` expandido a las siete columnas D-11/D-12 (fecha relativa, wpm, accuracy, source, idioma, longitud, tecla más lenta) vía `resolveMetrics`/`relativeTime`/`glyphFor`, estilado según 04-UI-SPEC sin nuevos tokens, con el contrato D-08 hide-not-unmount endurecido y verificado en happy-dom.**

## Performance

- **Duración:** ~35 min
- **Tareas:** 3 (todas `type="auto"`, sin checkpoints bloqueantes)
- **Archivos modificados:** 10 (5 creados, 5 modificados)

## Accomplishments

- `src/ui/relative-time.ts` — `relativeTime(startedAt, now?)`, un único `Intl.RelativeTimeFormat` a nivel de módulo + escalera de unidades descendente; sin dependencia nueva.
- `src/ui/history-metrics.ts` — `resolveMetrics(s)`: devuelve `s.metricsSnapshot` por referencia exacta cuando `schemaVersion` coincide; en Fase 4 (`METRICS_SCHEMA_VERSION === 1`) siempre toma esta rama — el recompute vía `computeSessionMetrics(..., s.completedAtTMs)` queda dormant hasta la Fase 5 (D-05).
- `src/ui/HistoryView.tsx` reescrito con un sub-componente `HistoryRow`: fecha relativa (con `title` absoluto), wpm/accuracy redondeados solo en el render, source label nunca vacío, chip de idioma, longitud en code points (`Array.from(text).length`), y chip de tecla más lenta (omitido, no placeholder, cuando `slowest5` está vacío) — reutiliza `glyphFor` de `trainer/state.ts`.
- `src/index.css`: `.history-list/.history-row/.history-row-primary/.history-row-meta/.history-empty/.history-loading` (cards con borde en superficie secundaria, mismo tratamiento que `.preview`/`.results-panel`) + estado activo del toggle vía `[aria-current="page"]` (relleno de superficie + peso 600, sin `--color-accent`).
- `src/ui/App.tsx`: comentario junto al toggle documentando la suposición residual D-08 y su fallback (ref-based capture buffer + trainer unmount) si el check real en Chromium falla.
- Suite de tests: `relative-time.test.ts`, `history-metrics.test.ts` (incluye un caso con `vi.mock` verificando los argumentos exactos del recompute), `HistoryView.test.tsx` (fila completa, `slowest5` vacío, glyph de espacio, orden newest-first con tiebreak por `id`, estados loading/empty distintos), y dos bloques nuevos en `App.test.tsx` (invariante de un solo toggle activo; regresión D-08 completa: tipear con una corrección, cambiar a History, volver a Trainer, y verificar `charLog`/estados por carácter/identidad del nodo `textarea`/posición del caret sin cambios).

## Task Commits

1. **Task 1: fila de historial completamente poblada end-to-end** — `3c33fa4` (feat)
2. **Task 2: estilos de lista de historial + toggle de vista (04-UI-SPEC)** — `a2bbd27` (style)
3. **Task 3: endurecimiento y verificación del contrato D-08 hide-not-unmount** — `de90b83` (test)

## Files Created/Modified

- `src/ui/relative-time.ts` + `.test.ts` — helper de tiempo relativo
- `src/ui/history-metrics.ts` + `.test.ts` — guardia de recompute-if-stale
- `src/ui/HistoryView.tsx` (reescrito) + `.test.tsx` (nuevo) — fila completa D-11/D-12
- `src/ui/App.tsx` — comentario D-08 ampliado (sin cambio de comportamiento)
- `src/ui/App.test.tsx` — invariante de un solo toggle activo + regresión D-08
- `src/index.css` — estilos `.history-*` + estado activo del toggle

## Decisions Made

- `relativeTime`: escalera de unidades descendente con un solo `Intl.RelativeTimeFormat` reutilizado; por debajo de 1000ms cae al tramo `'second'`, que produce el string clase-"just now" (`Intl` renderiza "now" para diff 0) sin necesitar una rama especial.
- El chip de idioma dentro de `.history-row` fija `background: var(--color-bg)` (no `--color-surface`) para mantener contraste sobre la card — regla explícita de 04-UI-SPEC.md, no un token nuevo.
- La etiqueta muda "wpm" reutiliza `results-stat-label text-muted` en vez de crear una regla CSS específica para History — `text-muted` ya resuelve el color mudo requerido.

## Deviations from Plan

Ninguna — el plan se ejecutó tal como estaba escrito. El código de `App.tsx` para D-08 (toggle de `display`, `CaptureSurface` sin desmontar, sin `resetCapture`/bump de `loadToken` desde `setView`) ya estaba correctamente implementado desde el plan 04-01; esta tarea solo añadió el comentario de la suposición residual + el test de regresión, sin tocar la lógica.

## Issues Encountered

Ninguno.

## Known Stubs

Ninguno — `HistoryRow` renderiza las siete columnas D-11/D-12 con datos reales; no hay campos con placeholder ni fuentes de datos mockeadas.

## Threat Flags

Ninguno. Superficie de amenaza sin cambios respecto al `<threat_model>` del plan (T-04-01/T-04-04/T-04-06/T-04-02): `exercise.text`/`.language`/`.sourceRef` se renderizan solo como nodos de texto React (sin `dangerouslySetInnerHTML`); `m.slowest5[0]` se lee bajo la guardia `noUncheckedIndexedAccess`; el `<ol>` no está virtualizado (decisión D-18 aceptada, sin cambios).

## Human Verification Pendiente (lote de fin de fase, workflow.human_verify_mode=end-of-phase)

Ambos ítems `<human-check>` del plan quedan diferidos al lote de verificación humana de fin de fase, según la configuración del proyecto — no bloquean esta ejecución:

1. **Task 2 — Chequeo visual de History en Chromium**: correr `pnpm dev`, completar dos ejercicios cortos, abrir History y confirmar visualmente: cards con borde, orden newest-first, los siete campos por fila, el toggle activo con relleno de superficie + negrita (NO verde/acento), ningún valor de wpm/accuracy coloreado, y el estado vacío con el copy correcto bajo el `<h2>History</h2>` siempre presente.
2. **Task 3 — Preservación de caret/IME en Chromium**: tipear ~10 caracteres con al menos una corrección, cambiar a History, volver a Trainer, y confirmar visualmente que el caret queda en la misma posición exacta, el coloreado por carácter es idéntico, el clic en la superficie recupera el foco, y una composición IME iniciada antes del cambio se resuelve correctamente después. Si algo de esto falla, el fallback documentado (código + este SUMMARY) es levantar el buffer de captura a un `ref` que sobreviva un remount de `CaptureSurface` y permitir que el trainer se desmonte.

## User Setup Required

Ninguno.

## Next Phase Readiness

- PERS-02 queda satisfecho a nivel automatizado; la Fase 4 completa sus tres requisitos (PERS-01, PERS-02, PERS-03) en 04-01 + 04-02.
- Los dos `<human-check>` pendientes (arriba) deben ejecutarse en el lote human-verify de fin de fase antes de cerrar la Fase 4 formalmente.
- La Fase 5 puede apoyarse en `resolveMetrics`/`METRICS_SCHEMA_VERSION` sin cambios adicionales — su bump de versión activará automáticamente la rama de recompute ya cableada aquí (dormant hasta ahora).

---
*Phase: 04-session-persistence-history*
*Completed: 2026-09-08*

## Self-Check: PASSED

Todos los archivos creados verificados presentes en disco (`src/ui/relative-time.ts`, `src/ui/relative-time.test.ts`, `src/ui/history-metrics.ts`, `src/ui/history-metrics.test.ts`, `src/ui/HistoryView.test.tsx`, este SUMMARY.md); los tres hashes de commit de tareas (`3c33fa4`, `a2bbd27`, `de90b83`) verificados presentes en `git log --oneline --all`.
