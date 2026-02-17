import { readFile, writeFile, mkdir, readdir, rm } from 'fs/promises';
import { join } from 'path';
import type { AgentRegistration } from '../types.js';
import type { Storage } from './interface.js';

export interface FileSystemStorageOptions {
  directory: string;
}

/**
 * File system storage adapter for agent registrations
 */
export class FileSystemStorage implements Storage {
  private directory: string;

  constructor(opts: FileSystemStorageOptions) {
    this.directory = opts.directory;
  }

  async getAgent(agentId: string): Promise<AgentRegistration | null> {
    try {
      const agentPath = join(this.directory, `${agentId}.json`);
      const data = await readFile(agentPath, 'utf-8');
      return JSON.parse(data) as AgentRegistration;
    } catch {
      return null;
    }
  }

  async saveAgent(agent: AgentRegistration): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const agentPath = join(this.directory, `${agent.agent_id}.json`);
    await writeFile(agentPath, JSON.stringify(agent, null, 2), 'utf-8');
  }

  async deleteAgent(agentId: string): Promise<void> {
    const agentPath = join(this.directory, `${agentId}.json`);
    await rm(agentPath, { force: true });
  }

  async listAgents(): Promise<AgentRegistration[]> {
    try {
      const files = await readdir(this.directory);
      const agents: AgentRegistration[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const agentId = file.replace('.json', '');
          const agent = await this.getAgent(agentId);
          if (agent) {
            agents.push(agent);
          }
        }
      }

      return agents;
    } catch {
      return [];
    }
  }
}
