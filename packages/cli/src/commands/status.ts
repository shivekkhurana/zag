import { Command, Args } from '@oclif/core';
import { loadAgent, loadManifest, serviceExists, setConfigDir } from '../lib/config.js';
import { ui } from '../lib/ui.js';
import { globalFlags } from '../lib/flags.js';

export default class Status extends Command {
  static override description = 'Show status for a registered service';

  static override args = {
    url: Args.string({
      description: 'Service URL (e.g., http://localhost:8000)',
      required: true,
    }),
  };

  static override examples = ['<%= config.bin %> status http://localhost:8000'];

  static override flags = {
    ...globalFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Status);
    setConfigDir(flags.config ?? null);
    const { url: serviceUrl } = args;

    // Check service exists
    if (!serviceExists(serviceUrl)) {
      console.log(ui.error(`Service ${serviceUrl} is not registered.`));
      console.log(`Run "zag setup ${serviceUrl}" first.`);
      this.exit(1);
    }

    // Load agent
    const agent = await loadAgent(serviceUrl);
    if (!agent) {
      console.log(ui.error('Failed to load agent data.'));
      this.exit(1);
    }

    // Load manifest
    const manifest = await loadManifest(serviceUrl);

    this.log('');
    this.log(ui.label('Service:', manifest?.name ?? 'Unknown'));
    this.log(ui.label('URL:', serviceUrl));
    this.log(ui.label('Agent ID:', agent.agent_id));
    this.log(ui.label('Status:', agent.status));
    this.log(ui.label('Registered:', agent.registered_at));
    this.log('');

    if (manifest) {
      this.log(ui.label('Actions:', ''));
      manifest.actions.forEach((action) => {
        this.log(`  - ${action.id}: ${action.method} ${action.path}`);
        if (action.description) {
          this.log(`    ${action.description}`);
        }
      });
    }
  }
}
