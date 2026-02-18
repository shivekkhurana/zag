import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { $ } from 'bun';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import {
  setConfigDir,
  saveAgent,
  saveManifest,
  listServices,
  serviceExists,
} from '../src/lib/config.js';
import { createTestManifest } from './mock-service.js';
import type { AgentData } from '../src/types/manifest.js';

const CLI_PATH = join(import.meta.dir, '../bin/run.js');

describe('Config Flag (-c/--config)', () => {
  let configDirA: string;
  let configDirB: string;

  beforeEach(() => {
    // Create two separate config directories
    configDirA = join(tmpdir(), `zag-test-A-${randomUUID()}`);
    configDirB = join(tmpdir(), `zag-test-B-${randomUUID()}`);

    mkdirSync(join(configDirA, 'services'), { recursive: true });
    mkdirSync(join(configDirB, 'services'), { recursive: true });
  });

  afterEach(() => {
    // Reset config dir
    setConfigDir(null);

    // Cleanup
    if (existsSync(configDirA)) {
      rmSync(configDirA, { recursive: true, force: true });
    }
    if (existsSync(configDirB)) {
      rmSync(configDirB, { recursive: true, force: true });
    }
  });

  it('setConfigDir switches between config directories', async () => {
    // Setup: Add a service to configDirA
    setConfigDir(configDirA);
    const servicePath = 'http://test-service-a:8000';
    const agentData: AgentData = {
      agent_id: 'agent-a',
      service_path: servicePath,
      registered_at: new Date().toISOString(),
      status: 'active',
    };
    await saveAgent(servicePath, agentData);
    await saveManifest(servicePath, createTestManifest());

    // Verify configDirA has 1 service
    const servicesA = await listServices();
    expect(servicesA.length).toBe(1);
    expect(servicesA[0]).toBe(servicePath);

    // Switch to configDirB - should have 0 services
    setConfigDir(configDirB);
    const servicesB = await listServices();
    expect(servicesB.length).toBe(0);

    // Switch back to configDirA - should still have 1 service
    setConfigDir(configDirA);
    const servicesA2 = await listServices();
    expect(servicesA2.length).toBe(1);

    setConfigDir(null);
  });

  it('ls command uses -c flag to select config directory', async () => {
    // Setup: Add a service to configDirA only
    setConfigDir(configDirA);
    const servicePath = 'http://test-service:8000';
    await saveAgent(servicePath, {
      agent_id: 'test-agent',
      service_path: servicePath,
      registered_at: new Date().toISOString(),
      status: 'active',
    });
    await saveManifest(servicePath, createTestManifest());
    setConfigDir(null);

    // Run ls with -c pointing to configDirA
    const outputA = await $`bun ${CLI_PATH} ls -c ${configDirA}`.text();
    expect(outputA).toContain('http://test-service:8000');

    // Run ls with -c pointing to configDirB (empty)
    const outputB = await $`bun ${CLI_PATH} ls -c ${configDirB}`.text();
    expect(outputB).toContain('No registered services found');
  });

  it('status command uses -c flag to select config directory', async () => {
    // Setup: Add a service to configDirA
    setConfigDir(configDirA);
    const servicePath = 'http://status-test:8000';
    await saveAgent(servicePath, {
      agent_id: 'status-agent-123',
      service_path: servicePath,
      registered_at: new Date().toISOString(),
      status: 'active',
    });
    await saveManifest(servicePath, createTestManifest());
    setConfigDir(null);

    // Run status with -c pointing to configDirA
    const output = await $`bun ${CLI_PATH} status ${servicePath} -c ${configDirA}`.text();
    expect(output).toContain('status-agent-123');
    expect(output).toContain('active');
  });

  it('rm command uses -c flag to remove from correct directory', async () => {
    // Setup: Add a service to configDirA
    setConfigDir(configDirA);
    const servicePath = 'http://rm-test:8000';
    await saveAgent(servicePath, {
      agent_id: 'rm-agent',
      service_path: servicePath,
      registered_at: new Date().toISOString(),
      status: 'active',
    });
    await saveManifest(servicePath, createTestManifest());

    // Verify service exists
    expect(serviceExists(servicePath)).toBe(true);
    setConfigDir(null);

    // Run rm with -c pointing to configDirA
    const output = await $`bun ${CLI_PATH} rm ${servicePath} -c ${configDirA}`.text();
    expect(output).toContain('Removed');

    // Verify service was removed from configDirA
    setConfigDir(configDirA);
    expect(serviceExists(servicePath)).toBe(false);
    const services = await listServices();
    expect(services.length).toBe(0);
    setConfigDir(null);
  });

  it('different config directories are fully isolated', async () => {
    // Add service to configDirA
    setConfigDir(configDirA);
    await saveAgent('http://service-a:8000', {
      agent_id: 'agent-a',
      service_path: 'http://service-a:8000',
      registered_at: new Date().toISOString(),
      status: 'active',
    });
    await saveManifest('http://service-a:8000', createTestManifest());

    // Add different service to configDirB
    setConfigDir(configDirB);
    await saveAgent('http://service-b:9000', {
      agent_id: 'agent-b',
      service_path: 'http://service-b:9000',
      registered_at: new Date().toISOString(),
      status: 'active',
    });
    await saveManifest('http://service-b:9000', createTestManifest());
    setConfigDir(null);

    // Verify isolation via ls command with -c
    const outputA = await $`bun ${CLI_PATH} ls -c ${configDirA}`.text();
    expect(outputA).toContain('http://service-a:8000');
    expect(outputA).not.toContain('http://service-b:9000');

    const outputB = await $`bun ${CLI_PATH} ls --config ${configDirB}`.text();
    expect(outputB).toContain('http://service-b:9000');
    expect(outputB).not.toContain('http://service-a:8000');
  });
});
