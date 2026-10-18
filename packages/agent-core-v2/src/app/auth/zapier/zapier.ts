/**
 * `auth` domain (cross-cutting) — Zapier SDK seam.
 *
 * Owns the seam for the `ZapierAction` tool. `IZapierProviderService`
 * exposes the configured `ZapierActionProvider` (or `undefined` when no
 * capability is wired), and `hasZapierProvider` answers presence alone —
 * for tool activation gates, which may run before per-call state settles.
 * Tests and hosts that need a custom backend bind `IZapierProviderService`
 * directly. Bound at App scope.
 */

import { createDecorator, type ServiceIdentifier } from '#/_base/di/instantiation';

import type { ZapierActionProvider } from '#/agent/tools/zapier/zapier';

export type { ZapierActionProvider } from '#/agent/tools/zapier/zapier';

export interface IZapierProviderService {
  readonly _serviceBrand: undefined;

  getZapierProvider(): ZapierActionProvider | undefined;
  hasZapierProvider(): boolean;
}

export const IZapierProviderService: ServiceIdentifier<IZapierProviderService> =
  createDecorator<IZapierProviderService>('zapierProviderService');
