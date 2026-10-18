/**
 * ZapierActionTool — host-injected access to Zapier actions.
 *
 * kimi-core defines the interface; the host provides the real Zapier SDK
 * implementation via `ZapierActionProvider`. If no provider is supplied,
 * the tool should not be registered (not exposed to the LLM).
 */

import { z } from 'zod';

import type { BuiltinTool } from '../../../agent/tool';
import { ToolAccesses } from '../../../loop/tool-access';
import type { ExecutableToolResult, ToolExecution } from '../../../loop/types';
import { toInputJsonSchema } from '../../support/input-schema';
import { literalRulePattern, matchesGlobRuleSubject } from '../../support/rule-match';
import { ToolResultBuilder } from '../../support/result-builder';
import DESCRIPTION from './zapier-action.md?raw';

// ── Provider interface (host-injected) ───────────────────────────────

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

// ── Input schema ─────────────────────────────────────────────────────

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

export type ZapierActionInput = z.Infer<typeof ZapierActionInputSchema>;

// ── Implementation ───────────────────────────────────────────────────

export class ZapierActionTool implements BuiltinTool<ZapierActionInput> {
  readonly name = 'ZapierAction' as const;
  readonly description: string = DESCRIPTION;
  readonly parameters: Record<string, unknown> = toInputJsonSchema(ZapierActionInputSchema);
  constructor(private readonly provider: ZapierActionProvider) {}

  resolveExecution(args: ZapierActionInput): ToolExecution {
    const description =
      args.mode === 'run_action'
        ? `Running Zapier action: ${args.appKey}/${args.actionKey}`
        : `Inspecting Zapier app: ${args.appKey}`;
    return {
      accesses: ToolAccesses.none(),
      description,
      approvalRule: literalRulePattern(this.name, args.appKey),
      matchesRule: (ruleArgs) => matchesGlobRuleSubject(ruleArgs, args.appKey),
      execute: () => this.execution(args),
    };
  }

  private async execution(args: ZapierActionInput): Promise<ExecutableToolResult> {
    try {
      switch (args.mode) {
        case 'list_actions':
          return this.renderActions(
            await this.provider.listActions({ appKey: args.appKey, actionType: args.actionType }),
          );
        case 'get_input_schema':
          return this.renderInputFields(
            await this.provider.getInputFieldsSchema({
              appKey: args.appKey,
              actionType: args.actionType,
              actionKey: args.actionKey,
            }),
          );
        case 'run_action':
          return this.renderRunResult(
            await this.provider.runAction({
              appKey: args.appKey,
              actionType: args.actionType,
              actionKey: args.actionKey,
              authenticationId: args.authenticationId,
              inputs: args.inputs,
            }),
          );
      }
    } catch (error) {
      return { isError: true, output: classifyZapierError(error) };
    }
  }

  private renderActions(actions: ZapierActionSummary[]): ExecutableToolResult {
    const builder = new ToolResultBuilder({ maxLineLength: null });
    if (actions.length === 0) {
      builder.write('No actions found for this app and action type.');
      return builder.ok();
    }
    for (const action of actions) {
      builder.write(`${action.key} (${action.actionType}): ${action.title}\n`);
    }
    return builder.ok();
  }

  private renderInputFields(fields: ZapierInputFieldSummary[]): ExecutableToolResult {
    const builder = new ToolResultBuilder({ maxLineLength: null });
    if (fields.length === 0) {
      builder.write('This action takes no input fields.');
      return builder.ok();
    }
    for (const field of fields) {
      builder.write(`${field.key} (${field.valueType}${field.isRequired ? ', required' : ''}): ${field.title}\n`);
    }
    return builder.ok();
  }

  private renderRunResult(results: unknown[]): ExecutableToolResult {
    const builder = new ToolResultBuilder({ maxLineLength: null });
    builder.write(JSON.stringify(results, null, 2));
    return builder.ok();
  }
}

// ── Error classification ─────────────────────────────────────────────

function classifyZapierError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (name === 'ZapierAuthenticationError' || lower.includes('401') || lower.includes('unauthorized')) {
    return `Zapier action failed (authentication): ${message}. Run "npx zapier-sdk login" and retry.`;
  }
  if (name === 'ZapierAppNotFoundError') {
    return `Zapier action failed (app not found): ${message}`;
  }
  if (name === 'ZapierActionError') {
    return `Zapier action failed (third-party error): ${message}`;
  }
  if (name === 'ZapierValidationError') {
    return `Zapier action failed (invalid input): ${message}`;
  }
  return `Zapier action failed: ${message}`;
}
