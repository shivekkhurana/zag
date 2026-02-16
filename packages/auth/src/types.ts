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

export interface ZagAuthOptions {
  keysDir: string;
  maxTimestampDrift?: number; // in seconds, default 30
}
