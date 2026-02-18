import { Flags } from '@oclif/core';

export const globalFlags = {
  config: Flags.string({
    char: 'c',
    description: 'Configuration directory (default: ~/.zeroagentgateway)',
  }),
};
