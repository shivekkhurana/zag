import type { AgentRegistration } from '../types.js';
import type { Storage } from './interface.js';

/**
 * Drizzle storage adapter for agent registrations
 *
 * Usage:
 * ```ts
 * import { pgTable, text } from 'drizzle-orm/pg-core';
 * import { drizzle } from 'drizzle-orm/node-postgres';
 * import { eq } from 'drizzle-orm';
 *
 * const agents = pgTable('agents', {
 *   agent_id: text('agent_id').primaryKey(),
 *   public_key: text('public_key').notNull(),
 *   name: text('name'),
 *   registered_at: text('registered_at').notNull(),
 *   status: text('status').notNull(),
 * });
 *
 * const db = drizzle(pool);
 * const storage = new DrizzleStorage({
 *   getAgent: async (agentId) => {
 *     const results = await db.select().from(agents).where(eq(agents.agent_id, agentId));
 *     return results[0] ?? null;
 *   },
 *   saveAgent: async (agent) => {
 *     await db.insert(agents).values(agent).onConflictDoUpdate({
 *       target: agents.agent_id,
 *       set: agent,
 *     });
 *   },
 *   deleteAgent: async (agentId) => {
 *     await db.delete(agents).where(eq(agents.agent_id, agentId));
 *   },
 * });
 * ```
 */

interface AgentRow {
  agent_id: string;
  public_key: string;
  name: string | null;
  registered_at: string;
  status: string;
}

export interface DrizzleStorageOptions {
  getAgent: (agentId: string) => Promise<AgentRow | null | undefined>;
  saveAgent: (agent: AgentRow) => Promise<void>;
  deleteAgent?: (agentId: string) => Promise<void>;
}

/**
 * Drizzle ORM storage adapter for agent registrations
 *
 * This adapter provides a thin wrapper around user-provided Drizzle queries,
 * allowing full flexibility in how agents are stored and retrieved.
 */
export class DrizzleStorage implements Storage {
  private opts: DrizzleStorageOptions;

  constructor(opts: DrizzleStorageOptions) {
    this.opts = opts;
  }

  async getAgent(agentId: string): Promise<AgentRegistration | null> {
    const row = await this.opts.getAgent(agentId);

    if (!row) {
      return null;
    }

    return {
      agent_id: row.agent_id,
      public_key: row.public_key,
      name: row.name ?? undefined,
      registered_at: row.registered_at,
      status: row.status as 'active' | 'revoked',
    };
  }

  async saveAgent(agent: AgentRegistration): Promise<void> {
    const row: AgentRow = {
      agent_id: agent.agent_id,
      public_key: agent.public_key,
      name: agent.name ?? null,
      registered_at: agent.registered_at,
      status: agent.status,
    };

    await this.opts.saveAgent(row);
  }

  async deleteAgent(agentId: string): Promise<void> {
    if (this.opts.deleteAgent) {
      await this.opts.deleteAgent(agentId);
    }
  }
}
