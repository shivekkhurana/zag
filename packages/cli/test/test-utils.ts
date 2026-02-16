import { rmSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { setConfigDir } from '../src/lib/config.js';

/**
 * Creates an isolated test environment with its own config directory
 */
export interface TestEnvironment {
  configDir: string;
  servicesDir: string;
  cleanup: () => void;
}

export function createTestEnvironment(): TestEnvironment {
  const configDir = join(tmpdir(), `zag-test-${randomUUID()}`);
  const servicesDir = join(configDir, 'services');

  mkdirSync(servicesDir, { recursive: true });

  // Override the config directory
  setConfigDir(configDir);

  return {
    configDir,
    servicesDir,
    cleanup: () => {
      // Reset to default
      setConfigDir(null);

      if (existsSync(configDir)) {
        rmSync(configDir, { recursive: true, force: true });
      }
    },
  };
}

/**
 * Captures stdout/stderr during test execution
 */
export interface CapturedOutput {
  stdout: string[];
  stderr: string[];
}

export function captureOutput(): {
  output: CapturedOutput;
  restore: () => void;
} {
  const output: CapturedOutput = {
    stdout: [],
    stderr: [],
  };

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.stdout.push(chunk.toString());
    return true;
  }) as typeof process.stdout.write;

  process.stderr.write = ((chunk: string | Uint8Array) => {
    output.stderr.push(chunk.toString());
    return true;
  }) as typeof process.stderr.write;

  return {
    output,
    restore: () => {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    },
  };
}
