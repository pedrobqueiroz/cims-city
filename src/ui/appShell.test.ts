import { afterEach, describe, expect, it, vi } from 'vitest';
import documentHtml from '../../index.html?raw';
import { initialNeighborhoodState, reduceNeighborhoodState } from '../application/state';
import { ENTITIES, ENTITY_PRESENTATION } from '../data/entities';
import { createAppShell } from './appShell';
import { createAtlasViewModel } from './presentation';

function cimsState(selectedId: string | null = null) {
  let state = reduceNeighborhoodState(initialNeighborhoodState(), { type: 'ENTER_SCOPE', scopeId: 'cims' });
  if (selectedId) state = reduceNeighborhoodState(state, { type: 'SELECT_ENTITY', entityId: selectedId });
  return state;
}

function mount() {
  const root = document.createElement('section');
  const canvasHost = document.createElement('div');
  canvasHost.dataset.canvasHost = 'true';
  const canvas = document.createElement('canvas');
  canvasHost.append(canvas);
  root.append(canvasHost);
  document.body.append(root);
  const options = {
    onSelect: vi.fn(), onScope: vi.fn(), onBack: vi.fn(), onOverview: vi.fn(),
    onPreview: vi.fn(), onRelationship: vi.fn(), onRetry: vi.fn(),
    onReducedMotionChange: vi.fn(), onDetailDisclosureChange: vi.fn(),
    onLegendDisclosureChange: vi.fn(),
  };
  const shell = createAppShell(root, ENTITIES, options);
  return { root, canvas, shell, options };
}

function renderCims(shell: ReturnType<typeof createAppShell>, selectedId: string | null = null) {
  const state = cimsState(selectedId);
  shell.render(state, createAtlasViewModel(state, ENTITIES, ENTITY_PRESENTATION));
}

function rect(left: number, top: number, right: number, bottom: number): DOMRect {
  return { x: left, y: top, left, top, right, bottom, width: right - left, height: bottom - top, toJSON: () => ({}) } as DOMRect;
}

describe('createAppShell', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('starts the mobile explorer collapsed and expands it with a truthful disclosure control', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const { root, shell } = mount();
    const toggle = root.querySelector<HTMLButtonElement>('[data-explorer-toggle]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(shell.navigator.hidden).toBe(true);
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(shell.navigator.hidden).toBe(false);
    shell.setSelected('smart-textiles');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(shell.navigator.hidden).toBe(true);
    expect(shell.card.hidden).toBe(false);
  });

  it('renders SEi and CiMS breadcrumbs with semantic Back and Overview actions', () => {
    const { root, shell, options } = mount();
    renderCims(shell);
    const breadcrumb = root.querySelector('[aria-label=Breadcrumb]');
    expect(breadcrumb?.tagName).toBe('NAV');
    expect([...breadcrumb!.querySelectorAll('li')].map((item) => item.textContent)).toEqual(['SEi', 'CiMS']);
    expect(breadcrumb?.querySelector('[aria-current=page]')?.textContent).toBe('CiMS');
    root.querySelector<HTMLButtonElement>('[data-back]')!.click();
    root.querySelector<HTMLButtonElement>('[data-overview]')!.click();
    expect(options.onBack).toHaveBeenCalledOnce();
    expect(options.onOverview).toHaveBeenCalledOnce();
  });

  it('uses categorized list semantics and routes scope, selection, and preview actions', () => {
    const { root, shell, options } = mount();
    const overview = initialNeighborhoodState();
    shell.render(overview, createAtlasViewModel(overview, ENTITIES, ENTITY_PRESENTATION));
    const navigator = root.querySelector('nav[aria-label=Organization]')!;
    expect(navigator.querySelectorAll('[data-category-group] > ul')).toHaveLength(4);
    expect(navigator.querySelectorAll('[data-category-group] li button')).toHaveLength(6);
    const cims = navigator.querySelector<HTMLButtonElement>('[data-entity-id=cims-hub]')!;
    cims.dispatchEvent(new Event('pointerenter', { bubbles: true })); cims.click();
    cims.dispatchEvent(new Event('pointerleave', { bubbles: true }));
    expect(options.onPreview).toHaveBeenNthCalledWith(1, 'cims-hub');
    expect(options.onScope).toHaveBeenCalledWith('cims');
    expect(options.onPreview).toHaveBeenLastCalledWith(null);
    renderCims(shell);
    root.querySelector<HTMLButtonElement>('[data-entity-id=smart-textiles]')!.click();
    expect(options.onSelect).toHaveBeenCalledWith('smart-textiles');
  });

  it('renders actionable connection buttons whose text includes relationship kind', () => {
    const { root, shell, options } = mount(); renderCims(shell, 'cims-hub');
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-relationship]')];
    expect(buttons).toHaveLength(14);
    expect(buttons.map((button) => button.textContent)).toContain('Contains — Smart Textiles');
    expect(root.querySelector('[data-relationship-group=coordinates]')?.textContent).toContain('Coordinates');
    buttons.find((button) => button.textContent === 'Collaborates with — htw saar')!.click();
    expect(options.onRelationship).toHaveBeenCalledOnce();
    expect(options.onRelationship.mock.calls[0]?.[0]).toMatchObject({ kind: 'collaborates', relatedId: 'htw-saar' });
  });

  it('collapses legend and detail without discarding selection or full text', () => {
    const { root, shell, options } = mount(); renderCims(shell, 'smart-textiles');
    const detail = root.querySelector<HTMLElement>('article[data-detail]')!;
    const detailToggle = root.querySelector<HTMLButtonElement>('[data-detail-toggle]')!;
    const legendToggle = root.querySelector<HTMLButtonElement>('[data-legend-toggle]')!;
    expect(detail.hidden).toBe(false);
    expect(detail.textContent).toContain('Integrating smart-material sensing and actuation into textiles and flexible structures.');
    expect(detail.textContent).toContain('A wearable textile structure that senses movement and provides feedback.');
    root.querySelector<HTMLButtonElement>('[data-detail-dismiss]')!.click();
    expect(detail.hidden).toBe(true);
    expect(detailToggle.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('[data-entity-id=smart-textiles]')?.getAttribute('aria-current')).toBe('true');
    detailToggle.click(); legendToggle.click();
    expect(detail.hidden).toBe(false);
    expect(legendToggle.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector<HTMLElement>('[data-legend]')!.hidden).toBe(false);
    expect(options.onDetailDisclosureChange).toHaveBeenLastCalledWith(true);
    expect(options.onLegendDisclosureChange).toHaveBeenCalledWith(true);
  });

  it('renders loading, ready, failed, and Retry states truthfully', () => {
    const { root, shell, options } = mount();
    shell.setStatus('loading'); expect(root.querySelector('[role=status]')?.textContent).toContain('Loading');
    shell.setStatus('ready'); expect(root.querySelector('[role=status]')?.textContent).toContain('ready');
    shell.setStatus('failed'); expect(root.querySelector('[role=alert]')?.textContent).toContain('3D view is unavailable');
    root.querySelector<HTMLButtonElement>('[data-retry]')!.click();
    expect(options.onRetry).toHaveBeenCalledOnce();
    expect(root.querySelector('nav[aria-label=Organization]')).not.toBeNull();
  });

  it('labels the canvas and document with keyboard-accessible alternatives without disabling zoom', () => {
    const { root, canvas, shell } = mount(); shell.setStatus('ready');
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toContain('interactive institutional atlas');
    expect(canvas.getAttribute('aria-describedby')).toBeTruthy();
    expect(root.querySelector(`#${canvas.getAttribute('aria-describedby')}`)?.textContent).toContain('semantic explorer');
    const parsed = new DOMParser().parseFromString(documentHtml, 'text/html');
    expect(parsed.querySelector('.skip-link')?.getAttribute('href')).toBe('#organization-explorer');
    expect(parsed.querySelector('meta[name=theme-color]')?.getAttribute('content')).toBe('#f3f0e7');
    const viewport = parsed.querySelector('meta[name=viewport]')?.getAttribute('content') ?? '';
    expect(viewport).toContain('width=device-width');
    expect(viewport).not.toContain('user-scalable=no');
    expect(viewport).not.toContain('maximum-scale=1');
  });

  it('measures visible shell rectangles and the edge insets they occupy', () => {
    const { shell } = mount(); renderCims(shell, 'smart-textiles');
    vi.spyOn(shell.element, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 1200, 800));
    vi.spyOn(shell.navigator, 'getBoundingClientRect').mockReturnValue(rect(0, 80, 280, 720));
    vi.spyOn(shell.card, 'getBoundingClientRect').mockReturnValue(rect(900, 120, 1200, 720));
    const measurement = shell.measureSafeInsets();
    expect(measurement.rectangles).toEqual(expect.arrayContaining([
      { left: 0, top: 80, right: 280, bottom: 720 },
      { left: 900, top: 120, right: 1200, bottom: 720 },
    ]));
    expect(measurement.insets).toMatchObject({ left: 280, right: 300 });
  });

  it('preserves the Task 8 compatibility methods and cleans up listeners idempotently', () => {
    const { root, shell, options } = mount(); shell.setSelected('elastocalorics');
    expect(shell.card.textContent).toContain('Elastocalorics');
    shell.setWebGLStatus('failed'); expect(root.querySelector('[role=alert]')).not.toBeNull();
    shell.setReducedMotion(true);
    expect(root.querySelector('button[data-reduced-motion]')?.getAttribute('aria-pressed')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(options.onOverview).toHaveBeenCalledOnce();
    shell.dispose(); shell.dispose();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(options.onOverview).toHaveBeenCalledOnce();
  });
});
