# CiMS Aesthetic Enhancement Plan — Low-Poly Stylized Warmth

> **Art Direction:** Low-poly art with stylized warmth. Moody atmospheric lighting, urban fabric context, sculpted building volumes, procedural material variation, edge highlights, flat ground with detail layers.

**Architecture:** Extend existing procedural Three.js system. Add urban context buildings, street geometry, enhanced material system with procedural variation and edge detection, atmospheric fog, richer lighting. Keep all existing entity hierarchy, selection, labels, URL state, and camera behavior.

**Tech Stack:** Vite 8, TypeScript 5.9, Three.js 0.185, Vitest 4, jsdom, Playwright 1.61, plain CSS.

## Global Constraints

- No GLB models, HDR files, or image textures.
- No global post-processing (bloom, DoF, film grain, chromatic aberration).
- Procedural geometry only.
- Keep request-driven idle rendering at zero continuous RAF callbacks.
- One directional shadow caster; shadow maps ≤ 2048 desktop, ≤ 1024 mobile.
- Preserve existing entity hierarchy, selection, labels, URL state, camera behavior.
- Preserve semantic shell, WebGL fallback, reduced-motion independence.

---

## File Structure

### New files

- `src/scene/urbanFabric.ts` — context buildings, streets, blocks
- `src/scene/urbanFabric.test.ts` — urban fabric tests
- `src/scene/groundDetail.ts` — sidewalks, curbs, planted areas, road markings
- `src/scene/groundDetail.test.ts` — ground detail tests
- `src/scene/atmosphere.ts` — fog, atmospheric perspective, depth haze
- `src/scene/atmosphere.test.ts` — atmosphere tests
- `src/scene/edgeMaterial.ts` — wireframe/edge highlight material
- `src/scene/edgeMaterial.test.ts` — edge material tests
- `src/scene/vegetation.ts` — improved low-poly trees, bushes
- `src/scene/vegetation.test.ts` — vegetation tests

### Modified files

- `src/scene/materials.ts` — add procedural variation, new palette entries
- `src/scene/materials.test.ts` — test new materials
- `src/scene/lighting.ts` — moody lighting rig, cooler tones, stronger shadows
- `src/scene/lighting.test.ts` — test new lighting
- `src/scene/buildings.ts` — sculpted volumes for main entities
- `src/scene/buildings.test.ts` — test new geometry
- `src/scene/campus.ts` — integrate urban fabric, ground detail, vegetation
- `src/scene/campus.test.ts` — test integration
- `src/scene/runtime.ts` — integrate atmosphere (fog)
- `src/scene/runtime.test.ts` — test fog integration
- `src/main.ts` — wire new campus options
- `src/main.test.ts` — test new options
- `src/styles.css` — no changes expected

---

## Task A1: Enhanced Material System

**Goal:** Add procedural surface variation and edge highlight material while keeping the low-poly aesthetic.

**Files:**
- Modify: `src/scene/materials.ts`
- Modify: `src/scene/materials.test.ts`
- Create: `src/scene/edgeMaterial.ts`
- Create: `src/scene/edgeMaterial.test.ts`

**Interfaces:**
- Extends `MaterialPalette` with `landDark`, `pavement`, `sidewalk`, `curb`, `grass`, `road` materials.
- Produces `createEdgeMaterial(color: THREE.Color): THREE.LineBasicMaterial` for wireframe overlays.
- Produces `applyProceduralVariation(geometry: THREE.BufferGeometry, seed: number): void` that adds vertex color variation.

- [ ] **Step 1: Write failing tests for new palette entries**

```ts
it('provides distinct materials for ground zones', () => {
  const palette = createMaterialPalette();
  expect(palette.pavement).toBeInstanceOf(THREE.MeshStandardMaterial);
  expect(palette.sidewalk).toBeInstanceOf(THREE.MeshStandardMaterial);
  expect(palette.grass).toBeInstanceOf(THREE.MeshStandardMaterial);
  expect(palette.road).toBeInstanceOf(THREE.MeshStandardMaterial);
  disposeMaterialPalette(palette);
});
```

- [ ] **Step 2: Run materials tests and verify RED**

Run: `pnpm vitest run src/scene/materials.test.ts`

Expected: FAIL because new materials don't exist.

- [ ] **Step 3: Add new palette entries**

Add `pavement`, `sidewalk`, `curb`, `grass`, `road`, `landDark` to `MaterialPalette` and `createMaterialPalette()`.

- [ ] **Step 4: Write failing edge material tests**

```ts
it('creates a line basic material for edge highlights', () => {
  const material = createEdgeMaterial(new THREE.Color('#28343b'));
  expect(material).toBeInstanceOf(THREE.LineBasicMaterial);
  material.dispose();
});
```

- [ ] **Step 5: Implement edge material module**

Create `src/scene/edgeMaterial.ts` with `createEdgeMaterial(color)`.

- [ ] **Step 6: Write failing procedural variation tests**

```ts
it('adds vertex colors to geometry without changing vertex count', () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const vertexCount = geometry.attributes.position.count;
  applyProceduralVariation(geometry, 42);
  expect(geometry.attributes.color).toBeDefined();
  expect(geometry.attributes.position.count).toBe(vertexCount);
  geometry.dispose();
});
```

- [ ] **Step 7: Implement procedural variation**

Add `applyProceduralVariation(geometry, seed)` that adds subtle vertex color variation using a seeded PRNG. Use `vertexColors: true` on materials that accept variation.

- [ ] **Step 8: Run materials and edge tests**

Run: `pnpm vitest run src/scene/materials.test.ts src/scene/edgeMaterial.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add -- src/scene/materials.ts src/scene/materials.test.ts src/scene/edgeMaterial.ts src/scene/edgeMaterial.test.ts
git commit -m "feat: enhance material palette with ground zones and edge highlights"
```

---

## Task A2: Moody Atmospheric Lighting

**Goal:** Shift lighting to cooler tones, stronger shadow contrast, atmospheric fog.

**Files:**
- Modify: `src/scene/lighting.ts`
- Modify: `src/scene/lighting.test.ts`
- Create: `src/scene/atmosphere.ts`
- Create: `src/scene/atmosphere.test.ts`
- Modify: `src/scene/runtime.ts`
- Modify: `src/scene/runtime.test.ts`

**Interfaces:**
- Changes sun color to cooler white (`#e8eef5`), adjusts intensity.
- Changes hemisphere sky to cooler blue, ground to darker green.
- Produces `createAtmosphere(scene: THREE.Scene): Atmosphere` with `apply()` and `dispose()`.
- Atmosphere adds `THREE.Fog` or `THREE.FogExp2` to scene.

- [ ] **Step 1: Write failing lighting tests**

```ts
it('uses a cooler sun color for moody atmosphere', () => {
  const rig = createDaylightRig(new THREE.Scene(), 'desktop');
  expect(`#${rig.sun.color.getHexString()}`).not.toBe('#fff3dc');
  expect(rig.fill.intensity).toBeLessThan(rig.sun.intensity);
});
```

- [ ] **Step 2: Run lighting tests and verify RED**

Run: `pnpm vitest run src/scene/lighting.test.ts`

Expected: FAIL because sun color is still warm.

- [ ] **Step 3: Update lighting rig**

Change sun color to `#e8eef5` (cool white-blue), adjust intensity to 2.2. Change hemisphere sky to `#c5d5e0` (cooler blue), ground to `#5a6b5a` (darker green), intensity to 0.9.

- [ ] **Step 4: Write failing atmosphere tests**

```ts
it('adds fog to the scene for atmospheric depth', () => {
  const scene = new THREE.Scene();
  const atmosphere = createAtmosphere(scene);
  expect(scene.fog).toBeDefined();
  atmosphere.dispose();
  expect(scene.fog).toBeNull();
});
```

- [ ] **Step 5: Implement atmosphere module**

Create `src/scene/atmosphere.ts` with `createAtmosphere(scene)` that adds `THREE.FogExp2` with density ~0.008 and neutral color.

- [ ] **Step 6: Integrate atmosphere into runtime**

Add optional `atmosphere` factory to `RuntimeOptions`. Create atmosphere after scene, dispose on cleanup.

- [ ] **Step 7: Run focused tests**

Run: `pnpm vitest run src/scene/lighting.test.ts src/scene/atmosphere.test.ts src/scene/runtime.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add -- src/scene/lighting.ts src/scene/lighting.test.ts src/scene/atmosphere.ts src/scene/atmosphere.test.ts src/scene/runtime.ts src/scene/runtime.test.ts
git commit -m "feat: moody atmospheric lighting with fog and cooler tones"
```

---

## Task A3: Sculpted Building Volumes

**Goal:** Replace simple box buildings with more complex L-plans, courtyards, articulated facades, varied rooflines.

**Files:**
- Modify: `src/scene/buildings.ts`
- Modify: `src/scene/buildings.test.ts`

**Interfaces:**
- Each entity's `populate*` function creates more complex geometry.
- Research groups get L-plan or courtyard footprints instead of single box.
- Hub gets articulated entrance canopy with columns.
- HyCatt/New ZeMA get more complex massing.
- All buildings get varied rooflines (flat, pitched, stepped).

- [ ] **Step 1: Write failing geometry tests**

```ts
it('creates research group with L-plan footprint', () => {
  const palette = createMaterialPalette();
  const entity = ENTITY_BY_ID.get('elastocalorics')!;
  const layout = LAYOUT_BY_ID.get('elastocalorics')!;
  const visual = createEntityBuilding(entity, layout, palette);
  const meshCount = [...visual.visible.children].filter(c => c instanceof THREE.Group).length;
  expect(meshCount).toBeGreaterThan(1);
  disposeEntityVisual(visual);
  disposeMaterialPalette(palette);
});
```

- [ ] **Step 2: Run building tests and verify RED**

Run: `pnpm vitest run src/scene/buildings.test.ts`

Expected: FAIL because buildings are still simple boxes.

- [ ] **Step 3: Implement sculpted research shells**

Replace `createResearchShell` with L-plan geometry: two intersecting boxes creating an L footprint, with a small courtyard gap. Add entrance canopy with thin box columns.

- [ ] **Step 4: Implement sculpted hub**

Replace hub geometry with articulated volumes: main atrium + side wing + entrance canopy with columns + rooftop mechanical box.

- [ ] **Step 5: Implement sculpted district buildings**

Add more complex massing for HyCatt (3 volumes + glass link + landmark), New ZeMA (4 volumes + folded roof), UdS (3 volumes), htw saar (workshop + tower + small annex).

- [ ] **Step 6: Run building tests**

Run: `pnpm vitest run src/scene/buildings.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- src/scene/buildings.ts src/scene/buildings.test.ts
git commit -m "feat: sculpted building volumes with L-plans and varied rooflines"
```

---

## Task A4: Urban Fabric

**Goal:** Add context buildings, streets, and blocks surrounding the 7 landmarks.

**Files:**
- Create: `src/scene/urbanFabric.ts`
- Create: `src/scene/urbanFabric.test.ts`
- Modify: `src/scene/campus.ts`
- Modify: `src/scene/campus.test.ts`

**Interfaces:**
- Produces `createUrbanFabric(palette: MaterialPalette, density: number): THREE.Group`
- Creates ~40-60 simple box buildings at predefined positions around the campus.
- Creates street geometry (flat boxes) connecting districts.
- All context buildings are `castShadow = true, receiveShadow = true`.

- [ ] **Step 1: Write failing urban fabric tests**

```ts
it('creates context buildings outside the district boundaries', () => {
  const palette = createMaterialPalette();
  const fabric = createUrbanFabric(palette, 1);
  expect(fabric.children.length).toBeGreaterThan(0);
  fabric.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      expect(child.castShadow).toBe(true);
    }
  });
  fabric.removeFromParent();
  disposeMaterialPalette(palette);
});
```

- [ ] **Step 2: Run urban fabric tests and verify RED**

Run: `pnpm vitest run src/scene/urbanFabric.test.ts`

Expected: FAIL because module doesn't exist.

- [ ] **Step 3: Implement urban fabric module**

Define ~50 context building positions outside district bounds. Each is a simple box with darkMetal plinth + context/groupShell walls. Add street segments as flat boxes at y=0.02.

- [ ] **Step 4: Integrate into campus**

Add `createUrbanFabric` to campus creation, controlled by `contextDensity`.

- [ ] **Step 5: Run urban fabric and campus tests**

Run: `pnpm vitest run src/scene/urbanFabric.test.ts src/scene/campus.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- src/scene/urbanFabric.ts src/scene/urbanFabric.test.ts src/scene/campus.ts src/scene/campus.test.ts
git commit -m "feat: add urban fabric with context buildings and streets"
```

---

## Task A5: Ground Detail Layers

**Goal:** Add sidewalks, curbs, road markings, planted areas as separate geometry on the flat ground.

**Files:**
- Create: `src/scene/groundDetail.ts`
- Create: `src/scene/groundDetail.test.ts`
- Modify: `src/scene/campus.ts`
- Modify: `src/scene/campus.test.ts`

**Interfaces:**
- Produces `createGroundDetail(palette: MaterialPalette): THREE.Group`
- Creates sidewalk strips (thin boxes) along building fronts.
- Creates curb edges (thin dark boxes) at sidewalk edges.
- Creates road marking lines (thin yellow/white boxes) on streets.
- Creates planted area patches (green boxes with slight elevation).

- [ ] **Step 1: Write failing ground detail tests**

```ts
it('creates sidewalk and curb geometry', () => {
  const palette = createMaterialPalette();
  const detail = createGroundDetail(palette);
  const names = detail.children.map(c => c.name);
  expect(names.some(n => n.includes('sidewalk'))).toBe(true);
  expect(names.some(n => n.includes('curb'))).toBe(true);
  detail.removeFromParent();
  disposeMaterialPalette(palette);
});
```

- [ ] **Step 2: Run ground detail tests and verify RED**

Run: `pnpm vitest run src/scene/groundDetail.test.ts`

Expected: FAIL because module doesn't exist.

- [ ] **Step 3: Implement ground detail module**

Define sidewalk positions along main building fronts. Create thin box geometry (0.15 height) with sidewalk material. Add curb edges (0.08 height, dark material). Add road markings (0.02 height, white/yellow).

- [ ] **Step 4: Integrate into campus**

Add `createGroundDetail` to campus creation.

- [ ] **Step 5: Run ground detail and campus tests**

Run: `pnpm vitest run src/scene/groundDetail.test.ts src/scene/campus.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- src/scene/groundDetail.ts src/scene/groundDetail.test.ts src/scene/campus.ts src/scene/campus.test.ts
git commit -m "feat: add ground detail with sidewalks, curbs, and road markings"
```

---

## Task A6: Improved Vegetation

**Goal:** Replace simple cone trees with more varied low-poly deciduous and conifer shapes.

**Files:**
- Create: `src/scene/vegetation.ts`
- Create: `src/scene/vegetation.test.ts`
- Modify: `src/scene/campus.ts`
- Modify: `src/scene/campus.test.ts`

**Interfaces:**
- Produces `createTree(type: 'deciduous' | 'conifer', palette: MaterialPalette): THREE.Group`
- Deciduous: sphere or icosahedron crown on cylinder trunk.
- Conifer: cone crown on cylinder trunk (current approach, refined).
- Produces `createBush(palette: MaterialPalette): THREE.Group` — small sphere cluster.

- [ ] **Step 1: Write failing vegetation tests**

```ts
it('creates deciduous and conifer tree variants', () => {
  const palette = createMaterialPalette();
  const deciduous = createTree('deciduous', palette);
  const conifer = createTree('conifer', palette);
  expect(deciduous.children.length).toBeGreaterThan(0);
  expect(conifer.children.length).toBeGreaterThan(0);
  deciduous.removeFromParent();
  conifer.removeFromParent();
  disposeMaterialPalette(palette);
});
```

- [ ] **Step 2: Run vegetation tests and verify RED**

Run: `pnpm vitest run src/scene/vegetation.test.ts`

Expected: FAIL because module doesn't exist.

- [ ] **Step 3: Implement vegetation module**

Create `src/scene/vegetation.ts` with `createTree` (deciduous = IcosahedronGeometry crown + CylinderGeometry trunk, conifer = ConeGeometry crown + CylinderGeometry trunk) and `createBush` (3 small SphereGeometry clusters).

- [ ] **Step 4: Integrate into campus context**

Replace the existing cone trees in `createContext` with `createTree` calls. Add bushes at building entrances.

- [ ] **Step 5: Run vegetation and campus tests**

Run: `pnpm vitest run src/scene/vegetation.test.ts src/scene/campus.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- src/scene/vegetation.ts src/scene/vegetation.test.ts src/scene/campus.ts src/scene/campus.test.ts
git commit -m "feat: improved low-poly vegetation with deciduous and conifer trees"
```

---

## Task A7: Composition, Camera, and Integration

**Goal:** Adjust camera framing, integrate all new modules, verify full visual coherence.

**Files:**
- Modify: `src/main.ts`
- Modify: `src/main.test.ts`
- Modify: `src/navigation/cameraController.ts` (overview distance if needed)
- Modify: `src/navigation/cameraController.test.ts` (if distance changes)

**Interfaces:**
- Wire atmosphere, urban fabric, ground detail, vegetation into campus creation.
- Adjust overview camera distance if urban fabric extends the scene bounds.
- Verify all new geometry disposes correctly.

- [ ] **Step 1: Write failing integration tests**

```ts
it('creates campus with urban fabric, ground detail, and vegetation', () => {
  const harness = createHarness();
  const dispose = mountNeighborhood(mountRoot(), harness.options);
  // Verify scene has children from all new modules
  dispose();
});
```

- [ ] **Step 2: Run main tests and verify RED**

Run: `pnpm vitest run src/main.test.ts`

Expected: FAIL if new factories are required.

- [ ] **Step 3: Wire new modules into main.ts**

Add atmosphere, urban fabric, ground detail, vegetation factories to `NeighborhoodFactories`. Wire into campus creation.

- [ ] **Step 4: Adjust camera framing**

If urban fabric extends the scene, adjust overview bounds or camera distance.

- [ ] **Step 5: Run full test suite**

Run: `pnpm test:run`

Expected: all unit tests PASS.

- [ ] **Step 6: Run E2E tests**

Run: `pnpm test:e2e`

Expected: all E2E tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- src/main.ts src/main.test.ts
git commit -m "feat: integrate urban fabric, ground detail, vegetation, and atmosphere"
```

---

## Final Self-Review Checklist

- Low-poly art style maintained — no photorealistic textures or models.
- Moody atmospheric lighting with cooler tones and fog.
- Urban fabric provides city context around the 7 landmarks.
- Ground has sidewalks, curbs, road markings, planted areas.
- Buildings have sculpted volumes (L-plans, courtyards, varied rooflines).
- Trees are varied (deciduous/conifer) not just cones.
- Materials have procedural vertex color variation.
- Edge highlights emphasize low-poly geometry.
- All new geometry disposes correctly.
- Request-driven idle rendering preserved (zero continuous RAF).
- Existing entity hierarchy, selection, labels, URL state, camera behavior preserved.
- Semantic shell, WebGL fallback, reduced-motion independence preserved.
- No React, R3F, backend, external fonts, or global post-processing added.
