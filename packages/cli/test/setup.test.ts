import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createMockService, createTestManifest } from './mock-service.js';
import { createTestEnvironment, type TestEnvironment } from './test-utils.js';
import { fetchManifest, validateManifest, validateServiceUrl } from '../src/lib/manifest.js';
import { generateKeyPair, exportPublicKey, sign, importPrivateKey, exportPrivateKeyPem } from '../src/lib/crypto.js';
import { buildSigningString, substitutePath } from '../src/lib/request.js';
import {
  saveKeys,
  saveAgent,
  saveManifest,
  loadAgent,
  loadManifest,
  loadPrivateKey,
  serviceExists,
  listServices,
  getServiceDir,
  removeService,
} from '../src/lib/config.js';
import type { AgentData } from '../src/types/manifest.js';

describe('Manifest Utilities', () => {
  describe('validateServiceUrl', () => {
    it('accepts http URLs', () => {
      expect(() => validateServiceUrl('http://localhost:8000')).not.toThrow();
      expect(() => validateServiceUrl('http://127.0.0.1:8000')).not.toThrow();
    });

    it('accepts https URLs', () => {
      expect(() => validateServiceUrl('https://api.example.com')).not.toThrow();
      expect(() => validateServiceUrl('https://example.com:443')).not.toThrow();
    });

    it('rejects URLs without protocol', () => {
      expect(() => validateServiceUrl('localhost:8000')).toThrow('must include protocol');
      expect(() => validateServiceUrl('api.example.com')).toThrow('must include protocol');
    });
  });

  describe('validateManifest', () => {
    it('validates a correct manifest', () => {
      const manifest = createTestManifest();
      expect(() => validateManifest(manifest)).not.toThrow();
    });

    it('rejects manifest without version', () => {
      const manifest = { name: 'Test', register: '/reg', actions: [] };
      expect(() => validateManifest(manifest)).toThrow('Unsupported manifest version');
    });

    it('rejects manifest without name', () => {
      const manifest = { version: 'v0', register: '/reg', actions: [] };
      expect(() => validateManifest(manifest)).toThrow('must have a name');
    });

    it('rejects manifest with invalid action', () => {
      const manifest = {
        version: 'v0',
        name: 'Test',
        register: '/reg',
        actions: [{ id: 'test', method: 'INVALID', path: '/test' }],
      };
      expect(() => validateManifest(manifest)).toThrow('valid method');
    });
  });

  describe('fetchManifest', () => {
    let mockService: ReturnType<typeof createMockService>;

    afterEach(() => {
      mockService?.restore();
    });

    it('fetches and parses manifest', async () => {
      const testManifest = createTestManifest();
      mockService = createMockService({ manifest: testManifest });

      const manifest = await fetchManifest('http://localhost:9999');

      expect(manifest.name).toBe('Test Service');
      expect(manifest.actions.length).toBe(3);
      expect(mockService.state.fetchCalls.length).toBe(1);
      expect(mockService.state.fetchCalls[0]?.url).toBe('http://localhost:9999/.zeroagentgate/manifest.json');
    });

    it('throws on failed fetch', async () => {
      mockService = createMockService({
        manifest: createTestManifest(),
        failManifest: true,
      });

      await expect(fetchManifest('http://localhost:9999')).rejects.toThrow('Failed to fetch manifest');
    });
  });
});

describe('Crypto Utilities', () => {
  describe('generateKeyPair', () => {
    it('generates valid Ed25519 keypair', () => {
      const { publicKey, privateKey } = generateKeyPair();

      expect(publicKey.type).toBe('public');
      expect(privateKey.type).toBe('private');
      expect(publicKey.asymmetricKeyType).toBe('ed25519');
      expect(privateKey.asymmetricKeyType).toBe('ed25519');
    });
  });

  describe('exportPublicKey', () => {
    it('exports public key as base64', () => {
      const { publicKey } = generateKeyPair();
      const exported = exportPublicKey(publicKey);

      expect(typeof exported).toBe('string');
      // Ed25519 public keys are 32 bytes, base64 encoded = 44 chars (with padding)
      expect(exported.length).toBe(44);
    });
  });

  describe('sign and verify', () => {
    it('signs data correctly', () => {
      const { privateKey } = generateKeyPair();
      const data = 'test signing string';

      const signature = sign(data, privateKey);

      expect(typeof signature).toBe('string');
      // Ed25519 signatures are 64 bytes, base64 encoded = 88 chars
      expect(signature.length).toBe(88);
    });

    it('produces different signatures for different data', () => {
      const { privateKey } = generateKeyPair();

      const sig1 = sign('data1', privateKey);
      const sig2 = sign('data2', privateKey);

      expect(sig1).not.toBe(sig2);
    });

    it('can reimport private key from PEM', () => {
      const { privateKey } = generateKeyPair();
      const pem = exportPrivateKeyPem(privateKey);
      const reimported = importPrivateKey(pem);

      const data = 'test data';
      const sig1 = sign(data, privateKey);
      const sig2 = sign(data, reimported);

      expect(sig1).toBe(sig2);
    });
  });
});

describe('Request Utilities', () => {
  describe('buildSigningString', () => {
    it('builds signing string without body', () => {
      const result = buildSigningString('GET', '/api/todos', '1699500000');
      expect(result).toBe('GET\n/api/todos\n1699500000');
    });

    it('builds signing string with body', () => {
      const result = buildSigningString('POST', '/api/todos', '1699500000', '{"title":"Test"}');
      expect(result).toBe('POST\n/api/todos\n1699500000\n{"title":"Test"}');
    });

    it('uppercases method', () => {
      const result = buildSigningString('post', '/api/todos', '1699500000');
      expect(result).toBe('POST\n/api/todos\n1699500000');
    });

    it('ignores empty body', () => {
      const result = buildSigningString('GET', '/api/todos', '1699500000', '');
      expect(result).toBe('GET\n/api/todos\n1699500000');
    });
  });

  describe('substitutePath', () => {
    it('substitutes single parameter', () => {
      const result = substitutePath('/todos/:id', { id: '123' });
      expect(result).toBe('/todos/123');
    });

    it('substitutes multiple parameters', () => {
      const result = substitutePath('/users/:userId/todos/:todoId', {
        userId: 'user1',
        todoId: 'todo1',
      });
      expect(result).toBe('/users/user1/todos/todo1');
    });

    it('leaves unmatched parameters', () => {
      const result = substitutePath('/todos/:id', {});
      expect(result).toBe('/todos/:id');
    });

    it('handles path without parameters', () => {
      const result = substitutePath('/todos', { id: '123' });
      expect(result).toBe('/todos');
    });
  });
});

describe('Config Utilities', () => {
  let testEnv: TestEnvironment;

  beforeEach(() => {
    testEnv = createTestEnvironment();
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('getServiceDir', () => {
    it('converts colons to underscores', () => {
      const dir = getServiceDir('localhost:8000');
      expect(dir).toContain('localhost_8000');
    });
  });

  describe('saveKeys and loadPrivateKey', () => {
    it('saves and loads keys', async () => {
      const { publicKey, privateKey } = generateKeyPair();
      const servicePath = 'test-service:8000';

      await saveKeys(servicePath, publicKey, privateKey);

      const loadedPem = await loadPrivateKey(servicePath);
      const reimported = importPrivateKey(loadedPem);

      // Verify the reimported key works
      const sig = sign('test', reimported);
      expect(sig.length).toBe(88);
    });
  });

  describe('saveAgent and loadAgent', () => {
    it('saves and loads agent data', async () => {
      const servicePath = 'test-service:8000';
      const agentData: AgentData = {
        agent_id: 'test-agent-id',
        service_path: servicePath,
        registered_at: new Date().toISOString(),
        status: 'active',
      };

      await saveAgent(servicePath, agentData);
      const loaded = await loadAgent(servicePath);

      expect(loaded).not.toBeNull();
      expect(loaded?.agent_id).toBe('test-agent-id');
      expect(loaded?.status).toBe('active');
    });

    it('returns null for non-existent agent', async () => {
      const loaded = await loadAgent('non-existent-service');
      expect(loaded).toBeNull();
    });
  });

  describe('saveManifest and loadManifest', () => {
    it('saves and loads manifest', async () => {
      const servicePath = 'test-service:8000';
      const manifest = createTestManifest();

      await saveManifest(servicePath, manifest);
      const loaded = await loadManifest(servicePath);

      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe('Test Service');
      expect(loaded?.actions.length).toBe(3);
    });
  });

  describe('serviceExists', () => {
    it('returns false for non-existent service', () => {
      expect(serviceExists('non-existent')).toBe(false);
    });

    it('returns true for existing service', async () => {
      const servicePath = 'existing-service:8000';
      const agentData: AgentData = {
        agent_id: 'test-id',
        service_path: servicePath,
        registered_at: new Date().toISOString(),
        status: 'active',
      };

      await saveAgent(servicePath, agentData);
      expect(serviceExists(servicePath)).toBe(true);
    });
  });

  describe('listServices', () => {
    it('returns empty array when no services', async () => {
      const services = await listServices();
      expect(services).toEqual([]);
    });

    it('lists registered services', async () => {
      const servicePath1 = 'service1:8000';
      const servicePath2 = 'service2:9000';

      await saveAgent(servicePath1, {
        agent_id: 'agent1',
        service_path: servicePath1,
        registered_at: new Date().toISOString(),
        status: 'active',
      });

      await saveAgent(servicePath2, {
        agent_id: 'agent2',
        service_path: servicePath2,
        registered_at: new Date().toISOString(),
        status: 'active',
      });

      const services = await listServices();
      expect(services.length).toBe(2);
      expect(services).toContain('service1:8000');
      expect(services).toContain('service2:9000');
    });
  });

  describe('removeService', () => {
    it('removes an existing service', async () => {
      const servicePath = 'to-remove:8000';

      // Create a service
      const { publicKey, privateKey } = generateKeyPair();
      await saveKeys(servicePath, publicKey, privateKey);
      await saveAgent(servicePath, {
        agent_id: 'test-agent',
        service_path: servicePath,
        registered_at: new Date().toISOString(),
        status: 'active',
      });
      await saveManifest(servicePath, createTestManifest());

      expect(serviceExists(servicePath)).toBe(true);

      // Remove it
      await removeService(servicePath);

      expect(serviceExists(servicePath)).toBe(false);
    });

    it('does not throw when removing non-existent service', async () => {
      // Should complete without throwing
      await removeService('non-existent:9999');
      expect(true).toBe(true);
    });

    it('updates listServices after removal', async () => {
      const servicePath1 = 'keep-me:8000';
      const servicePath2 = 'remove-me:9000';

      await saveAgent(servicePath1, {
        agent_id: 'agent1',
        service_path: servicePath1,
        registered_at: new Date().toISOString(),
        status: 'active',
      });

      await saveAgent(servicePath2, {
        agent_id: 'agent2',
        service_path: servicePath2,
        registered_at: new Date().toISOString(),
        status: 'active',
      });

      let services = await listServices();
      expect(services.length).toBe(2);

      await removeService(servicePath2);

      services = await listServices();
      expect(services.length).toBe(1);
      expect(services).toContain('keep-me:8000');
      expect(services).not.toContain('remove-me:9000');
    });
  });
});

describe('Full Setup Flow', () => {
  let mockService: ReturnType<typeof createMockService>;
  let testEnv: TestEnvironment;

  beforeEach(() => {
    testEnv = createTestEnvironment();
  });

  afterEach(() => {
    mockService?.restore();
    testEnv.cleanup();
  });

  it('completes full registration flow', async () => {
    const testManifest = createTestManifest();
    mockService = createMockService({ manifest: testManifest });

    const serviceUrl = 'http://localhost:9999';

    // 1. Fetch manifest
    const manifest = await fetchManifest(serviceUrl);
    expect(manifest.name).toBe('Test Service');

    // 2. Generate keypair
    const { publicKey, privateKey } = generateKeyPair();
    const publicKeyBase64 = exportPublicKey(publicKey);

    // 3. Register with service
    const agentId = 'test-agent-' + Date.now();
    const registerUrl = `${serviceUrl}${manifest.register}`;

    const response = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentId,
        public_key: publicKeyBase64,
      }),
    });

    expect(response.ok).toBe(true);
    const result = await response.json();
    expect(result.success).toBe(true);

    // 4. Verify agent was stored in mock
    expect(mockService.state.registeredAgents.has(agentId)).toBe(true);

    // 5. Save locally
    await saveKeys(serviceUrl, publicKey, privateKey);
    await saveAgent(serviceUrl, {
      agent_id: agentId,
      service_path: serviceUrl,
      registered_at: new Date().toISOString(),
      status: 'active',
    });
    await saveManifest(serviceUrl, manifest);

    // 6. Verify local storage
    expect(serviceExists(serviceUrl)).toBe(true);
    const loadedAgent = await loadAgent(serviceUrl);
    expect(loadedAgent?.agent_id).toBe(agentId);
  });

  it('handles registration rejection', async () => {
    const testManifest = createTestManifest();
    mockService = createMockService({
      manifest: testManifest,
      onRegister: () => ({ success: false, error: 'Agent limit reached' }),
    });

    const registerUrl = `http://localhost:9999${testManifest.register}`;
    const response = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: 'test-agent',
        public_key: 'test-key',
      }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);
  });

  it('handles service unavailable', async () => {
    mockService = createMockService({
      manifest: createTestManifest(),
      failManifest: true,
    });

    await expect(fetchManifest('http://localhost:9999')).rejects.toThrow();
  });
});

describe('End-to-End Request Signing', () => {
  let testEnv: TestEnvironment;

  beforeEach(() => {
    testEnv = createTestEnvironment();
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  it('generates valid signatures that can be verified', async () => {
    // This tests the full signing flow without making actual requests

    // 1. Setup - save keys locally
    const servicePath = 'test:8000';
    const { publicKey, privateKey } = generateKeyPair();
    const publicKeyBase64 = exportPublicKey(publicKey);

    await saveKeys(servicePath, publicKey, privateKey);
    await saveAgent(servicePath, {
      agent_id: 'test-agent',
      service_path: servicePath,
      registered_at: new Date().toISOString(),
      status: 'active',
    });

    // 2. Load keys (simulating exec command)
    const loadedPem = await loadPrivateKey(servicePath);
    const loadedPrivateKey = importPrivateKey(loadedPem);

    // 3. Build and sign request
    const method = 'POST';
    const path = '/api/todos';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = '{"title":"Test"}';

    const signingString = buildSigningString(method, path, timestamp, body);
    const signature = sign(signingString, loadedPrivateKey);

    // 4. Verify using the auth package
    const { verify, buildSigningString: serverBuildSigningString } = await import('@ai26/zag-auth');

    const isValid = verify({
      method,
      path,
      timestamp,
      body,
      signature,
      publicKey: publicKeyBase64,
    });

    expect(isValid).toBe(true);
  });

  it('rejects tampered signatures', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const publicKeyBase64 = exportPublicKey(publicKey);

    const method = 'GET';
    const path = '/api/todos';
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const signingString = buildSigningString(method, path, timestamp);
    const signature = sign(signingString, privateKey);

    // Tamper with the path
    const { verify } = await import('@ai26/zag-auth');

    const isValid = verify({
      method,
      path: '/api/tampered',
      timestamp,
      signature,
      publicKey: publicKeyBase64,
    });

    expect(isValid).toBe(false);
  });
});
