/**
 * ZapierSdkActionProvider — host-side `ZapierActionProvider`.
 *
 * Wraps `@zapier/zapier-sdk`. Auth is resolved by the SDK itself: it checks
 * (in order) explicit credentials, `ZAPIER_CREDENTIALS*` env vars, and
 * finally the token stored by `@zapier/zapier-sdk-cli-login` after a
 * one-time interactive `npx zapier-sdk login`. No credentials are read or
 * stored by this class.
 */

import { createZapierSdk, type ZapierSdk } from '@zapier/zapier-sdk';

import type {
  ZapierActionProvider,
  ZapierActionSummary,
  ZapierActionType,
  ZapierInputFieldSummary,
} from '#/agent/tools/zapier/zapier';

export class ZapierSdkActionProvider implements ZapierActionProvider {
  private sdk: ZapierSdk | undefined;

  private getSdk(): ZapierSdk {
    this.sdk ??= createZapierSdk();
    return this.sdk;
  }

  async listActions(input: {
    appKey: string;
    actionType?: ZapierActionType;
  }): Promise<ZapierActionSummary[]> {
    const { data } = await this.getSdk().listActions({
      appKey: input.appKey,
      actionType: input.actionType,
    });
    return data.map((action) => ({
      key: action.key,
      title: action.title,
      actionType: action.action_type,
    }));
  }

  async getInputFieldsSchema(input: {
    appKey: string;
    actionType: ZapierActionType;
    actionKey: string;
  }): Promise<ZapierInputFieldSummary[]> {
    const { data } = await this.getSdk().listInputFields({
      appKey: input.appKey,
      actionType: input.actionType,
      actionKey: input.actionKey,
    });
    return data
      .filter((field): field is Extract<typeof field, { type: 'input_field' }> => field.type === 'input_field')
      .map((field) => ({
        key: field.key,
        title: field.title,
        valueType: field.value_type,
        isRequired: field.is_required,
      }));
  }

  async runAction(input: {
    appKey: string;
    actionType: ZapierActionType;
    actionKey: string;
    authenticationId?: string | number;
    inputs?: Record<string, unknown>;
  }): Promise<unknown[]> {
    const { data } = await this.getSdk().runAction({
      appKey: input.appKey,
      actionType: input.actionType,
      actionKey: input.actionKey,
      authenticationId: input.authenticationId,
      inputs: input.inputs,
    });
    return data;
  }
}
