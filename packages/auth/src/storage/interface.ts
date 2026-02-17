import type { AgentRegistration } from '../types.js';

/**
 * Storage interface for agent registrations
 */
export interface Storage {
  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): Promise<AgentRegistration | null>;

  /**
   * Save an agent registration
   */
  saveAgent(agent: AgentRegistration): Promise<void>;

  /**
   * Delete an agent by ID
   */
  deleteAgent?(agentId: string): Promise<void>;

  /**
   * List all agents (optional)
   */
  listAgents?(): Promise<AgentRegistration[]>;
}
