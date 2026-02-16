import {
  generateKeyPairSync,
  sign as cryptoSign,
  createPrivateKey,
  KeyObject,
} from 'crypto';

export interface KeyPair {
  publicKey: KeyObject;
  privateKey: KeyObject;
}

/**
 * Generate an Ed25519 keypair
 */
export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { publicKey, privateKey };
}

/**
 * Sign a string with Ed25519 private key
 */
export function sign(signingString: string, privateKey: KeyObject): string {
  const signature = cryptoSign(null, Buffer.from(signingString), privateKey);
  return signature.toString('base64');
}

/**
 * Export public key as base64 (raw 32-byte key)
 */
export function exportPublicKey(publicKey: KeyObject): string {
  const der = publicKey.export({ type: 'spki', format: 'der' });
  // Ed25519 SPKI DER has a 12-byte prefix, raw key is last 32 bytes
  const rawKey = der.subarray(12);
  return rawKey.toString('base64');
}

/**
 * Export private key as PEM
 */
export function exportPrivateKeyPem(privateKey: KeyObject): string {
  return privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
}

/**
 * Export public key as PEM
 */
export function exportPublicKeyPem(publicKey: KeyObject): string {
  return publicKey.export({ type: 'spki', format: 'pem' }) as string;
}

/**
 * Import private key from PEM
 */
export function importPrivateKey(pem: string): KeyObject {
  return createPrivateKey({
    key: pem,
    format: 'pem',
    type: 'pkcs8',
  });
}
