import { Command, Args, Flags } from '@oclif/core';
import { randomUUID } from 'crypto';
import { createInterface } from 'readline';
import { fetchManifest } from '../lib/manifest.js';
import { generateKeyPair, exportPublicKey } from '../lib/crypto.js';
import { saveKeys, saveAgent, saveManifest, serviceExists } from '../lib/config.js';
import { buildRegistrationUrl } from '../lib/request.js';
import { ui } from '../lib/ui.js';
import type { AgentData } from '../types/manifest.js';

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/n) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export default class Setup extends Command {
  static override description = 'Set up authentication with a service';

  static override args = {
    url: Args.string({
      description: 'Service URL with protocol (e.g., http://localhost:8000 or https://api.example.com)',
      required: true,
    }),
  };

  static override flags = {
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompt',
      default: false,
    }),
  };

  static override examples = [
    '<%= config.bin %> setup http://localhost:8000',
    '<%= config.bin %> setup https://api.example.com',
    '<%= config.bin %> setup -y http://localhost:8000',
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Setup);
    const serviceUrl = args.url;
    const skipConfirm = flags.yes;

    // Validate URL includes protocol
    if (!serviceUrl.startsWith('http://') && !serviceUrl.startsWith('https://')) {
      console.log(ui.error('Service URL must include protocol (http:// or https://).'));
      console.log('');
      console.log(ui.examples());
      console.log('  zag setup http://localhost:8000');
      console.log('  zag setup https://api.example.com');
      this.exit(1);
    }

    // Check if already registered
    if (serviceExists(serviceUrl)) {
      console.log(ui.error(`Service ${serviceUrl} is already registered.`));
      console.log('Use "zag update" to refresh the manifest.');
      this.exit(1);
    }

    // Fetch manifest
    this.log(`Fetching manifest from ${serviceUrl}...`);
    let manifest;
    try {
      manifest = await fetchManifest(serviceUrl);
    } catch (error) {
      console.log(ui.error(`Failed to fetch manifest: ${error instanceof Error ? error.message : error}`));
      this.exit(1);
    }

    // Display service info
    this.log('');
    this.log(ui.label('Service:', manifest.name));
    if (manifest.description) {
      this.log(ui.label('Description:', manifest.description));
    }
    this.log(ui.label('Actions:', String(manifest.actions.length)));
    manifest.actions.forEach((action) => {
      this.log(`  - ${action.id}: ${action.method} ${action.path}`);
    });
    this.log('');

    // Confirm (skip if -y flag is passed)
    if (!skipConfirm) {
      const confirmed = await confirm('Register with this service?');
      if (!confirmed) {
        this.log('Aborted.');
        this.exit(0);
      }
    }

    // Generate keypair
    this.log('Generating Ed25519 keypair...');
    const { publicKey, privateKey } = generateKeyPair();
    const publicKeyBase64 = exportPublicKey(publicKey);

    // Generate agent ID
    const agentId = randomUUID();

    // Register with service
    this.log('Registering with service...');
    const registerUrl = buildRegistrationUrl(serviceUrl, manifest.register);

    const response = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentId,
        public_key: publicKeyBase64,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.log(ui.error(`Registration failed: ${response.status} ${response.statusText}`));
      console.log(text);
      this.exit(1);
    }

    // Save everything locally
    await saveKeys(serviceUrl, publicKey, privateKey);

    const agentData: AgentData = {
      agent_id: agentId,
      service_path: serviceUrl,
      registered_at: new Date().toISOString(),
      status: 'active',
    };
    await saveAgent(serviceUrl, agentData);
    await saveManifest(serviceUrl, manifest);

    this.log('');
    this.log('Registration successful!');
    this.log(`Agent ID: ${agentId}`);
    this.log('');
    this.log(`Run "zag exec ${serviceUrl} <action-id>" to execute actions.`);
  }
}
