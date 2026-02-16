# ZeroAgentGate (ZAG)

Stateless CLI authentication for AI agents using Ed25519 signatures.

## What it does

ZAG provides a simple, secure way for AI agents to authenticate with services:

1. **Agents register once** with a service, generating an Ed25519 keypair
2. **Every request is signed** with the agent's private key
3. **Services verify signatures** using the agent's public key
4. **No tokens, no sessions** - pure cryptographic authentication

## Quick Start

### For AI Agents

```bash
# Install the CLI
npm install -g @ai26/zag

# Register with a service
zag setup https://api.example.com

# Execute actions
zag exec https://api.example.com list-todos
zag exec https://api.example.com create-todo --data '{"title":"Buy milk"}'

# Manage registrations
zag ls
zag status https://api.example.com
zag update https://api.example.com
zag rm https://api.example.com
```

### For Service Authors

```bash
npm install @ai26/zag-auth
```

1. Create a manifest at `/.zeroagentgate/manifest.json`:

```json
{
  "version": "v0",
  "name": "My Service",
  "description": "What my service does",
  "register": "/api/auth/register",
  "actions": [
    {
      "id": "list-items",
      "method": "GET",
      "path": "/api/items",
      "description": "List all items"
    },
    {
      "id": "create-item",
      "method": "POST",
      "path": "/api/items",
      "description": "Create a new item"
    }
  ]
}
```

2. Add the authentication middleware (Hono example):

```typescript
import { Hono } from 'hono';
import { zagAuth } from '@ai26/zag-auth/adapters/hono';
import { saveAgent, type AgentRegistration } from '@ai26/zag-auth';

const app = new Hono();

// Serve manifest
app.get('/.zeroagentgate/manifest.json', (c) => c.json(manifest));

// Registration endpoint - NOT protected
app.post('/api/auth/register', async (c) => {
  const { agent_id, public_key, name } = await c.req.json();

  const agent: AgentRegistration = {
    agent_id,
    public_key,
    name,
    registered_at: new Date().toISOString(),
    status: 'active', // or 'pending' for manual approval
  };

  await saveAgent(agent, './agents');
  return c.json({ success: true, agent_id });
});

// Apply auth middleware to protected routes
app.use('/api/*', zagAuth({ keysDir: './agents' }));

// Protected routes
app.get('/api/items', (c) => {
  const agentId = c.get('agentId'); // Access authenticated agent
  return c.json(items);
});
```

## How Authentication Works

### Request Signing

Every authenticated request includes three headers:

- `X-Agent-Id`: The agent's UUID
- `X-Timestamp`: Unix timestamp (seconds)
- `X-Signature`: Base64-encoded Ed25519 signature

The signature is computed over a canonical string:

```
<METHOD>\n<PATH>\n<TIMESTAMP>[\n<BODY>]
```

For example, a POST request:
```
POST
/api/items
1699500000
{"title":"Test"}
```

### Replay Protection

Requests are rejected if the timestamp is more than 30 seconds from the server's current time.

### Key Storage

The CLI stores keys in `~/.zeroagentgateway/services/<host>/`:
- `private.key` - PEM-encoded Ed25519 private key (chmod 600)
- `public.key` - PEM-encoded Ed25519 public key
- `agent.json` - Agent metadata (ID, registration date, status)
- `manifest.json` - Cached service manifest

## Manifest Specification (v0)

```typescript
interface Manifest {
  version: 'v0';
  name: string;
  description?: string;
  register: string;      // e.g., "/api/auth/register"
  actions: Action[];
}

interface Action {
  id: string;            // e.g., "create-item"
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;          // e.g., "/api/items" or "/api/items/:id"
  description?: string;
  params?: Param[];
}

interface Param {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  description?: string;
}
```

## CLI Commands

### `zag setup <url>`

Register with a new service.

```bash
zag setup https://api.example.com
zag setup http://localhost:8000
zag setup -y http://localhost:8000  # Skip confirmation prompt
```

### `zag exec <url> <action-id>`

Execute an action on a registered service.

```bash
zag exec https://api.example.com list-items
zag exec https://api.example.com create-item --data '{"title":"Test"}'
zag exec https://api.example.com delete-item --data '{"id":"123"}'
```

Path parameters (`:id`) are substituted from the JSON data.

### `zag ls` (alias: `list`)

List all registered services.

```bash
zag ls
zag list
```

### `zag status <url>`

Show detailed status for a service.

```bash
zag status https://api.example.com
```

### `zag update <url>`

Update the cached manifest from a service.

```bash
zag update https://api.example.com
zag update --all  # Update all services
```

### `zag rm <url>` (alias: `remove`)

Remove a registered service.

```bash
zag rm https://api.example.com
zag remove http://localhost:8000
```

## Security Notes

1. **Private keys never leave the client.** Only the public key is sent during registration.

2. **Each service gets its own keypair.** Compromising one service doesn't affect others.

3. **Signatures are time-bound.** The 30-second replay window limits the impact of captured requests.

4. **No bearer tokens.** Unlike JWTs or API keys, signatures can't be reused - each request needs a fresh signature.

## Development

This is a Bun monorepo with three packages:

```
packages/
  auth/     - @ai26/zag-auth (verification library)
  cli/      - @ai26/zag (CLI tool)
  example/  - Example Hono service
```

### Setup

```bash
cd zag
bun install
bun run build
```

### Run Example

```bash
# Terminal 1: Start the example service
cd packages/example
bun run dev

# Terminal 2: Test the CLI
zag setup http://localhost:8000
zag exec http://localhost:8000 list-todos
zag exec http://localhost:8000 create-todo --data '{"title":"Test"}'
```

## License

MIT
