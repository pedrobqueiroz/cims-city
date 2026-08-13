# CiMS Semantic Institutional Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat single-campus visualization with an accessible, scope-aware SEi atlas containing distinct CiMS, New ZeMA, HyCATT, UdS, and htw regions, with progressive CiMS detail and reliable camera, label, relationship, and responsive UI behavior.

**Architecture:** Keep the existing imperative Three.js runtime and semantic DOM fallback. Add a validated containment graph and a small framework-neutral application reducer, then adapt camera, scene, labels, routes, URL history, media preferences, and the UI shell to that canonical state. Preserve procedural visuals and request-driven rendering; optional assets and effects remain outside this implementation.

**Tech Stack:** Vite 8, TypeScript 5.9, Three.js 0.185, Vitest 4, jsdom, Playwright 1.61, plain CSS.

## Global Constraints

- Do not add React, React Three Fiber, Next.js, a Node server, a database, Tailwind, or a UI component dependency.
- Preserve semantic navigation and entity content when WebGL is unavailable.
- Follow strict red-green-refactor: no production behavior changes before a failing test is observed.
- Do not stage or commit unrelated untracked files; every commit command names exact task paths.
- Keep settled idle rendering at zero continuous RAF callbacks.
- Separate reduced-motion behavior from graphics-quality selection.
- Use one directional shadow caster; shadow maps stay at or below 2048 square on desktop and 1024 square on mobile.
- Keep body text at least 16 px, secondary UI at least 14 px, interactive targets at least 44 by 44 CSS pixels, and adjacent targets at least 8 px apart.
- Preserve route distinction through pattern and text, not color alone.
- Do not add photorealistic assets or global bloom, depth of field, film grain, chromatic aberration, or heavy vignette.
- Treat all institutional copy in `src/data/entities.ts` as working content; do not invent new claims.

---

## File Structure

### New files

- `src/application/state.ts` — canonical state, actions, reducer, and selectors.
- `src/application/state.test.ts` — reducer and selector contract tests.
- `src/application/urlState.ts` — parse, serialize, and History API adapter.
- `src/application/urlState.test.ts` — deep-link and Back/Forward behavior tests.
- `src/application/mediaPreferences.ts` — live reduced-motion and pointer preference subscription.
- `src/application/mediaPreferences.test.ts` — media-query change and disposal tests.
- `src/data/hierarchy.ts` — validated containment graph.
- `src/data/hierarchy.test.ts` — hierarchy invariants and canonical graph tests.
- `src/navigation/cameraFraming.ts` — UI-aware perspective framing calculations.
- `src/navigation/cameraFraming.test.ts` — bounds/safe-rectangle framing tests.
- `src/scene/atlasLayout.ts` — district extents, local/world position conversion, and scope bounds.
- `src/scene/atlasLayout.test.ts` — district separation and hierarchy layout tests.
- `src/scene/relationshipAppearance.ts` — incident route and unrelated-content emphasis.
- `src/scene/relationshipAppearance.test.ts` — relationship visibility/emphasis tests.
- `src/ui/presentation.ts` — category labels, aliases, route copy, and UI view-model selectors.
- `src/ui/presentation.test.ts` — presentation metadata and view-model tests.

### Modified files

- `src/data/schema.ts`, `src/data/entities.ts`, `src/data/entities.test.ts`
- `src/navigation/cameraController.ts`, `src/navigation/cameraController.test.ts`
- `src/interaction/selectionController.ts`, `src/interaction/selectionController.test.ts`
- `src/scene/layout.ts`, `src/scene/layout.test.ts`
- `src/scene/campus.ts`, `src/scene/campus.test.ts`
- `src/scene/buildings.ts`, `src/scene/buildings.test.ts`
- `src/scene/routes.ts`, `src/scene/routes.test.ts`
- `src/scene/materials.ts`, `src/scene/materials.test.ts`
- `src/scene/lighting.ts`, `src/scene/lighting.test.ts`
- `src/scene/selectionAppearance.ts`, `src/scene/selectionAppearance.test.ts`
- `src/performance/quality.ts`, `src/performance/quality.test.ts`
- `src/ui/labels.ts`, `src/ui/labels.test.ts`
- `src/ui/appShell.ts`, `src/ui/appShell.test.ts`
- `src/main.ts`, `src/main.test.ts`
- `src/styles.css`, `index.html`
- `e2e/neighborhood.spec.ts`, `e2e/performance.perf.spec.ts`, `README.md`

---

### Task 1: Camera interruption continuity and safe-rectangle framing

**Files:**
- Create: `src/navigation/cameraFraming.ts`
- Create: `src/navigation/cameraFraming.test.ts`
- Modify: `src/navigation/cameraController.ts`
- Modify: `src/navigation/cameraController.test.ts`

**Interfaces:**
- Produces: `fitPerspectiveView(input: PerspectiveFitInput): CameraPose`.
- Produces: `CameraController.refitCurrentTarget(bounds, viewport, safeInsets): void`.
- Changes: interrupted travel enters `free-explore` limits derived from the current pose rather than destination-local limits.

- [ ] **Step 1: Write the failing interruption test**

Add a test that advances an overview-to-local transition, interrupts it, then emulates the next OrbitControls distance clamp:

```ts
it('keeps the first manual orbit update continuous after interrupted travel', () => {
  const { controller, camera, orbit, setNow } = createClampingHarness();
  controller.focusEntity('alpha', 0);
  setNow(280);
  controller.update(280);
  const before = camera.position.clone();

  controller.interrupt();
  orbit.update();

  expect(camera.position.distanceTo(before)).toBeLessThan(0.001);
  expect(orbit.maxDistance).toBeGreaterThanOrEqual(camera.position.distanceTo(orbit.target));
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run src/navigation/cameraController.test.ts`

Expected: FAIL because destination-local `maxDistance = 22` clamps the intermediate pose.

- [ ] **Step 3: Implement free-explore interruption limits**

Add a `free-explore` camera mode or equivalent internal transition outcome. On interruption, compute `currentDistance = camera.position.distanceTo(orbit.target)`, retain current pose, and set `maxDistance` to at least `Math.ceil(currentDistance)` without committing abandoned destination limits.

- [ ] **Step 4: Verify the interruption test is GREEN**

Run: `pnpm vitest run src/navigation/cameraController.test.ts`

Expected: PASS with existing camera tests still green.

- [ ] **Step 5: Write failing framing tests**

Cover centered bounds, asymmetric safe insets, portrait viewport, and minimum padding:

```ts
it('shifts framing into the unobstructed viewport rectangle', () => {
  const pose = fitPerspectiveView({
    bounds: new THREE.Box3(new THREE.Vector3(-10, 0, -6), new THREE.Vector3(10, 8, 6)),
    direction: new THREE.Vector3(1, 0.8, 1).normalize(),
    verticalFovDegrees: 40,
    viewport: { width: 1440, height: 900 },
    safeInsets: { top: 72, right: 360, bottom: 48, left: 96 },
    padding: 24,
  });
  expect(pose.screenOffset.x).toBeLessThan(0);
  expect(pose.distance).toBeGreaterThan(0);
});
```

- [ ] **Step 6: Run framing tests and verify RED**

Run: `pnpm vitest run src/navigation/cameraFraming.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 7: Implement `fitPerspectiveView`**

Use bounds size/center, perspective FOV, unobstructed width/height, padding, and normalized screen-center offset. Return immutable values:

```ts
export interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  distance: number;
  screenOffset: THREE.Vector2;
}
```

Do not read DOM geometry in this module.

- [ ] **Step 8: Integrate framing into the controller**

Replace fixed overview positions and scalar-only focus placement with authored view direction plus calculated bounds. Keep reduced-motion behavior synchronous. Use 400 ms as the guided transition duration.

- [ ] **Step 9: Run navigation tests**

Run: `pnpm vitest run src/navigation/cameraFraming.test.ts src/navigation/cameraController.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit only task files**

```powershell
git add -- src/navigation/cameraFraming.ts src/navigation/cameraFraming.test.ts src/navigation/cameraController.ts src/navigation/cameraController.test.ts
git commit -m "fix: make atlas camera travel interruption-safe"
```

---

### Task 2: Validated containment graph and atlas scopes

**Files:**
- Create: `src/data/hierarchy.ts`
- Create: `src/data/hierarchy.test.ts`
- Modify: `src/data/schema.ts`
- Modify: `src/data/entities.ts`
- Modify: `src/data/entities.test.ts`

**Interfaces:**
- Produces: `ContainmentGraph`, `buildContainmentGraph(entities)`, `ancestorsOf(id)`, `childrenOf(id)`.
- Produces: `AtlasScopeId = 'sei' | 'cims'` and `ENTITY_PRESENTATION: ReadonlyMap<string, EntityPresentation>` with `scopeId`, `visualRole`, and `slug`.
- Canonical containment: SEi contains CiMS, HyCATT, and New ZeMA; CiMS contains its five research groups.

- [ ] **Step 1: Write failing hierarchy tests**

```ts
it('builds SEi land with CiMS and CiMS research neighborhoods', () => {
  const graph = buildContainmentGraph(ENTITIES);
  expect(graph.childrenOf('sei')).toEqual(expect.arrayContaining(['cims-hub', 'hycatt', 'new-zema']));
  expect(graph.childrenOf('cims-hub')).toEqual(expect.arrayContaining([
    'elastocalorics', 'electroactive-polymers', 'smart-material-electronics',
    'smart-textiles', 'shape-memory-alloys',
  ]));
  expect(graph.ancestorsOf('smart-textiles')).toEqual(['cims-hub', 'sei']);
});

it('rejects containment cycles', () => {
  expect(() => buildContainmentGraph(cyclicEntities)).toThrow('Containment cycle');
});
```

Also test duplicate parents, missing parent targets, duplicate slugs, and exactly one `land` visual role.

- [ ] **Step 2: Run hierarchy tests and verify RED**

Run: `pnpm vitest run src/data/hierarchy.test.ts src/data/entities.test.ts`

Expected: FAIL because the graph and metadata do not exist.

- [ ] **Step 3: Extend schema without coupling it to Three.js**

Add presentation types without making every unit-test entity fixture carry UI metadata:

```ts
export type AtlasScopeId = 'sei' | 'cims';
export type VisualRole = 'land' | 'city' | 'neighborhood' | 'satellite';

export interface EntityPresentation {
  slug: string;
  scopeId: AtlasScopeId;
  visualRole: VisualRole;
  shortLabel?: string;
}
```

Export the canonical metadata separately as `ENTITY_PRESENTATION` from `entities.ts`. Add `validateEntityPresentation(entities, metadata)` for missing entries, extra entries, duplicate slugs, invalid scope IDs, and exactly one `land` role.

- [ ] **Step 4: Implement graph construction and validation**

Build parent/child maps from `contains` relationships. Validate target existence, at most one parent, no self-containment, no cycles, stable unique slugs, and one land role.

- [ ] **Step 5: Update canonical entities**

Add `ENTITY_PRESENTATION` entries and `contains` relationships from `cims-hub` to the five research groups while keeping the existing `coordinates` relationships. Keep UdS and htw as satellites with collaboration relationships, not contained children.

- [ ] **Step 6: Run data tests**

Run: `pnpm vitest run src/data/hierarchy.test.ts src/data/entities.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit only task files**

```powershell
git add -- src/data/schema.ts src/data/entities.ts src/data/entities.test.ts src/data/hierarchy.ts src/data/hierarchy.test.ts
git commit -m "feat: model SEi and CiMS containment scopes"
```

---

### Task 3: Canonical application state, URL state, and live preferences

**Files:**
- Create: `src/application/state.ts`
- Create: `src/application/state.test.ts`
- Create: `src/application/urlState.ts`
- Create: `src/application/urlState.test.ts`
- Create: `src/application/mediaPreferences.ts`
- Create: `src/application/mediaPreferences.test.ts`

**Interfaces:**
- Produces: `NeighborhoodState`, `NeighborhoodAction`, `reduceNeighborhoodState`.
- Produces: `readLocationState(url)`, `writeLocationState(state)`, `createHistoryAdapter(...)`.
- Produces: `subscribeMediaPreferences(window, onChange)` returning an idempotent disposer.

- [ ] **Step 1: Write failing reducer tests**

```ts
it('enters CiMS, selects an entity, and returns one semantic level', () => {
  let state = initialNeighborhoodState();
  state = reduceNeighborhoodState(state, { type: 'ENTER_SCOPE', scopeId: 'cims' });
  state = reduceNeighborhoodState(state, { type: 'SELECT_ENTITY', entityId: 'smart-textiles' });
  expect(state.scopeId).toBe('cims');
  expect(state.selectedId).toBe('smart-textiles');
  expect(state.relations).toEqual({ mode: 'incident', entityId: 'smart-textiles' });
  state = reduceNeighborhoodState(state, { type: 'BACK' });
  expect(state.selectedId).toBeNull();
  expect(state.scopeId).toBe('cims');
});
```

Cover preview without camera intent, guiding to focused, manual interruption to free exploration, reduced motion, loading/ready/failed, Overview, and relationship filters.

- [ ] **Step 2: Run reducer tests and verify RED**

Run: `pnpm vitest run src/application/state.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure reducer and selectors**

Use discriminated unions; reject unknown entity/scope IDs at adapter boundaries rather than inside the pure reducer. Export selectors for breadcrumb IDs, visible label IDs, and incident relationship IDs.

- [ ] **Step 4: Run reducer tests and verify GREEN**

Run: `pnpm vitest run src/application/state.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing URL and media tests**

```ts
it('round-trips scope and entity through a stable URL', () => {
  const url = writeLocationState({ scopeId: 'cims', selectedId: 'smart-textiles' });
  expect(url).toBe('/?scope=cims&entity=smart-textiles');
  expect(readLocationState(new URL(url, 'https://example.test'))).toEqual({
    scopeId: 'cims', selectedId: 'smart-textiles',
  });
});

it('reports live reduced-motion changes and removes listeners on dispose', () => {
  const media = createMediaHarness(false);
  const values: boolean[] = [];
  const dispose = subscribeMediaPreferences(media.window, (value) => values.push(value.reducedMotion));
  media.setReducedMotion(true);
  dispose();
  media.setReducedMotion(false);
  expect(values).toEqual([false, true]);
});
```

Define `createMediaHarness` in the test file as a fake `Window` with two fake `MediaQueryList` instances. Each fake stores `change` listeners in a `Set`, exposes `matches`, and implements `setMatches(value)` by updating `matches` and invoking each listener with `{ matches: value } as MediaQueryListEvent`. The harness `setReducedMotion(value)` calls the reduced-motion instance's `setMatches(value)`.

- [ ] **Step 6: Implement URL and media adapters**

Use `URLSearchParams`, `history.pushState`, `history.replaceState`, `popstate`, and `MediaQueryList.change`. Keep adapters injectable for tests and return idempotent cleanup functions.

- [ ] **Step 7: Run application tests**

Run: `pnpm vitest run src/application`

Expected: PASS.

- [ ] **Step 8: Commit only task files**

```powershell
git add -- src/application/state.ts src/application/state.test.ts src/application/urlState.ts src/application/urlState.test.ts src/application/mediaPreferences.ts src/application/mediaPreferences.test.ts
git commit -m "feat: add canonical atlas application state"
```

---

### Task 4: Multi-district atlas layout and SEi land composition

**Files:**
- Create: `src/scene/atlasLayout.ts`
- Create: `src/scene/atlasLayout.test.ts`
- Modify: `src/scene/layout.ts`
- Modify: `src/scene/layout.test.ts`
- Modify: `src/scene/campus.ts`
- Modify: `src/scene/campus.test.ts`
- Modify: `src/scene/buildings.ts`
- Modify: `src/scene/buildings.test.ts`

**Interfaces:**
- Produces: `DISTRICT_LAYOUT`, `scopeBounds(scopeId)`, `worldPositionFor(entityId)`.
- Changes: `createCampus` returns named district groups and scope bounds while preserving entity visuals, selection proxies, and disposal.

- [ ] **Step 1: Write failing atlas layout tests**

```ts
it('separates five overview regions and nests CiMS entities inside the CiMS extent', () => {
  expect([...DISTRICT_LAYOUT.keys()]).toEqual(['cims', 'new-zema', 'hycatt', 'uds', 'htw-saar']);
  const cims = DISTRICT_LAYOUT.get('cims')!;
  for (const id of ['cims-hub', ...GROUP_IDS]) {
    expect(cims.bounds.containsPoint(worldPositionFor(id))).toBe(true);
  }
  const overlap = cims.bounds.clone().intersect(DISTRICT_LAYOUT.get('hycatt')!.bounds);
  expect(overlap.isEmpty()).toBe(true);
});
```

Also assert CiMS uses at most 40% of overview land area and all regions have distinct centers.

- [ ] **Step 2: Run layout tests and verify RED**

Run: `pnpm vitest run src/scene/atlasLayout.test.ts src/scene/layout.test.ts`

Expected: FAIL because district layout does not exist.

- [ ] **Step 3: Implement district and local layout data**

Define immutable district centers/extents and keep entity positions deterministic. CiMS research groups remain equal-footprint and equal-distance around the hub, but their ring is local to the CiMS district rather than the whole land.

- [ ] **Step 4: Write failing scene-assembly tests**

```ts
it('uses SEi as land and assembles entities under semantic district groups', () => {
  const atlas = build();
  expect(atlas.root.getObjectByName('land:sei')).toBeDefined();
  expect(atlas.root.getObjectByName('district:cims')?.getObjectByName('entity:cims-hub')).toBeDefined();
  expect(atlas.root.getObjectByName('entity:sei')).toBeUndefined();
  expect(atlas.root.getObjectByName('boundary:sei')).toBeUndefined();
});
```

- [ ] **Step 5: Replace oval ground and SEi peer block**

Create one irregular extruded land geometry from deterministic XZ points, plus lighter district clearing meshes. Remove the generic `entity:sei` visual and thin torus boundary. Keep `sei` semantic data represented by the land group and its focus/label anchor.

- [ ] **Step 6: Add district-specific silhouettes**

Keep existing detailed CiMS procedural buildings. Replace generic context blocks with small deterministic clusters:

- HyCATT: two linked masses and one vertical landmark.
- New ZeMA: low clustered volumes with an angled/folded roof landmark.
- UdS: compact academic pair.
- htw saar: compact workshop/tower pair.

All remain lightweight geometry using the shared palette.

- [ ] **Step 7: Preserve proxies, anchors, resources, and disposal**

Return a semantic land visual for `sei`; derive context proxy geometry from actual district bounds; retain stable IDs and reverse-order disposal behavior.

- [ ] **Step 8: Run scene tests**

Run: `pnpm vitest run src/scene/atlasLayout.test.ts src/scene/layout.test.ts src/scene/buildings.test.ts src/scene/campus.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit only task files**

```powershell
git add -- src/scene/atlasLayout.ts src/scene/atlasLayout.test.ts src/scene/layout.ts src/scene/layout.test.ts src/scene/campus.ts src/scene/campus.test.ts src/scene/buildings.ts src/scene/buildings.test.ts
git commit -m "feat: compose the SEi multi-district atlas"
```

---

### Task 5: Progressive labels and relationship emphasis

**Files:**
- Modify: `src/ui/labels.ts`
- Modify: `src/ui/labels.test.ts`
- Modify: `src/scene/routes.ts`
- Modify: `src/scene/routes.test.ts`
- Create: `src/scene/relationshipAppearance.ts`
- Create: `src/scene/relationshipAppearance.test.ts`
- Modify: `src/scene/selectionAppearance.ts`
- Modify: `src/scene/selectionAppearance.test.ts`

**Interfaces:**
- Changes: `LabelLayer.update(view: LabelView): void` where view includes dimensions, scope, selected/preview IDs, safe rectangles, and visible-ID budget.
- Produces: `createRelationshipAppearance(routes: readonly THREE.Group[], visuals: ReadonlyMap<string, THREE.Object3D>)` with `apply(RelationView)` and `dispose()`.

- [ ] **Step 1: Write failing progressive-label tests**

```ts
it('shows district labels at SEi overview and research labels only inside CiMS', () => {
  const { layer, container } = canonicalLabelHarness();
  layer.update({
    width: 1200, height: 800, scopeId: 'sei', selectedId: null, previewId: null,
    safeRectangles: [], maxVisible: 6,
  });
  expect(visibleIds(container)).toEqual(expect.arrayContaining(['cims-hub', 'hycatt', 'new-zema', 'uds', 'htw-saar']));
  expect(label(container, 'smart-textiles').hidden).toBe(true);

  layer.update({
    width: 1200, height: 800, scopeId: 'cims', selectedId: null, previewId: null,
    safeRectangles: [], maxVisible: 7,
  });
  expect(label(container, 'smart-textiles').hidden).toBe(false);
});
```

Add these exact test helpers using the existing `harness` function:

```ts
function canonicalLabelHarness() {
  const positions = Object.fromEntries(
    [...LAYOUT_BY_ID].map(([id, node]) => [id, node.position]),
  ) as Readonly<Record<string, readonly [number, number, number]>>;
  return harness(ENTITIES, positions, { presentation: ENTITY_PRESENTATION });
}

function visibleIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLButtonElement>('[data-label-id]')]
    .filter((button) => !button.hidden)
    .map((button) => button.dataset.labelId!);
}
```

Import `ENTITIES`, `ENTITY_PRESENTATION`, and `LAYOUT_BY_ID` in `labels.test.ts`.

Add tests for a maximum of six overview labels, selected-label retention, reserved UI rectangles, viewport clamping, and cached measurement across repeated camera-only updates.

- [ ] **Step 2: Run label tests and verify RED**

Run: `pnpm vitest run src/ui/labels.test.ts`

Expected: FAIL because labels are not scope-aware and remeasure every update.

- [ ] **Step 3: Implement semantic label candidates and cached geometry**

Filter by scope and priority before projection. Cache dimensions by label text plus viewport class. Batch text/selected-state writes, then measurement reads, then transform/hidden writes. Accept safe rectangles in canvas coordinates.

- [ ] **Step 4: Write failing relationship-emphasis tests**

```ts
it('emphasizes incident routes and recedes unrelated visuals', () => {
  const activeRoute = new THREE.Group();
  activeRoute.userData = { sourceId: 'cims-hub', targetId: 'smart-textiles' };
  const unrelatedRoute = new THREE.Group();
  unrelatedRoute.userData = { sourceId: 'hycatt', targetId: 'new-zema' };
  const routes = [activeRoute, unrelatedRoute];
  const unrelatedVisual = new THREE.Group();
  const visuals = new Map<string, THREE.Object3D>([['hycatt', unrelatedVisual]]);
  const appearance = createRelationshipAppearance(routes, visuals);
  appearance.apply({ mode: 'incident', entityId: 'cims-hub' });
  expect(activeRoute.userData.emphasis).toBe('active');
  expect(unrelatedRoute.userData.emphasis).toBe('receded');
  expect(unrelatedVisual.userData.emphasis).toBe('receded');
});
```

- [ ] **Step 5: Implement relationship appearance**

Store original material opacity/color state once. Apply active/receded state without allocating new materials per selection. Preserve dashed/solid geometry. Preview uses lighter emphasis than committed selection.

- [ ] **Step 6: Run focused tests**

Run: `pnpm vitest run src/ui/labels.test.ts src/scene/routes.test.ts src/scene/relationshipAppearance.test.ts src/scene/selectionAppearance.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit only task files**

```powershell
git add -- src/ui/labels.ts src/ui/labels.test.ts src/scene/routes.ts src/scene/routes.test.ts src/scene/relationshipAppearance.ts src/scene/relationshipAppearance.test.ts src/scene/selectionAppearance.ts src/scene/selectionAppearance.test.ts
git commit -m "feat: add semantic labels and route emphasis"
```

---

### Task 6: Pointer parity and scope-derived selection proxies

**Files:**
- Modify: `src/interaction/selectionController.ts`
- Modify: `src/interaction/selectionController.test.ts`
- Modify: `src/scene/buildings.ts`
- Modify: `src/scene/buildings.test.ts`

**Interfaces:**
- Changes: selection options accept `coarsePointer`, `onPreview`, and multiple active-pointer tracking.
- Changes: selection proxies derive from visual/district bounds and retain `entityId`.

- [ ] **Step 1: Write failing interaction tests**

Test that:

- 10 px movement remains a tap for a coarse pointer but is a drag for a fine pointer.
- a second pointer cancels tap selection;
- pointer move preview is throttled to one queued frame;
- pointer leave clears preview;
- proxy dimensions correspond to the entity or district bounds.

```ts
it('cancels selection when a second pointer joins the gesture', () => {
  controller.pointerDown(sample(1, 100, 100));
  controller.pointerDown(sample(2, 120, 120));
  controller.pointerUp(sample(1, 100, 100));
  expect(onSelect).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run interaction tests and verify RED**

Run: `pnpm vitest run src/interaction/selectionController.test.ts src/scene/buildings.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement pointer policy and proxy bounds**

Track active pointer IDs. Use a coarse threshold of 12 CSS px and fine threshold of 6 CSS px. Raycast only against proxies. Schedule hover raycasting through the injected/requested animation frame and coalesce moves.

- [ ] **Step 4: Run focused tests**

Run: `pnpm vitest run src/interaction/selectionController.test.ts src/scene/buildings.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit only task files**

```powershell
git add -- src/interaction/selectionController.ts src/interaction/selectionController.test.ts src/scene/buildings.ts src/scene/buildings.test.ts
git commit -m "feat: improve atlas pointer and touch interaction"
```

---

### Task 7: Responsive semantic atlas shell

**Files:**
- Create: `src/ui/presentation.ts`
- Create: `src/ui/presentation.test.ts`
- Modify: `src/ui/appShell.ts`
- Modify: `src/ui/appShell.test.ts`
- Modify: `src/styles.css`
- Modify: `index.html`

**Interfaces:**
- Changes: `AppShell` exposes `render(state, viewModel)`, `measureSafeInsets()`, and `setStatus(status)`.
- Changes: shell options include scope, back, retry, relationship, preview, and selection callbacks.

- [ ] **Step 1: Write failing presentation and shell tests**

```ts
it('renders SEi and CiMS breadcrumbs with a semantic back action', () => {
  const shell = createAppShell(root, ENTITIES, options);
  shell.render(cimsState(), cimsViewModel());
  expect(root.querySelector('[aria-label="Breadcrumb"]')?.textContent).toContain('SEi');
  expect(root.querySelector('[aria-label="Breadcrumb"]')?.textContent).toContain('CiMS');
  root.querySelector<HTMLButtonElement>('[data-back]')!.click();
  expect(options.onBack).toHaveBeenCalledOnce();
});

it('renders loading, ready, failed, and retry states truthfully', () => {
  shell.setStatus('loading');
  expect(root.querySelector('[role="status"]')?.textContent).toContain('Loading');
  shell.setStatus('failed');
  root.querySelector<HTMLButtonElement>('[data-retry]')!.click();
  expect(options.onRetry).toHaveBeenCalledOnce();
});
```

Also test categorized list semantics, actionable connection buttons, collapsible legend, dismissible/collapsible detail panel, full text availability, canvas accessible treatment, and safe-inset measurement.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `pnpm vitest run src/ui/presentation.test.ts src/ui/appShell.test.ts`

Expected: FAIL.

- [ ] **Step 3: Extract presentation metadata**

Move category labels, short labels, route legend copy, and view-model creation into `presentation.ts`. Keep production content in `entities.ts`; do not create mock-data modules.

- [ ] **Step 4: Rebuild the shell with semantic elements**

Use:

- `header` for title, breadcrumb, and global controls;
- `nav` with categorized `ul`/`li` groups;
- `article` for selected details;
- native buttons for Back, Overview, Retry, legend disclosure, and relationships;
- `aria-live="polite"` for non-blocking status and selected details.

Keep the shell mounted before WebGL initialization.

- [ ] **Step 5: Implement the light institutional atlas CSS**

Define CSS tokens for color, spacing, radii, type scale, motion, focus, and neutral shadows. Desktop uses a compact explorer and on-demand detail panel. Mobile uses an explorer disclosure and collapsible bottom sheet. Add safe-area insets, `overscroll-behavior: contain`, 44 px targets, 8 px gaps, `:active` feedback, balanced headings, pretty body copy, and long-word wrapping.

Do not use a global `transition: all`. Under `prefers-reduced-motion`, reduce transition durations without changing graphics quality.

- [ ] **Step 6: Add document metadata**

Add matching `theme-color` and a keyboard skip link. Preserve zoom-enabled viewport metadata.

- [ ] **Step 7: Run UI tests**

Run: `pnpm vitest run src/ui/presentation.test.ts src/ui/appShell.test.ts src/ui/labels.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit only task files**

```powershell
git add -- src/ui/presentation.ts src/ui/presentation.test.ts src/ui/appShell.ts src/ui/appShell.test.ts src/styles.css index.html
git commit -m "feat: redesign the accessible atlas interface"
```

---

### Task 8: Palette, lighting, and independent quality policies

**Files:**
- Modify: `src/scene/materials.ts`
- Modify: `src/scene/materials.test.ts`
- Modify: `src/scene/lighting.ts`
- Modify: `src/scene/lighting.test.ts`
- Modify: `src/performance/quality.ts`
- Modify: `src/performance/quality.test.ts`
- Modify: `src/scene/runtime.ts`
- Modify: `src/scene/runtime.test.ts`

**Interfaces:**
- Changes: `selectGraphicsQuality` no longer consumes reduced-motion.
- Produces: `MotionPolicy = 'full' | 'reduced'` independently.
- Extends material palette with land, clearing, district, route-active, and route-muted materials.

- [ ] **Step 1: Write failing policy tests**

```ts
it('does not reduce semantic graphics detail for reduced motion alone', () => {
  expect(selectGraphicsQuality({ width: 1200, dpr: 2, coarsePointer: false }).tier).toBe('desktop');
  expect(selectMotionPolicy(true)).toBe('reduced');
});
```

Add tests for shadow caps, context density, palette contrast ordering by relative luminance, and only one shadow-casting light.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm vitest run src/performance/quality.test.ts src/scene/materials.test.ts src/scene/lighting.test.ts src/scene/runtime.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement separate policies and rebalance visuals**

Retain sRGB and ACES. Use warmer green land, light neutral clearings, more separated district accents, and stronger route active/muted states. Lower hemisphere fill relative to the sun. Disable shadows for routes and small context motifs.

- [ ] **Step 4: Run focused tests**

Run: `pnpm vitest run src/performance/quality.test.ts src/scene/materials.test.ts src/scene/lighting.test.ts src/scene/runtime.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit only task files**

```powershell
git add -- src/performance/quality.ts src/performance/quality.test.ts src/scene/materials.ts src/scene/materials.test.ts src/scene/lighting.ts src/scene/lighting.test.ts src/scene/runtime.ts src/scene/runtime.test.ts
git commit -m "feat: refine atlas rendering quality policies"
```

---

### Task 9: Integrate state, scene, shell, history, preferences, and retry

**Files:**
- Modify: `src/main.ts`
- Modify: `src/main.test.ts`

**Interfaces:**
- Consumes: reducer/store, history adapter, media preference subscription, atlas scene, camera fitting, label view, relationship appearance, and shell renderer.
- Produces: the same `mountNeighborhood(root, options): () => void` public entry point.

- [ ] **Step 1: Write failing integration tests**

Add tests that prove:

- shell status begins as loading and becomes ready only after scene composition;
- Retry performs a fresh scene initialization without duplicating the shell;
- selection dispatches once and updates URL, shell, appearance, routes, labels, and camera intent;
- Back/Forward restores scope and selection;
- live reduced-motion changes rebuild motion behavior without changing graphics tier;
- UI safe-inset changes refit the current target;
- camera and OrbitControls settling use request-driven continuous reasons and return to idle;
- disposal removes history, media, resize, pointer, and retry listeners exactly once.

```ts
it('keeps the semantic shell usable while WebGL initializes', () => {
  let statusDuringRuntime = '';
  createHarness({}, {
    onRuntimeCreate: () => {
      statusDuringRuntime = document.querySelector('[role="status"]')?.textContent ?? '';
      expect(document.querySelector('nav[aria-label="Organization"]')).not.toBeNull();
    },
  });
  expect(document.querySelector('nav[aria-label="Organization"]')).not.toBeNull();
  expect(statusDuringRuntime).toContain('Loading');
});
```

Extend the existing `createHarness` test helper with an optional second `probes` parameter typed as `{ onRuntimeCreate?: () => void }`. Invoke `probes.onRuntimeCreate?.()` at the start of the default runtime factory, before it returns the runtime mock.

- [ ] **Step 2: Run main tests and verify RED**

Run: `pnpm vitest run src/main.test.ts`

Expected: FAIL.

- [ ] **Step 3: Introduce a small controller inside composition**

Keep `main.ts` as mount/composition and move state transitions through the reducer. Render subscribers in a deterministic order: semantic shell, scene/relationship appearance, labels, camera intent, URL, then request render. Do not store camera pose in application state.

- [ ] **Step 4: Integrate scope navigation and retry**

CiMS selection from the SEi overview enters the CiMS scope; entity selection within CiMS focuses locally. Retry disposes only the failed/partial WebGL composition and mounts a new one while retaining semantic state.

- [ ] **Step 5: Integrate live preferences and safe rectangles**

Media changes dispatch motion/quality actions. Shell resize measurement provides safe insets to camera framing and label layout. Use `ResizeObserver`; batch the update into one requested frame.

- [ ] **Step 6: Run main and full unit tests**

Run: `pnpm vitest run src/main.test.ts`

Expected: PASS.

Run: `pnpm test:run`

Expected: all unit tests PASS.

- [ ] **Step 7: Commit only task files**

```powershell
git add -- src/main.ts src/main.test.ts
git commit -m "feat: integrate semantic atlas state and lifecycle"
```

---

### Task 10: Browser acceptance, accessibility, production, and performance gates

**Files:**
- Modify: `e2e/neighborhood.spec.ts`
- Modify: `e2e/performance.perf.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces: release-level acceptance tests for hierarchy, deep links, responsive UI, touch, motion, fallback, and performance.

- [ ] **Step 1: Write failing E2E assertions**

Add browser tests for:

- initial overview shows exactly the five district labels and hides research labels;
- entering CiMS reveals its hub and five research labels;
- selected bounds and labels avoid measured UI safe rectangles;
- Back, Forward, Escape, Back control, and Overview preserve semantic navigation;
- direct `?scope=cims&entity=smart-textiles` load restores state;
- live reduced-motion change removes travel without lowering context detail;
- mobile explorer and detail sheet are operable in portrait and landscape;
- canvas tap, drag cancellation, and two-pointer gesture do not conflict;
- loading and WebGL retry/fallback states keep semantic navigation usable;
- every interactive control has an accessible name, visible focus, and at least 44 by 44 CSS pixel bounds;
- no horizontal page overflow, clipped sheet content, or UI safe-area collision.

- [ ] **Step 2: Run E2E and verify RED**

Run: `pnpm test:e2e`

Expected: new acceptance assertions FAIL until integration behavior and selectors are complete.

- [ ] **Step 3: Resolve only integration defects exposed by E2E**

Make the smallest production changes in their owning modules. For each fix, first add or refine the corresponding unit test, verify RED, implement, then rerun the focused unit and browser test.

- [ ] **Step 4: Add explicit performance assertions**

In the opt-in production performance suite, assert:

```ts
expect(idleRafCallbacks).toBe(0);
expect(cameraTransitions.p95Ms).toBeLessThan(34);
expect(cameraTransitions.maxMs).toBeLessThan(100);
```

Keep the desktop `<22 ms` target as reported evidence unless the agreed CI runner is stable enough to enforce it.

- [ ] **Step 5: Add a normal production-preview smoke project**

Configure a small Playwright project that always runs against `vite preview` after `pnpm build` and verifies entry loading, deep links, asset URLs, selection, and WebGL fallback. Keep the long performance capture opt-in.

- [ ] **Step 6: Update package metadata and documentation**

Add exact `engines.node` and `packageManager` fields matching the README. Standardize on pnpm and do not remove `package-lock.json` unless the user explicitly approves removing it. Document controls, hierarchy, accessibility fallback, loading/retry, URL state, performance commands, and remaining physical-device validation.

- [ ] **Step 7: Run the complete verification matrix**

```powershell
pnpm test:run
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

Expected: all commands exit 0; screenshots show the SEi land and five distinct regions at overview, progressive CiMS detail, and no label/panel obstruction.

- [ ] **Step 8: Run production performance capture**

```powershell
$env:PERF_ACCEPTANCE = '1'
pnpm exec playwright test --grep '@performance'
Remove-Item Env:PERF_ACCEPTANCE
```

Expected: idle callbacks 0, transition p95 below 34 ms on the current runner, maximum below 100 ms. Record hardware/browser limitations in README.

- [ ] **Step 9: Commit only task files and any explicitly identified owner-module fixes**

```powershell
git add -- e2e/neighborhood.spec.ts e2e/performance.perf.spec.ts playwright.config.ts package.json README.md
git commit -m "test: validate semantic atlas experience"
```

---

## Final Self-Review Checklist

- Every approved specification section maps to at least one task.
- The semantic shell remains available before and without WebGL.
- SEi is represented once as land, never as a peer building plus ring.
- The five overview regions and progressive CiMS neighborhoods are asserted in unit and browser tests.
- Camera interruption, safe-rectangle framing, live motion changes, pointer parity, URL state, loading/retry, and idle rendering have explicit failing-first tests.
- React, R3F, backend, external fonts, generic assets, and global post-processing remain out of scope.
- All commit commands stage only named task files.
