import type { Manifest } from '../src/types/manifest.js';
import type { AgentRegistration } from '@ai26/zag-auth';

export interface MockServiceOptions {
  manifest: Manifest;
  onRegister?: (data: { agent_id: string; public_key: string }) => { success: boolean; error?: string };
  latency?: number;
  failManifest?: boolean;
  failRegister?: boolean;
}

export interface MockServiceState {
  registeredAgents: Map<string, AgentRegistration>;
  fetchCalls: { url: string; options?: RequestInit }[];
}

/**
 * Creates a mock fetch function that simulates a ZAG-compatible service
 */
export function createMockService(options: MockServiceOptions): {
  fetch: typeof globalThis.fetch;
  state: MockServiceState;
  restore: () => void;
} {
  const state: MockServiceState = {
    registeredAgents: new Map(),
    fetchCalls: [],
  };

  const originalFetch = globalThis.fetch;

  const mockFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    state.fetchCalls.push({ url, options: init });

    // Simulate latency
    if (options.latency) {
      await new Promise((resolve) => setTimeout(resolve, options.latency));
    }

    // Parse URL
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;

    // Handle manifest request
    if (path.endsWith('/.zeroagentgate/manifest.json')) {
      if (options.failManifest) {
        return new Response('Service unavailable', { status: 503 });
      }
      return new Response(JSON.stringify(options.manifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle registration request
    if (path.endsWith(options.manifest.register) && init?.method === 'POST') {
      if (options.failRegister) {
        return new Response(JSON.stringify({ error: 'Registration failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const body = JSON.parse(init.body as string) as { agent_id: string; public_key: string };

      // Custom registration handler
      if (options.onRegister) {
        const result = options.onRegister(body);
        if (!result.success) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // Store agent
      const agent: AgentRegistration = {
        agent_id: body.agent_id,
        public_key: body.public_key,
        registered_at: new Date().toISOString(),
        status: 'active',
      };
      state.registeredAgents.set(body.agent_id, agent);

      return new Response(
        JSON.stringify({ success: true, agent_id: body.agent_id }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Unknown endpoint
    return new Response('Not found', { status: 404 });
  };

  // Install mock
  globalThis.fetch = mockFetch as typeof globalThis.fetch;

  return {
    fetch: mockFetch as typeof globalThis.fetch,
    state,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

/**
 * Creates a standard test manifest
 */
export function createTestManifest(overrides?: Partial<Manifest>): Manifest {
  return {
    version: 'v0',
    name: 'Test Service',
    description: 'A test service for unit testing',
    register: '/api/auth/register',
    actions: [
      {
        id: 'test-action',
        method: 'GET',
        path: '/api/test',
        description: 'A test action',
      },
      {
        id: 'create-item',
        method: 'POST',
        path: '/api/items',
        description: 'Create an item',
      },
      {
        id: 'delete-item',
        method: 'DELETE',
        path: '/api/items/:id',
        description: 'Delete an item',
      },
    ],
    ...overrides,
  };
}
