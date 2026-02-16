import { Command } from '@oclif/core';
import { listServices, loadManifest, loadAgent } from '../lib/config.js';

export default class Ls extends Command {
  static override description = 'List all registered services';

  static override hiddenAliases = ['list'];

  static override examples = [
    '<%= config.bin %> ls',
    '<%= config.bin %> list',
  ];

  async run(): Promise<void> {
    await this.parse(Ls);
    const services = await listServices();

    if (services.length === 0) {
      this.log('No registered services found.');
      this.log('Run "zag setup <path>" to register with a service.');
      return;
    }

    // Build table data
    const rows: { path: string; name: string; actions: number; status: string }[] = [];

    for (const path of services) {
      const manifest = await loadManifest(path);
      const agent = await loadAgent(path);

      rows.push({
        path,
        name: manifest?.name ?? 'Unknown',
        actions: manifest?.actions.length ?? 0,
        status: agent?.status ?? 'unknown',
      });
    }

    // Print table header
    const pathWidth = Math.max(4, ...rows.map((r) => r.path.length));
    const nameWidth = Math.max(4, ...rows.map((r) => r.name.length));
    const actionsWidth = 7;
    const statusWidth = 6;

    const header = [
      'PATH'.padEnd(pathWidth),
      'NAME'.padEnd(nameWidth),
      'ACTIONS'.padEnd(actionsWidth),
      'STATUS'.padEnd(statusWidth),
    ].join('  ');

    this.log(header);
    this.log('─'.repeat(header.length));

    for (const row of rows) {
      this.log(
        [
          row.path.padEnd(pathWidth),
          row.name.padEnd(nameWidth),
          String(row.actions).padEnd(actionsWidth),
          row.status.padEnd(statusWidth),
        ].join('  ')
      );
    }
  }
}
