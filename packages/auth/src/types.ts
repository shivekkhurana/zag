export interface AgentRegistration {
  agent_id: string;
  public_key: string;
  name?: string;
  registered_at: string;
  status: 'active' | 'revoked';
}

export interface VerifyOptions {
  method: string;
  path: string;
  timestamp: string;
  body?: string;
  signature: string;
  publicKey: string;
}

import type { Storage } from './storage/interface.js';

export interface ZagAuthOptions {
  storage: Storage;
  /** Manifest object - used to compute and send X-ZAG-Revision header */
  manifest: Record<string, unknown>;
  maxTimestampDrift?: number; // in seconds, default 30
}
