import type { KeyObject } from 'crypto';
import { sign } from './crypto.js';

/**
 * Build the canonical signing string for a request
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
 * Sign a request
 */
export function signRequest(signingString: string, privateKey: KeyObject): string {
  return sign(signingString, privateKey);
}

/**
 * Substitute path parameters
 * e.g., /todos/:id + {"id": "123"} -> /todos/123
 */
export function substitutePath(
  path: string,
  params: Record<string, string>
): string {
  return path.replace(/:(\w+)/g, (_, key: string) => params[key] ?? `:${key}`);
}

export interface SendRequestOptions {
  serviceUrl: string;
  actionPath: string;
  method: string;
  body?: string;
  agentId: string;
  signature: string;
  timestamp: string;
}

/**
 * Send an authenticated request
 */
export async function sendRequest(opts: SendRequestOptions): Promise<Response> {
  const {
    serviceUrl,
    actionPath,
    method,
    body,
    agentId,
    signature,
    timestamp,
  } = opts;

  // Build full URL
  // serviceUrl is like http://localhost:8000
  // actionPath is like /api/todos or /api/todos/:id
  const baseUrl = serviceUrl.endsWith('/') ? serviceUrl.slice(0, -1) : serviceUrl;
  const url = `${baseUrl}${actionPath}`;

  const headers: Record<string, string> = {
    'X-Agent-Id': agentId,
    'X-Timestamp': timestamp,
    'X-Signature': signature,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body || undefined,
  });

  return response;
}

/**
 * Build registration URL from manifest
 */
export function buildRegistrationUrl(baseUrl: string, registerPath: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}${registerPath}`;
}
