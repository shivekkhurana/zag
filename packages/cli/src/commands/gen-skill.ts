import { Command, Args, Flags } from '@oclif/core';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { dirname, join, resolve, basename } from 'path';
import type { Manifest } from '../types/manifest.js';
import { ui } from '../lib/ui.js';
import { generateSkillMd } from '../lib/skill.js';

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

export default class GenSkill extends Command {
  static override description = 'Generate a SKILL.md file from a manifest for OpenClaw agents';

  static override args = {
    path: Args.string({
      description: 'Path to manifest.json (defaults to .zeroagentgate/manifest.json)',
      required: false,
    }),
  };

  static override flags = {
    url: Flags.string({
      char: 'u',
      description: 'Base URL of the service',
      required: true,
    }),
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompt when overwriting',
      default: false,
    }),
  };

  static override examples = [
    '<%= config.bin %> gen-skill -u https://api.example.com',
    '<%= config.bin %> gen-skill .zeroagentgate/manifest.json -u https://api.example.com',
    '<%= config.bin %> gen-skill -u https://api.example.com -y  # Overwrite without prompt',
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(GenSkill);

    const serviceUrl = flags.url;

    // Resolve manifest path
    const manifestPath = resolve(args.path || '.zeroagentgate/manifest.json');

    if (!existsSync(manifestPath)) {
      console.log(ui.error(`Manifest not found: ${manifestPath}`));
      this.exit(1);
    }

    // Read manifest
    let manifest: Manifest;
    try {
      const content = readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(content);
    } catch (error) {
      console.log(ui.error(`Failed to parse manifest: ${error instanceof Error ? error.message : error}`));
      this.exit(1);
    }

    // Manifest path for the skill (relative reference)
    const manifestFilename = basename(manifestPath);

    // Output to same directory as manifest
    const outputPath = join(dirname(manifestPath), 'SKILL.md');

    // Check if SKILL.md already exists
    if (existsSync(outputPath) && !flags.yes) {
      const confirmed = await confirm(`SKILL.md already exists at ${outputPath}. Overwrite?`);
      if (!confirmed) {
        this.log('Aborted.');
        this.exit(0);
      }
    }

    // Generate SKILL.md
    const skillContent = generateSkillMd(manifest, serviceUrl, manifestFilename);

    try {
      writeFileSync(outputPath, skillContent, 'utf-8');
    } catch (error) {
      console.log(ui.error(`Failed to write SKILL.md: ${error instanceof Error ? error.message : error}`));
      this.exit(1);
    }

    this.log('');
    this.log(`Generated ${outputPath}`);
    this.log('');
    this.log('Host .zeroagentgate/ at your service URL to enable agent discovery.');
  }
}
