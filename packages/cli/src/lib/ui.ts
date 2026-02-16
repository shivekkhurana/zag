import pc from 'picocolors';

export const ui = {
  error: (msg: string) => `${pc.bold(pc.red('Error:'))}\n${msg}`,
  warn: (msg: string) => `${pc.bold(pc.yellow('Warning:'))}\n${msg}`,
  success: (msg: string) => `${pc.green('✓')} ${msg}`,
  examples: () => pc.bold(pc.cyan('Examples:')),
  label: (label: string, value: string) => `${pc.bold(pc.green(label))}\n${value}`,
  dim: (msg: string) => pc.dim(msg),
};
