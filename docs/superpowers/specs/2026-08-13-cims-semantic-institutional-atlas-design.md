# CiMS Semantic Institutional Atlas Design

**Status:** Approved direction, pending written-spec review  
**Date:** 2026-08-13  
**Product:** CiMS organizational neighborhood  
**Stack:** Vite, TypeScript, imperative Three.js, semantic DOM UI

## 1. Purpose

Transform the existing single-campus visualization into a semantic institutional atlas that communicates the intended organizational hierarchy without requiring users to infer it from a sidebar.

The visual model is:

```text
SEi land
|-- CiMS city
|   |-- CiMS hub
|   |-- Elastocalorics
|   |-- Electroactive Polymers
|   |-- Smart Material Electronics
|   |-- Smart Textiles
|   `-- Shape-Memory Alloys
|-- New ZeMA district
|-- HyCATT district
|-- UdS campus
`-- htw saar campus
```

SEi is the containing land, not a peer building. CiMS is the most detailed city inside that land. New ZeMA and HyCATT are visually distinct but simplified internal districts. UdS and htw saar are smaller partner campuses positioned as satellites while preserving their semantic relationships.

## 2. Goals

- Make containment and organizational scale legible in the initial overview.
- Preserve the distinctive interactive Three.js experience.
- Preserve semantic navigation, entity content, keyboard access, and the WebGL-independent fallback.
- Support a progressive flow from SEi overview to city scope to entity focus.
- Reduce label and panel obstruction so the map is the primary explanation.
- Provide equivalent mouse, touch, and keyboard interaction semantics.
- Preserve request-driven idle rendering and establish measurable interaction budgets.
- Keep the architecture framework-neutral so a React UI shell remains an optional later decision.

## 3. Non-goals

- No React, React Three Fiber, Next.js, backend, authentication, database, or CMS migration.
- No photorealistic campus replicas or generic city GLBs.
- No global bloom, depth of field, film grain, chromatic aberration, or heavy vignette.
- No attempt to present a legal reporting hierarchy or literal physical map.
- No unapproved expansion of institutional copy.
- No requirement for every entity label to remain visible at every zoom level.

## 4. Visual composition

### 4.1 SEi land

Replace the single oval cylinder with an irregular green landform. The silhouette must read as one containing territory at overview scale. Use restrained elevation variation and a darker edge or rim to separate it from the background.

Campus regions are lighter clearings embedded in the land. Their boundaries use shape and value, not color alone. CiMS occupies no more than approximately 40% of the visible land area.

### 4.2 District hierarchy

- **CiMS:** largest clearing and highest geometric detail. It contains the existing hub and five equal-weight research buildings.
- **New ZeMA:** simplified clustered district with one distinctive landmark silhouette.
- **HyCATT:** simplified clustered district with a silhouette distinct from New ZeMA.
- **UdS:** small satellite campus with restrained detail.
- **htw saar:** small satellite campus with restrained detail.

The scene graph mirrors the semantic hierarchy: land root, district groups, then district entities. Cross-district coordination, adjacency, and collaboration remain semantic edges rather than containment.

### 4.3 Materials and lighting

Retain `MeshStandardMaterial`, sRGB output, ACES tone mapping, one directional sun, and a hemisphere fill. Rebalance the palette toward warmer land, lighter clearings, stronger building silhouettes, and clearer route contrast. Reduce fill intensity enough to restore directional form.

Small motifs, routes, and distant context objects do not cast shadows by default. Desktop shadows remain at or below 2048 square; mobile shadows remain at or below 1024 square. The shadow frustum covers the visible active scope rather than the entire theoretical world.

Post-processing is optional and may be introduced only after hierarchy is clear. Any ambient-occlusion or contact-shadow treatment must be subtle, desktop-only where necessary, and lower resolution than the main render.

## 5. Information architecture and responsive UI

### 5.1 Desktop

Use a compact atlas shell rather than three permanently dominant panels:

- A compact explorer opens from the upper-left and supports categorized navigation.
- A small breadcrumb identifies the current scope: `SEi / CiMS / Entity`.
- A visible Overview or Back control returns one semantic level.
- The detail panel opens only after selection and occupies no more than 25% of the viewport.
- The route legend remains reachable but collapsible.
- A concise first-use hint teaches selection, orbit, zoom, and reset.

### 5.2 Mobile and tablet

- Replace the horizontal all-entity carousel with a categorized menu or search-driven explorer.
- Present entity details in a collapsible bottom sheet.
- Keep the map visible while the sheet is collapsed.
- Respect all safe-area insets.
- Avoid simultaneous unbounded horizontal navigation, vertical card scrolling, and canvas gesture capture.
- Keep the legend reachable from the explorer or detail sheet.

### 5.3 Typography and elevation

Use a restrained institutional type system with a legible sans-serif body and an optional editorial serif only if it can be delivered as optimized WOFF2 assets. If no approved font assets are available, use the system stack rather than fetching an external font.

- Body text: at least 16 px.
- Secondary UI and labels: at least 14 px.
- Heading line height: approximately 1.1-1.2.
- Body line height: 1.5-1.6.
- Headings use balanced wrapping; descriptions use pretty wrapping.
- Panels use a small, neutral layered shadow and a visible border; projected labels use quieter elevation than panels.

## 6. Labels and semantic zoom

Labels are accessible DOM buttons anchored to Three.js objects.

- SEi overview shows at most 5-6 district-level labels.
- Entering CiMS reveals the hub and research-group labels.
- The selected entity label always remains available.
- Lower-priority labels appear through focus, selection, or sufficient zoom.
- Label placement reserves UI safe rectangles and viewport margins.
- Labels avoid other labels and the primary silhouette of their target where practical.
- Occluded or displaced labels may use a restrained leader line.
- Label sizes are cached until text, font metrics, or viewport class changes; camera frames do not synchronously remeasure every label.

## 7. Interaction model

The canonical application state separates semantic selection from camera mechanics:

```text
scope: sei | cims | district-id
selection: none | entity-id
preview: none | entity-id
view: overview | guiding | focused | free-explore
relations: all | incident-entity-id | relationship-kind
motion: full | reduced
quality: desktop | mobile | constrained
status: loading | ready | failed
```

### 7.1 Preview

Hover or keyboard focus previews an entity without moving the camera. Preview increases building/label contrast and reveals incident routes. It is reversible and must not alter URL history.

### 7.2 Selection

Click, tap, Enter, or Space commits selection. Navigator, label, detail panel, 3D cue, route emphasis, URL, and camera intent update from the same state event.

Incident routes brighten; unrelated routes and buildings recede without disappearing completely. Connection entries in the detail panel are actionable and focus the related entity.

### 7.3 Scope navigation

Selecting CiMS from the SEi overview enters the CiMS scope. Breadcrumbs and browser history represent the scope. Back or Escape returns one semantic level; Overview returns to the SEi overview.

### 7.4 Camera behavior

- Camera destinations are calculated from object or scope bounds and the unobstructed viewport rectangle.
- Resize, orientation, or panel geometry changes re-fit the current semantic target.
- Guided travel is interruptible and approximately 300-450 ms.
- Manual input during travel cancels into `free-explore` without applying abandoned destination limits.
- Reduced motion applies the destination immediately.
- Orbit damping receives a short-lived settling render reason and returns to zero idle RAF callbacks.
- Empty-map taps clear preview only; committed selection is cleared through Back, Escape, or Overview.

### 7.5 Touch and canvas semantics

- Selection proxies derive from visual or layout bounds rather than one universal box.
- Coarse-pointer tap tolerance and proxy expansion differ from fine-pointer behavior.
- Two-pointer gestures cancel tap selection.
- The canvas receives an explicit accessible treatment: a concise accessible description if exposed, or `aria-hidden="true"` when the semantic explorer is identified as its equivalent.
- Visible UI controls provide alternatives to gesture-only reset and navigation.

## 8. Architecture

### 8.1 Domain graph

Extend the current entity model with validated scope and containment metadata. The graph enforces:

- one SEi root;
- no containment cycles;
- at most one containment parent per entity;
- stable slugs;
- valid layout membership per scope;
- valid relationship targets and symmetry rules.

Containment drives hierarchy and navigation. Coordination, adjacency, and collaboration remain relationship edges.

### 8.2 Application state

Add a small pure reducer/store. Three.js, the semantic UI, projected labels, URL history, and media preferences subscribe through typed adapters. Do not introduce Redux or a frontend framework.

### 8.3 Scene scopes

Only the active scope plus lightweight neighboring context must be fully active. Scope construction and disposal remain deterministic. The current procedural visuals remain the default and fallback.

### 8.4 Asset contract

Any future GLB or texture-backed visual must provide:

- render root;
- calculated bounds;
- label and focus anchors;
- selection proxy policy;
- loading and procedural fallback behavior;
- owned GPU resources and disposal;
- cancellation and stale-result handling.

Optional asset loaders and post-processing code load dynamically after semantic navigation and the procedural overview are usable.

## 9. Loading, failure, and URL behavior

- The semantic shell is usable immediately.
- The status model is `loading | ready | failed` and announces meaningful changes politely.
- WebGL failure retains the semantic navigator and detail content and exposes a Retry action.
- Diagnostic details are logged with initialization-stage context but are not exposed verbatim to users.
- Scope and selected entity are encoded in stable URL state.
- Browser Back and Forward restore the corresponding semantic view and selection.
- Optional asset failure never removes semantic content or the procedural fallback.

## 10. Accessibility requirements

- WCAG AA contrast: 4.5:1 for normal text; 3:1 for important graphical boundaries and large text.
- Relationships are distinguished through pattern and text, not color alone.
- All interactive controls use semantic elements and visible focus indicators.
- Touch targets are at least 44 by 44 CSS pixels with at least 8 px separation where adjacent.
- Keyboard order follows the visible information hierarchy.
- The detail region announces selection changes without stealing focus.
- Reduced motion responds to live operating-system preference changes.
- Layout remains operable at 200% zoom, forced colors, increased contrast, phone portrait, and phone landscape.
- Full-bleed controls respect safe-area insets.

## 11. Performance and delivery constraints

- Settled idle schedules zero continuous animation frames.
- Physical mid-tier mobile interaction target: p95 frame time below 33 ms and no interaction frame above 100 ms.
- Agreed desktop reference target: p95 frame time below 22 ms during authored travel.
- Selection feedback begins within 100 ms.
- Initial JavaScript gzip size must not grow beyond the current documented 153.19 kB baseline without an approved measured reason; optional rendering features load separately.
- Texture memory remains within the existing mobile 48 MiB budget.
- Asset loading is abortable, bounded, cached deliberately, and tested under failure.

## 12. Testing and acceptance

Implementation follows test-driven development. Required coverage includes:

- domain hierarchy and cycle validation;
- reducer transitions for scope, preview, selection, relations, motion, loading, and history;
- camera fitting against UI safe rectangles;
- interruption continuity followed by an OrbitControls-equivalent update;
- live reduced-motion preference changes;
- progressive label visibility, UI exclusion rectangles, cached measurement, and selected-label retention;
- mouse, keyboard, coarse-pointer tap, drag cancellation, and two-pointer gesture behavior;
- relationship highlighting and traversal;
- loading, retry, fallback, late asset completion, cancellation, and disposal;
- URL deep links and Back/Forward restoration;
- desktop, tablet, phone portrait, and phone landscape layouts;
- automated serious/critical accessibility violations;
- production-preview smoke checks and explicit performance gates.

The redesign is accepted when an unbriefed viewer can identify one SEi land containing CiMS, New ZeMA, HyCATT, UdS, and htw saar from the overview, and can then enter CiMS to discover its hub and five equal-weight research groups without the scene being obscured by labels or permanent panels.

## 13. Delivery sequence

1. Correct camera interruption and establish camera-fit/safe-rectangle primitives.
2. Add the canonical state model, URL adapter, and live media preferences.
3. Add the scope-aware domain graph and validations while preserving current behavior through adapters.
4. Build the SEi land and distinct district composition with procedural visuals.
5. Add semantic zoom, progressive labels, and incident-route emphasis.
6. Replace the shell with the responsive explorer, breadcrumb, collapsible detail panel/sheet, legend, loading, and retry states.
7. Rebalance materials, lighting, shadows, and quality policy.
8. Add optional assets or restrained post-processing only if performance and hierarchy acceptance remain green.
9. Complete accessibility, production, physical-device, and comprehension validation.

