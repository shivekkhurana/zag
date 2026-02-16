export interface ManifestAction {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description?: string;
  params?: {
    name: string;
    type: 'string' | 'number' | 'boolean';
    required?: boolean;
    description?: string;
  }[];
}

export interface Manifest {
  version: 'v0';
  name: string;
  description?: string;
  register: string;
  actions: ManifestAction[];
}

export interface AgentData {
  agent_id: string;
  service_path: string;
  registered_at: string;
  status: 'active' | 'revoked';
}
