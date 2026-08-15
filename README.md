# CiMS Organizational Neighborhood

An interactive, procedural Three.js view of the CiMS organizational context. The same entities are always available through a semantic HTML navigator and detail card, including when WebGL is unavailable.

## Run locally

Requirements: Node.js 24.x and pnpm 11.x.

```powershell
pnpm install
pnpm dev --host 127.0.0.1
```

Open the URL printed by Vite. To exercise the production output:

```powershell
pnpm build
pnpm exec vite preview --host 127.0.0.1
```

## Verification

Install the pinned Playwright Chromium runtime once:

```powershell
pnpm exec playwright install chromium
```

Run the complete acceptance matrix:

```powershell
pnpm test:run
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

The browser suite runs Chromium against `pnpm dev --host 127.0.0.1 --port 4173`. It covers keyboard selection and Escape, touch selection at an emulated 390 × 844 viewport, reduced motion, WebGL failure, DPR caps, horizontal overflow, console/page errors, and desktop/tablet/mobile/grayscale screenshots. Generated evidence is written below `test-results/` and is intentionally ignored.

Run the production-preview performance capture after building:

```powershell
$env:PERF_ACCEPTANCE = '1'
pnpm exec playwright test --grep '@performance'
Remove-Item Env:PERF_ACCEPTANCE
```

This performs a 10-second overview RAF sample, a 10-second repeated camera-transition sample, and an independent one-second idle-RAF assertion.

## Controls

- Choose any organization or research group from the Organization navigator. Use `Tab` to focus buttons and `Enter` or `Space` to activate them.
- Select a visible building label with mouse or touch. Selection synchronizes the navigator, label, detail card, visual treatment, and camera.
- Press `Escape` or activate **Overview** to return to the complete neighborhood.
- Drag the 3D view to orbit and use the wheel or pinch to zoom. Panning is disabled; camera distance, polar angle, and azimuth are constrained.
- Activate **Reduce motion** to remove guided camera travel and reduce scene detail/shadows. The operating-system reduced-motion preference is honored on load.
- If WebGL creation fails, use the navigator and cards; an alert explains that the 3D view is unavailable.

## Architecture

- `src/application/state.ts` owns the canonical `NeighborhoodState` reducer, selectors, and action types. `urlState.ts` provides the History API adapter and stable URL serialization. `mediaPreferences.ts` subscribes to live `prefers-reduced-motion` and `pointer` changes.
- `src/data/` owns typed entity content, relationship semantics, containment hierarchy, and validation.
- `src/scene/atlasLayout.ts` defines district extents, local/world position conversion, and scope bounds. `layout.ts` owns deterministic positions, footprints, and focus targets. `buildings.ts`, `routes.ts`, and `campus.ts` assemble procedural geometry under named semantic district groups.
- `src/scene/materials.ts` provides the shared texture-free PBR palette with land, clearing, district accent, and route state roles. `lighting.ts` owns the daylight rig with one shadow-casting sun and lower hemisphere fill. `texturePolicy.ts` is the guarded seam for future texture use.
- `src/scene/runtime.ts` owns renderer/camera creation, DPR clamping, resize, disposal, and request-driven rendering. It does not run a default perpetual animation loop.
- `src/scene/relationshipAppearance.ts` handles incident route emphasis and unrelated visual recession. `selectionAppearance.ts` manages selection edge/marker cues.
- `src/navigation/cameraController.ts` owns overview/local/context camera states, interruption-safe free-explore limits, and reduced-motion behavior. `cameraFraming.ts` provides UI-aware perspective framing with safe-rectangle insets. `src/interaction/selectionController.ts` owns raycast selection with fine/coarse pointer thresholds and multi-pointer cancellation.
- `src/ui/appShell.ts` and `src/ui/labels.ts` provide the accessible semantic shell, categorized navigator, collapsible detail panel/sheet, fallback, and scope-aware projected labels. `presentation.ts` owns category labels, breadcrumbs, route legend copy, and view-model selectors.
- `src/performance/quality.ts` separates `selectGraphicsQuality` (viewport/DPR/pointer-driven) from `selectMotionPolicy` (reduced-motion preference). `src/main.ts` composes all modules through injectable factories, wires the reducer, history adapter, media subscription, and unwinds partial initialization safely.

## Visual and content limits

The neighborhood is a communication metaphor, not a map, legal organigram, reporting hierarchy, or statement of physical co-location. Only the typed relationship routes should be interpreted as coordination, adjacency, or collaboration. Building size, route length, and spatial proximity are visual devices except for the deliberately equal visual weight of the five research groups.

All current buildings, motifs, furniture, routes, and the SEi boundary are procedural. They are intentionally lightweight and recognizable rather than architectural replicas. The scene uses no default image textures, HDR environment, GLB model, or post-processing pass.

Institutional copy is working content and requires owner approval before public release. In particular, names, leaders, descriptions, examples, and the exact long name/remit of the **New ZeMA pillar** must be confirmed against approved CiMS/SEi sources. The positioning study in the parent workspace is explicitly marked “NOT APPROVED YET” and is not a publication approval source.

## Future GLB seam

`src/scene/assetResolver.ts` accepts an async replacement `Object3D`, validates it, names it, and falls back to the procedural object with a warning. A future GLB loader should be injected through that seam and preserve each entity root's selection proxy, label anchor, focus anchor, stable entity ID, disposal ownership, and procedural fallback. Do not bypass `createCampus` relationship/layout assembly when replacing a visual.

## Measured baseline and limitations

Task 16 was measured on 13 August 2026 on Windows 10.0.26200 x64, a 13th Gen Intel Core i7-1355U (12 logical processors), Node 24.19.0, and pnpm 11.19.0. Browser acceptance used headless Chromium 149.0.7827.55 under Playwright 1.61.1. Tablet and screenshot evidence use viewport emulation; dedicated mobile interaction/fallback tests additionally enable touch emulation. None is physical-device testing.

The production build emitted 600.15 kB JavaScript (153.19 kB gzip), 4.72 kB CSS (1.62 kB gzip), and a 0.41 kB HTML entry (0.28 kB gzip). Vite warns because the single JavaScript chunk exceeds 500 kB. The local preview's document load event completed at 84.2 ms; this loopback timing is not a deployment-network measurement. No code-splitting churn was introduced: the compressed payload is primarily the intentionally synchronous Three.js experience, and current evidence did not establish a startup failure or load-time budget. Revisit dynamic Three.js composition when deployment-network measurements or product requirements establish one.

Headless software-rendering results use ANGLE/SwiftShader and are not a physical GPU benchmark. The recorded production baseline is approximately 60.10 sampled RAF/s in a static overview with no >34 ms sample, and 20.33 sampled RAF/s during repeated overlapping camera transitions (p95 83.3 ms, maximum 116.6 ms). The runtime scheduled zero callbacks during a separate one-second settled idle window. Physical mobile hardware, thermal throttling, assistive technologies beyond automated semantics, and production-network latency remain release checks.
