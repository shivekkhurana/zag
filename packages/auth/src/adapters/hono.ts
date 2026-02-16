import type { Context, Next, MiddlewareHandler } from 'hono';
import { buildSigningString, verify, loadAgent } from '../core.js';
import type { ZagAuthOptions } from '../types.js';

declare module 'hono' {
  interface ContextVariableMap {
    agentId: string;
  }
}

/**
 * ZeroAgentGate authentication middleware for Hono
 */
export function zagAuth(opts: ZagAuthOptions): MiddlewareHandler {
  const { keysDir, maxTimestampDrift = 30 } = opts;

  return async (c: Context, next: Next) => {
    const agentId = c.req.header('X-Agent-Id');
    const timestamp = c.req.header('X-Timestamp');
    const signature = c.req.header('X-Signature');

    // Check required headers
    if (!agentId || !timestamp || !signature) {
      return c.json(
        { error: 'Missing authentication headers' },
        401
      );
    }

    // Replay protection: check timestamp is within allowed window
    const requestTime = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const drift = Math.abs(currentTime - requestTime);

    if (isNaN(requestTime) || drift > maxTimestampDrift) {
      return c.json(
        { error: 'Request timestamp out of allowed window' },
        401
      );
    }

    // Load agent
    const agent = await loadAgent(agentId, keysDir);
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 401);
    }

    if (agent.status !== 'active') {
      return c.json({ error: 'Agent is not active' }, 403);
    }

    // Get request details
    const method = c.req.method;
    const url = new URL(c.req.url);
    const path = url.pathname;

    // Get body for non-GET requests
    let body: string | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      body = await c.req.text();
    }

    // Verify signature
    const isValid = verify({
      method,
      path,
      timestamp,
      body,
      signature,
      publicKey: agent.public_key,
    });

    if (!isValid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    // Set agent ID on context for downstream handlers
    c.set('agentId', agentId);

    await next();
  };
}
