import { Command, Args } from '@oclif/core';
import { serviceExists, removeService } from '../lib/config.js';
import { ui } from '../lib/ui.js';

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

  async run(): Promise<void> {
    const { args } = await this.parse(Rm);
    const { url: serviceUrl } = args;

    if (!serviceExists(serviceUrl)) {
      console.log(ui.error(`Service ${serviceUrl} is not registered.`));
      this.exit(1);
    }

    await removeService(serviceUrl);
    this.log(`Removed ${serviceUrl}`);
  }
}
