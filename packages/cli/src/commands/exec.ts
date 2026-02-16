import { Command, Args, Flags } from '@oclif/core';
import { loadManifest, loadAgent, loadPrivateKey, serviceExists } from '../lib/config.js';
import { importPrivateKey } from '../lib/crypto.js';
import { buildSigningString, signRequest, substitutePath, sendRequest } from '../lib/request.js';
import { ui } from '../lib/ui.js';

export default class Exec extends Command {
  static override description = 'Execute an action on a service';

  static override args = {
    url: Args.string({
      description: 'Service URL (e.g., http://localhost:8000)',
      required: true,
    }),
    action: Args.string({
      description: 'Action ID to execute',
      required: true,
    }),
  };

  static override flags = {
    data: Flags.string({
      char: 'd',
      description: 'JSON data to send with the request',
    }),
  };

  static override examples = [
    '<%= config.bin %> exec http://localhost:8000 list-todos',
    '<%= config.bin %> exec http://localhost:8000 create-todo --data \'{"title":"Test"}\'',
    '<%= config.bin %> exec http://localhost:8000 delete-todo --data \'{"id":"1"}\'',
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Exec);
    const { url: serviceUrl, action: actionId } = args;
    const { data } = flags;

    // Check service exists
    if (!serviceExists(serviceUrl)) {
      console.log(ui.error(`Service ${serviceUrl} is not registered.`));
      console.log(`Run "zag setup ${serviceUrl}" first.`);
      this.exit(1);
    }

    // Load manifest
    const manifest = await loadManifest(serviceUrl);
    if (!manifest) {
      console.log(ui.error('Failed to load manifest.'));
      this.exit(1);
    }

    // Find action
    const action = manifest.actions.find((a) => a.id === actionId);
    if (!action) {
      console.log(ui.error(`Action "${actionId}" not found.`));
      console.log('Available actions:');
      manifest.actions.forEach((a) => {
        console.log(`  - ${a.id}: ${a.method} ${a.path}`);
      });
      this.exit(1);
    }

    // Load agent
    const agent = await loadAgent(serviceUrl);
    if (!agent) {
      console.log(ui.error('Failed to load agent data.'));
      this.exit(1);
    }

    // Load private key
    const privateKeyPem = await loadPrivateKey(serviceUrl);
    const privateKey = importPrivateKey(privateKeyPem);

    // Parse data for path parameters
    let parsedData: Record<string, string> = {};
    let body: string | undefined;

    if (data) {
      try {
        parsedData = JSON.parse(data);
        // For non-GET methods, the full data becomes the body
        if (action.method !== 'GET') {
          body = data;
        }
      } catch {
        console.log(ui.error('Invalid JSON data.'));
        this.exit(1);
      }
    }

    // Substitute path parameters
    const actionPath = substitutePath(action.path, parsedData);

    // Build signing string (action.path is the full path from service root)
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signingString = buildSigningString(action.method, actionPath, timestamp, body);

    // Sign request
    const signature = signRequest(signingString, privateKey);

    // Send request
    const response = await sendRequest({
      serviceUrl,
      actionPath,
      method: action.method,
      body,
      agentId: agent.agent_id,
      signature,
      timestamp,
    });

    // Output response body to stdout
    const responseText = await response.text();
    this.log(responseText);

    // Exit with appropriate code
    if (!response.ok) {
      this.exit(1);
    }
  }
}
