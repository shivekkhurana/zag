/**
 * JSON Schema definition (subset of JSON Schema draft-07)
 */
export interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  description?: string;
  enum?: (string | number | boolean | null)[];
  default?: unknown;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | JsonSchema;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  $ref?: string;
}

export interface ManifestAction {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description?: string;
  /** @deprecated Use `input` instead */
  params?: {
    name: string;
    type: 'string' | 'number' | 'boolean';
    required?: boolean;
    description?: string;
  }[];
  /** JSON Schema for request body */
  input?: JsonSchema;
  /** JSON Schema for response body */
  output?: JsonSchema;
}

export interface Manifest {
  /** ZAG protocol version */
  version: 'v0';
  /** App schema revision - changes when actions/schemas are updated */
  revision?: string;
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
