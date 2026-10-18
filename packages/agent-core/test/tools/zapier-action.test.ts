/**
 * Covers: ZapierActionTool.
 *
 * Uses a fake ZapierActionProvider to test tool behaviour in isolation; the
 * real `@zapier/zapier-sdk` wrapper (ZapierSdkActionProvider) is a thin
 * pass-through and is not exercised here.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  ZapierActionInputSchema,
  ZapierActionTool,
  type ZapierActionProvider,
} from '../../src/tools/builtin/web/zapier-action';
import { toolContentString } from './fixtures/fake-kaos';
import { executeTool } from './fixtures/execute-tool';

const signal = new AbortController().signal;

function fakeProvider(overrides: Partial<ZapierActionProvider> = {}): ZapierActionProvider {
  return {
    listActions: vi.fn().mockResolvedValue([]),
    getInputFieldsSchema: vi.fn().mockResolvedValue([]),
    runAction: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('ZapierActionTool', () => {
  it('has name "ZapierAction" and a non-empty description', () => {
    const tool = new ZapierActionTool(fakeProvider());
    expect(tool.name).toBe('ZapierAction');
    expect(tool.description.length).toBeGreaterThan(0);
  });

  it('accepts the three documented modes', () => {
    expect(
      ZapierActionInputSchema.safeParse({ mode: 'list_actions', appKey: 'SlackCLIAPI' }).success,
    ).toBe(true);
    expect(
      ZapierActionInputSchema.safeParse({
        mode: 'get_input_schema',
        appKey: 'SlackCLIAPI',
        actionType: 'write',
        actionKey: 'send_message',
      }).success,
    ).toBe(true);
    expect(
      ZapierActionInputSchema.safeParse({
        mode: 'run_action',
        appKey: 'SlackCLIAPI',
        actionType: 'write',
        actionKey: 'send_message',
        inputs: { channel: '#general', text: 'hi' },
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown mode', () => {
    expect(ZapierActionInputSchema.safeParse({ mode: 'delete_everything' }).success).toBe(false);
  });

  it('lists actions through the provider', async () => {
    const provider = fakeProvider({
      listActions: vi
        .fn()
        .mockResolvedValue([{ key: 'send_message', title: 'Send Channel Message', actionType: 'write' }]),
    });
    const tool = new ZapierActionTool(provider);
    const result = await executeTool(tool, {
      turnId: 't1',
      toolCallId: 'c1',
      args: { mode: 'list_actions', appKey: 'SlackCLIAPI' },
      signal,
    });
    expect(result.isError).toBe(false);
    expect(toolContentString(result)).toContain('send_message (write): Send Channel Message');
    expect(provider.listActions).toHaveBeenCalledWith({ appKey: 'SlackCLIAPI', actionType: undefined });
  });

  it('reports when an app has no actions of the requested type', async () => {
    const tool = new ZapierActionTool(fakeProvider());
    const result = await executeTool(tool, {
      turnId: 't1',
      toolCallId: 'c2',
      args: { mode: 'list_actions', appKey: 'SlackCLIAPI' },
      signal,
    });
    expect(toolContentString(result)).toContain('No actions found');
  });

  it('renders input fields with required markers', async () => {
    const provider = fakeProvider({
      getInputFieldsSchema: vi
        .fn()
        .mockResolvedValue([{ key: 'channel', title: 'Channel', valueType: 'string', isRequired: true }]),
    });
    const tool = new ZapierActionTool(provider);
    const result = await executeTool(tool, {
      turnId: 't1',
      toolCallId: 'c3',
      args: {
        mode: 'get_input_schema',
        appKey: 'SlackCLIAPI',
        actionType: 'write',
        actionKey: 'send_message',
      },
      signal,
    });
    expect(toolContentString(result)).toContain('channel (string, required): Channel');
  });

  it('runs an action and returns its results as JSON', async () => {
    const provider = fakeProvider({
      runAction: vi.fn().mockResolvedValue([{ ok: true, ts: '123' }]),
    });
    const tool = new ZapierActionTool(provider);
    const result = await executeTool(tool, {
      turnId: 't1',
      toolCallId: 'c4',
      args: {
        mode: 'run_action',
        appKey: 'SlackCLIAPI',
        actionType: 'write',
        actionKey: 'send_message',
        inputs: { channel: '#general', text: 'hi' },
      },
      signal,
    });
    expect(result.isError).toBe(false);
    expect(toolContentString(result)).toContain('"ok": true');
    expect(provider.runAction).toHaveBeenCalledWith({
      appKey: 'SlackCLIAPI',
      actionType: 'write',
      actionKey: 'send_message',
      authenticationId: undefined,
      inputs: { channel: '#general', text: 'hi' },
    });
  });

  it('classifies authentication failures and points at the login command', async () => {
    const err = new Error('401 unauthorized');
    err.name = 'ZapierAuthenticationError';
    const provider = fakeProvider({ runAction: vi.fn().mockRejectedValue(err) });
    const tool = new ZapierActionTool(provider);
    const result = await executeTool(tool, {
      turnId: 't1',
      toolCallId: 'c5',
      args: { mode: 'run_action', appKey: 'SlackCLIAPI', actionType: 'write', actionKey: 'send_message' },
      signal,
    });
    expect(result.isError).toBe(true);
    const content = toolContentString(result);
    expect(content).toContain('authentication');
    expect(content).toContain('npx zapier-sdk login');
  });

  it('classifies generic failures', async () => {
    const provider = fakeProvider({ runAction: vi.fn().mockRejectedValue(new Error('boom')) });
    const tool = new ZapierActionTool(provider);
    const result = await executeTool(tool, {
      turnId: 't1',
      toolCallId: 'c6',
      args: { mode: 'run_action', appKey: 'SlackCLIAPI', actionType: 'write', actionKey: 'send_message' },
      signal,
    });
    expect(result.isError).toBe(true);
    expect(toolContentString(result)).toContain('Zapier action failed: boom');
  });
});
