import { Command, Args, Flags } from '@oclif/core';
import { fetchManifest } from '../lib/manifest.js';
import { loadManifest, saveManifest, serviceExists, listServices, setConfigDir } from '../lib/config.js';
import { ui } from '../lib/ui.js';
import { globalFlags } from '../lib/flags.js';

export default class Update extends Command {
  static override description = 'Update manifest from a service';

  static override args = {
    url: Args.string({
      description: 'Service URL (e.g., http://localhost:8000)',
      required: false,
    }),
  };

  static override flags = {
    ...globalFlags,
    all: Flags.boolean({
      char: 'a',
      description: 'Update all registered services',
      default: false,
    }),
  };

  static override examples = [
    '<%= config.bin %> update http://localhost:8000',
    '<%= config.bin %> update --all',
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Update);
    setConfigDir(flags.config ?? null);
    const { url } = args;
    const { all } = flags;

    if (all) {
      await this.updateAll();
    } else if (url) {
      await this.updateService(url);
    } else {
      console.log(ui.error('Please specify a service URL or use --all flag.'));
      this.exit(1);
    }
  }

  private async updateAll(): Promise<void> {
    const services = await listServices();

    if (services.length === 0) {
      this.log('No registered services found.');
      return;
    }

    this.log(`Updating ${services.length} service(s)...`);
    this.log('');

    for (const service of services) {
      this.log(`Updating ${service}...`);
      try {
        await this.updateService(service, false);
      } catch (error) {
        console.log(ui.error(`${error instanceof Error ? error.message : error}`));
      }
    }
  }

  private async updateService(path: string, exitOnError = true): Promise<void> {
    // Check service exists
    if (!serviceExists(path)) {
      const msg = `Service ${path} is not registered.`;
      if (exitOnError) {
        console.log(ui.error(msg));
        this.exit(1);
      }
      throw new Error(msg);
    }

    // Load existing manifest
    const existingManifest = await loadManifest(path);
    if (!existingManifest) {
      const msg = 'Failed to load existing manifest.';
      if (exitOnError) {
        console.log(ui.error(msg));
        this.exit(1);
      }
      throw new Error(msg);
    }

    // Fetch new manifest
    const newManifest = await fetchManifest(path);

    // Compare actions
    const existingActionIds = new Set(existingManifest.actions.map((a) => a.id));
    const newActionIds = new Set(newManifest.actions.map((a) => a.id));

    const addedActions = newManifest.actions.filter((a) => !existingActionIds.has(a.id));
    const removedActions = existingManifest.actions.filter((a) => !newActionIds.has(a.id));

    // Report changes
    if (addedActions.length > 0) {
      this.log('  New actions:');
      addedActions.forEach((a) => {
        this.log(`    + ${a.id}: ${a.method} ${a.path}`);
      });
    }

    if (removedActions.length > 0) {
      this.log('  Removed actions:');
      removedActions.forEach((a) => {
        this.log(`    - ${a.id}: ${a.method} ${a.path}`);
      });
    }

    if (addedActions.length === 0 && removedActions.length === 0) {
      this.log('  No changes.');
    }

    // Save updated manifest
    await saveManifest(path, newManifest);
    this.log('  Manifest updated.');
  }
}
