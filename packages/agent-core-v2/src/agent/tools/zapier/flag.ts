/**
 * `tools/zapier` domain — experimental-flag contribution.
 *
 * Gates the `ZapierAction` tool. Off by default; enable via
 * `KIMI_CODE_EXPERIMENTAL_ZAPIER`, the master `KIMI_CODE_EXPERIMENTAL_FLAG`,
 * or the `[experimental]` config section. Also requires a one-time
 * `npx zapier-sdk login`.
 */

import { type FlagDefinitionInput, registerFlagDefinition } from '#/app/flag/flagRegistry';

export const ZAPIER_FLAG_ID = 'zapier';
export const ZAPIER_FLAG_ENV = 'KIMI_CODE_EXPERIMENTAL_ZAPIER';

export const zapierFlag: FlagDefinitionInput = {
  id: ZAPIER_FLAG_ID,
  title: 'Zapier actions',
  description:
    'Expose the ZapierAction tool, letting the agent list and run actions on the 9,000+ apps connected through the Zapier SDK.',
  env: ZAPIER_FLAG_ENV,
  default: false,
  surface: 'core',
};

registerFlagDefinition(zapierFlag);
