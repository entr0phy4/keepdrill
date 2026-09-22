# Migración UI → @fluid (shadcn)

## Estructura de carpetas

```
src/
  app/                 # shell: App, providers, ErrorBoundary
  features/
    corpus/            # paste / upload
    repo-browser/      # import GitHub + árbol
    typing/            # CaptureSurface, FileScaffold, results
    history/           # sesiones persistidas
    insights/          # analytics (nombre para no chocar con src/analytics)
    status/            # banners de layout / timing
  shared/
    components/        # wrappers dumb (AppShell, KeyChip, NativeSelect…)
    hooks/
  components/ui/       # primitivos instalados desde @fluid
  lib/                 # tokens/contextos Fluid
```

Cada feature exporta un `index.ts`. Los contenedores (smart) viven en la raíz del feature; las vistas sin lógica, en `components/`; la lógica repetida, en `hooks/`.

## Componentes migrados

| Superficie | Primitivo @fluid | Notas |
| --- | --- | --- |
| Nav Trainer / History / Analytics | `Sidebar` inset + `SidebarMenuButton` + `NavLink` | rutas `/`, `/history`, `/analytics`; peek desactivado; `aria-current="page"` |
| Árbol del repo importado | `RepoTree` en el sidebar, bajo Practice | el formulario GitHub se queda en el panel; el árbol comparte el `RepoBrowserProvider` |
| Panel de contenido | `ScrollArea` Base UI + `scroll-fade` | Motion (`spring`), Sizes (`SizeProvider`) y Surfaces (`SurfaceProvider` / `Elevated`) instalados |
| Tabs Paste \| GitHub | `Button` role=tab | Ver pendientes: TabsSubtle |
| Load / Import / Restart | `Button` primary | `loading` mientras busy |
| Dismiss save-failed | `Button` ghost icon | clase `.save-failed-dismiss` para tests |
| Unidad actual del scaffold | `Card` | `data-scaffold-current` intacto |
| Tablas de digrafos / lenguaje | `Table` + `KeyChip` | clase `.analytics-table` para tests |

## Wrappers personalizados (sin equivalente directo)

| Wrapper | Por qué no hay equivalente @fluid |
| --- | --- |
| `CaptureSurface` / `.trainer-stack` | Overlay transparente + caret in-flow; métricas de fuente deben coincidir |
| `KeyboardHeatmap` | Diagrama US-ANSI con `--kb-fill`; no hay teclado en el registry |
| `FileScaffold` + `RepoTree` | Árbol nativo `<details>` (iconos Lucide, fila compacta, `aria-current`); Accordion cambiaría los tests y el markup |
| `TextareaField` | `@fluid/input-message` es un composer de chat, no un paste de corpus |
| `NativeSelect` | `@fluid/select` es un combobox popup; D-14 exige `<select>` nativo siempre habilitado |
| `Banners` / `SaveFailedNotice` | No hay Alert; se reutilizan `.banner` / `.banner--warning` |
| `KeyChip` | No hay `kbd`; tests y history dependen de `.key-chip` |
| `CorpusSourceTabs` | `TabsSubtlePanel` desmonta el panel inactivo; Paste y GitHub deben quedarse montados (`display:none`) |

`@fluid/select`, `@fluid/accordion`, `@fluid/tabs-subtle` y `@fluid/input-group` quedan instalados para uso futuro, no cableados al loop actual.

## Decisiones / breaking changes

- Tokens shadcn/Fluid (`--background`, `--primary`, `--destructive`, `--border`) apuntan a la paleta keebdrill. Chrome usa Geist (self-hosted, compatible con COEP); el trainer sigue en `--font-mono`.
- Botones globales de 44px se eliminaron para no pisar la escala Fluid (36px). Acciones nativas (`.control`, árbol del repo) conservan sus hit targets.
- History y Analytics se cargan con `React.lazy` (chunks `history-*.js` / `insights-*.js`) en las rutas `/history` y `/analytics`. El trainer **no** se desmonta al cambiar de ruta (D-08); se oculta con `display`.
- El chrome usa `Sidebar` de @fluid (`variant="inset"`). El peek hover está desactivado para no tapar el trigger; el atajo `[` no captura teclas dentro de `textarea`/`input`.
- `src/ui/` desaparece. Imports: `@/features/...`, `@/app`, `@/shared/components`.
- Card de Fluid importaba `next/link`; en este repo Vite se sustituyó por `<a>`.

## Checklist de verificación

- [x] `pnpm typecheck` — sin errores
- [x] `pnpm test` — 397 tests
- [x] `pnpm build` — OK; code-split de history/insights
- [x] IDs de tests conservados (`#corpus-paste`, `#capture-surface`, `#github-url`, tabs)
- [x] Hide-not-unmount del trainer (`style.display`)
- [ ] Contraste / teclado en Chromium (UAT humano; happy-dom no tiene layout)
