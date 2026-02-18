import { Command, Args } from '@oclif/core';
import { serviceExists, removeService, setConfigDir } from '../lib/config.js';
import { ui } from '../lib/ui.js';
import { globalFlags } from '../lib/flags.js';

export default class Rm extends Command {
  static override description = 'Remove a registered service';

  static override hiddenAliases = ['remove'];

  static override args = {
    url: Args.string({
      description: 'Service URL (e.g., http://localhost:8000)',
      required: true,
    }),
  };

  static override examples = [
    '<%= config.bin %> rm http://localhost:8000',
    '<%= config.bin %> remove http://localhost:8000',
  ];

  static override flags = {
    ...globalFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Rm);
    setConfigDir(flags.config ?? null);
    const { url: serviceUrl } = args;

    if (!serviceExists(serviceUrl)) {
      console.log(ui.error(`Service ${serviceUrl} is not registered.`));
      this.exit(1);
    }

    await removeService(serviceUrl);
    this.log(`Removed ${serviceUrl}`);
  }
}
