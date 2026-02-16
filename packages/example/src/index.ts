import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { readFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { zagAuth } from '@ai26/zag-auth/adapters/hono';
import { saveAgent, type AgentRegistration } from '@ai26/zag-auth';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = join(__dirname, '..', 'data', 'agents');

// In-memory todo storage
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
}

const todos: Todo[] = [
  {
    id: '1',
    title: 'Learn ZeroAgentGate',
    completed: false,
    created_at: new Date().toISOString(),
  },
];

// Create main app
const app = new Hono();

// Serve manifest at root
app.get('/.zeroagentgate/manifest.json', async (c) => {
  const manifestPath = join(__dirname, '..', '.zeroagentgate', 'manifest.json');
  const manifest = await readFile(manifestPath, 'utf-8');
  return c.json(JSON.parse(manifest));
});

// API routes
const api = new Hono();

// Registration endpoint - NOT protected
api.post('/auth/register', async (c) => {
  const body = await c.req.json<{ agent_id: string; public_key: string; name?: string }>();

  const { agent_id, public_key, name } = body;

  if (!agent_id || !public_key) {
    return c.json({ error: 'Missing agent_id or public_key' }, 400);
  }

  // Create agent registration (auto-approve for demo)
  const agent: AgentRegistration = {
    agent_id,
    public_key,
    name,
    registered_at: new Date().toISOString(),
    status: 'active',
  };

  // Ensure keys directory exists
  await mkdir(KEYS_DIR, { recursive: true });

  // Save agent
  await saveAgent(agent, KEYS_DIR);

  console.log(`Registered agent: ${agent_id}`);

  return c.json({
    success: true,
    agent_id,
    message: 'Agent registered successfully',
  });
});

// Apply auth middleware to all other API routes
api.use('/*', zagAuth({ keysDir: KEYS_DIR }));

// Protected routes
api.get('/todos', (c) => {
  const agentId = c.get('agentId');
  console.log(`Agent ${agentId} listing todos`);
  return c.json(todos);
});

api.post('/todos', async (c) => {
  const agentId = c.get('agentId');
  const body = await c.req.json<{ title: string }>();

  if (!body.title) {
    return c.json({ error: 'Missing title' }, 400);
  }

  const todo: Todo = {
    id: randomUUID(),
    title: body.title,
    completed: false,
    created_at: new Date().toISOString(),
  };

  todos.push(todo);
  console.log(`Agent ${agentId} created todo: ${todo.id}`);

  return c.json(todo, 201);
});

api.delete('/todos/:id', (c) => {
  const agentId = c.get('agentId');
  const id = c.req.param('id');

  const index = todos.findIndex((t) => t.id === id);
  if (index === -1) {
    return c.json({ error: 'Todo not found' }, 404);
  }

  todos.splice(index, 1);
  console.log(`Agent ${agentId} deleted todo: ${id}`);

  return c.json({ success: true });
});

// Mount API routes
app.route('/api', api);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Start server
const port = parseInt(process.env['PORT'] ?? '8000', 10);

console.log(`Starting Todo Service on port ${port}...`);
console.log(`Manifest: http://localhost:${port}/.zeroagentgate/manifest.json`);
console.log(`Register: http://localhost:${port}/api/auth/register`);

serve({
  fetch: app.fetch,
  port,
});
