/**
 * `tools` domain — `IZapierTool` contract (the `ZapierAction` tool).
 *
 * Public contract of the `ZapierAction` builtin tool: the model-facing
 * `ZapierActionInputSchema` / `ZapierActionInput`, the host-injected
 * `ZapierActionProvider` interface the tool delegates to, and the
 * `IZapierTool` DI decorator. Needs an authenticated Zapier SDK session, so
 * the provider is wired in from the App-scope `IZapierProviderService`
 * (`auth` domain) at activation time. Bound at Agent scope.
 */

import { z } from 'zod';

import { createDecorator } from '#/_base/di/instantiation';
import { type AgentTool } from '#/tool/toolContract';

export const ZAPIER_ACTION_TYPES = [
  'filter',
  'search',
  'read',
  'read_bulk',
  'run',
  'search_and_write',
  'search_or_write',
  'write',
] as const;

export type ZapierActionType = (typeof ZAPIER_ACTION_TYPES)[number];

export interface ZapierActionSummary {
  key: string;
  title: string;
  actionType: ZapierActionType;
}

export interface ZapierInputFieldSummary {
  key: string;
  title: string;
  valueType: string;
  isRequired: boolean;
}

export interface ZapierActionProvider {
  listActions(input: {
    appKey: string;
    actionType?: ZapierActionType;
  }): Promise<ZapierActionSummary[]>;

  getInputFieldsSchema(input: {
    appKey: string;
    actionType: ZapierActionType;
    actionKey: string;
  }): Promise<ZapierInputFieldSummary[]>;

  runAction(input: {
    appKey: string;
    actionType: ZapierActionType;
    actionKey: string;
    authenticationId?: string | number;
    inputs?: Record<string, unknown>;
  }): Promise<unknown[]>;
}

const ActionTypeSchema = z.enum(ZAPIER_ACTION_TYPES);

export const ZapierActionInputSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('list_actions').describe('Discover the actions available on an app.'),
    appKey: z.string().describe('The Zapier app key, e.g. "SlackCLIAPI".'),
    actionType: ActionTypeSchema.optional().describe('Restrict the listing to a single action type.'),
  }),
  z.object({
    mode: z.literal('get_input_schema').describe('Inspect the input fields a specific action expects.'),
    appKey: z.string().describe('The Zapier app key, e.g. "SlackCLIAPI".'),
    actionType: ActionTypeSchema,
    actionKey: z.string().describe('The action key returned by list_actions.'),
  }),
  z.object({
    mode: z.literal('run_action').describe('Execute an action.'),
    appKey: z.string().describe('The Zapier app key, e.g. "SlackCLIAPI".'),
    actionType: ActionTypeSchema,
    actionKey: z.string().describe('The action key returned by list_actions.'),
    authenticationId: z
      .union([z.string(), z.number()])
      .optional()
      .describe('The connection/authentication id to run as. Omit to use the app\'s only connection.'),
    inputs: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Action input fields, keyed by the field keys from get_input_schema.'),
  }),
]);

export type ZapierActionInput = z.infer<typeof ZapierActionInputSchema>;

export interface IZapierTool extends AgentTool<ZapierActionInput> {
  readonly _serviceBrand: undefined;
}
export const IZapierTool = createDecorator<IZapierTool>('zapierTool');
