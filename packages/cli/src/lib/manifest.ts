import type { Manifest } from '../types/manifest.js';

/**
 * Validate that URL has protocol
 */
export function validateServiceUrl(url: string): void {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('Service URL must include protocol (http:// or https://)');
  }
}

/**
 * Build the manifest URL from a service URL
 */
export function buildManifestUrl(serviceUrl: string): string {
  validateServiceUrl(serviceUrl);
  const base = serviceUrl.endsWith('/') ? serviceUrl.slice(0, -1) : serviceUrl;
  return `${base}/.zeroagentgate/manifest.json`;
}

/**
 * Fetch manifest from a service
 */
export async function fetchManifest(path: string): Promise<Manifest> {
  const url = buildManifestUrl(path);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
  }

  const manifest = (await response.json()) as Manifest;
  validateManifest(manifest);

  return manifest;
}

/**
 * Validate manifest against v0 schema
 */
export function validateManifest(manifest: unknown): asserts manifest is Manifest {
  if (typeof manifest !== 'object' || manifest === null) {
    throw new Error('Manifest must be an object');
  }

  const m = manifest as Record<string, unknown>;

  if (m['version'] !== 'v0') {
    throw new Error(`Unsupported manifest version: ${m['version']}`);
  }

  if (typeof m['name'] !== 'string' || m['name'].length === 0) {
    throw new Error('Manifest must have a name');
  }

  if (typeof m['register'] !== 'string' || m['register'].length === 0) {
    throw new Error('Manifest must have a register endpoint');
  }

  if (!Array.isArray(m['actions'])) {
    throw new Error('Manifest must have an actions array');
  }

  for (const action of m['actions']) {
    validateAction(action);
  }
}

function validateAction(action: unknown): void {
  if (typeof action !== 'object' || action === null) {
    throw new Error('Action must be an object');
  }

  const a = action as Record<string, unknown>;

  if (typeof a['id'] !== 'string' || a['id'].length === 0) {
    throw new Error('Action must have an id');
  }

  const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  if (typeof a['method'] !== 'string' || !validMethods.includes(a['method'])) {
    throw new Error(`Action ${a['id']} must have a valid method`);
  }

  if (typeof a['path'] !== 'string' || a['path'].length === 0) {
    throw new Error(`Action ${a['id']} must have a path`);
  }
}
