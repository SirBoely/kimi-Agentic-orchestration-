/**
 * `tools` domain — `ZapierActionTool` implementation (the `ZapierAction` tool).
 *
 * Resolves the host-injected `ZapierActionProvider` from the App-scope
 * `IZapierProviderService` (`auth` domain) per invocation, mirroring
 * `WebSearchTool`. The activation gate (registered alongside this tool)
 * checks the `zapier` experimental flag and provider presence together, so
 * construction never races a mid-session login.
 *
 * Registered via the module-level `registerAgentToolService(IZapierTool,
 * ZapierActionTool, ...)` at the bottom of this file — the same
 * "import = register" pattern used by every agent tool. Bound at Agent scope.
 */

import { toInputJsonSchema } from '#/tool/input-schema';
import { literalRulePattern, matchesGlobRuleSubject } from '#/tool/rule-match';
import {
  ToolAccesses,
  type ExecutableToolResult,
  type ToolExecution,
} from '#/tool/toolContract';
import { ToolResultBuilder } from '#/tool/result-builder';
import { registerAgentToolService } from '#/agent/toolRegistry/toolContribution';
import { IFlagService } from '#/app/flag/flag';
import { IZapierProviderService } from '#/app/auth/zapier/zapier';

import {
  IZapierTool,
  ZapierActionInputSchema,
  type ZapierActionInput,
  type ZapierActionSummary,
  type ZapierInputFieldSummary,
} from './zapier';
import DESCRIPTION from './zapier.md?raw';


export class ZapierActionTool implements IZapierTool {
  declare readonly _serviceBrand: undefined;
  readonly name = 'ZapierAction' as const;
  readonly description: string = DESCRIPTION;
  readonly parameters: Record<string, unknown> = toInputJsonSchema(ZapierActionInputSchema);

  constructor(
    @IZapierProviderService private readonly providerService: IZapierProviderService,
  ) {}

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
    const provider = this.providerService.getZapierProvider();
    if (provider === undefined) {
      return {
        isError: true,
        output: 'Zapier is no longer configured; the provider was removed after this session started.',
      };
    }
    try {
      switch (args.mode) {
        case 'list_actions':
          return this.renderActions(
            await provider.listActions({ appKey: args.appKey, actionType: args.actionType }),
          );
        case 'get_input_schema':
          return this.renderInputFields(
            await provider.getInputFieldsSchema({
              appKey: args.appKey,
              actionType: args.actionType,
              actionKey: args.actionKey,
            }),
          );
        case 'run_action':
          return this.renderRunResult(
            await provider.runAction({
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

registerAgentToolService(IZapierTool, ZapierActionTool, {
  name: 'ZapierAction',
  domain: 'auth',
  when: (accessor) =>
    accessor.get(IFlagService).enabled('zapier') &&
    accessor.get(IZapierProviderService).hasZapierProvider(),
});
