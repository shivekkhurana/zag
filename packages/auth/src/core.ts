import { verify as cryptoVerify, createPublicKey } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { AgentRegistration, VerifyOptions } from './types.js';

export type { AgentRegistration, VerifyOptions, ZagAuthOptions } from './types.js';

/**
 * Build the canonical signing string for request verification
 */
export function buildSigningString(
  method: string,
  path: string,
  timestamp: string,
  body?: string
): string {
  const parts = [method.toUpperCase(), path, timestamp];
  if (body && body.length > 0) {
    parts.push(body);
  }
  return parts.join('\n');
}

/**
 * Verify an Ed25519 signature
 */
export function verify(opts: VerifyOptions): boolean {
  const { method, path, timestamp, body, signature, publicKey } = opts;

  try {
    const signingString = buildSigningString(method, path, timestamp, body);
    const signatureBuffer = Buffer.from(signature, 'base64');

    // Create public key object from base64-encoded raw key
    const publicKeyBuffer = Buffer.from(publicKey, 'base64');
    const keyObject = createPublicKey({
      key: Buffer.concat([
        // Ed25519 public key DER prefix
        Buffer.from('302a300506032b6570032100', 'hex'),
        publicKeyBuffer,
      ]),
      format: 'der',
      type: 'spki',
    });

    return cryptoVerify(
      null,
      Buffer.from(signingString),
      keyObject,
      signatureBuffer
    );
  } catch {
    return false;
  }
}

/**
 * Load an agent registration from the filesystem
 */
export async function loadAgent(
  agentId: string,
  keysDir: string
): Promise<AgentRegistration | null> {
  try {
    const agentPath = join(keysDir, `${agentId}.json`);
    const data = await readFile(agentPath, 'utf-8');
    return JSON.parse(data) as AgentRegistration;
  } catch {
    return null;
  }
}

/**
 * Save an agent registration to the filesystem
 */
export async function saveAgent(
  agent: AgentRegistration,
  keysDir: string
): Promise<void> {
  await mkdir(keysDir, { recursive: true });
  const agentPath = join(keysDir, `${agent.agent_id}.json`);
  await writeFile(agentPath, JSON.stringify(agent, null, 2), 'utf-8');
}
