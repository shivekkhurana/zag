import { mkdir, readdir, readFile, writeFile, chmod, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { KeyObject } from 'crypto';
import type { AgentData, Manifest } from '../types/manifest.js';
import { exportPrivateKeyPem, exportPublicKeyPem } from './crypto.js';

// Allow override for testing
let configDirOverride: string | null = null;

/**
 * Get the config directory (supports override for testing)
 */
function getConfigDir(): string {
  return configDirOverride ?? join(homedir(), '.zeroagentgateway');
}

/**
 * Get the services directory
 */
function getServicesDir(): string {
  return join(getConfigDir(), 'services');
}

/**
 * Set a custom config directory (for testing)
 */
export function setConfigDir(dir: string | null): void {
  configDirOverride = dir;
}

/**
 * Get the service directory for a given path
 */
export function getServiceDir(path: string): string {
  // Encode URL to filesystem-safe name
  const safePath = encodeURIComponent(path);
  return join(getServicesDir(), safePath);
}

/**
 * Ensure service directory exists
 */
export async function ensureServiceDir(path: string): Promise<string> {
  const dir = getServiceDir(path);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Save keypair to service directory with proper permissions
 */
export async function saveKeys(
  path: string,
  publicKey: KeyObject,
  privateKey: KeyObject
): Promise<void> {
  const dir = await ensureServiceDir(path);

  const publicKeyPath = join(dir, 'public.key');
  const privateKeyPath = join(dir, 'private.key');

  await writeFile(publicKeyPath, exportPublicKeyPem(publicKey), 'utf-8');
  await writeFile(privateKeyPath, exportPrivateKeyPem(privateKey), 'utf-8');

  // Set private key to readable only by owner
  await chmod(privateKeyPath, 0o600);
}

/**
 * Load private key from service directory
 */
export async function loadPrivateKey(path: string): Promise<string> {
  const dir = getServiceDir(path);
  const privateKeyPath = join(dir, 'private.key');
  return readFile(privateKeyPath, 'utf-8');
}

/**
 * Save agent data to service directory
 */
export async function saveAgent(path: string, agent: AgentData): Promise<void> {
  const dir = await ensureServiceDir(path);
  const agentPath = join(dir, 'agent.json');
  await writeFile(agentPath, JSON.stringify(agent, null, 2), 'utf-8');
}

/**
 * Load agent data from service directory
 */
export async function loadAgent(path: string): Promise<AgentData | null> {
  const dir = getServiceDir(path);
  const agentPath = join(dir, 'agent.json');

  if (!existsSync(agentPath)) {
    return null;
  }

  const data = await readFile(agentPath, 'utf-8');
  return JSON.parse(data) as AgentData;
}

/**
 * Save manifest to service directory
 */
export async function saveManifest(
  path: string,
  manifest: Manifest
): Promise<void> {
  const dir = await ensureServiceDir(path);
  const manifestPath = join(dir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Load manifest from service directory
 */
export async function loadManifest(path: string): Promise<Manifest | null> {
  const dir = getServiceDir(path);
  const manifestPath = join(dir, 'manifest.json');

  if (!existsSync(manifestPath)) {
    return null;
  }

  const data = await readFile(manifestPath, 'utf-8');
  return JSON.parse(data) as Manifest;
}

/**
 * Check if a service exists
 */
export function serviceExists(path: string): boolean {
  const dir = getServiceDir(path);
  return existsSync(join(dir, 'agent.json'));
}

/**
 * List all registered services
 */
export async function listServices(): Promise<string[]> {
  const servicesDir = getServicesDir();

  if (!existsSync(servicesDir)) {
    return [];
  }

  const entries = await readdir(servicesDir, { withFileTypes: true });
  const services: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Decode from filesystem-safe name
      const servicePath = decodeURIComponent(entry.name);
      if (serviceExists(servicePath)) {
        services.push(servicePath);
      }
    }
  }

  return services;
}

/**
 * Remove a service registration
 */
export async function removeService(path: string): Promise<void> {
  const dir = getServiceDir(path);
  await rm(dir, { recursive: true, force: true });
}
