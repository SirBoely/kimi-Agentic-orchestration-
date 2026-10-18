/**
 * `auth` domain (cross-cutting) — `IZapierProviderService` implementation.
 *
 * Unlike `WebSearchProviderService`, there is no per-session config to
 * resolve: the Zapier SDK always constructs (auth is deferred to the first
 * real call, which fails with a `ZapierAuthenticationError` if nobody has
 * run `npx zapier-sdk login`). The provider is therefore always present;
 * the `zapier` experimental flag is what actually gates tool exposure.
 * Bound at App scope.
 */

import { LifecycleScope } from '#/app/scopes';
import { ScopeActivation, registerScopedService } from '#/_base/di/scope';

import type { ZapierActionProvider } from '#/agent/tools/zapier/zapier';
import { ZapierSdkActionProvider } from './providers/zapier-sdk';
import { IZapierProviderService } from './zapier';

export class ZapierProviderService implements IZapierProviderService {
  declare readonly _serviceBrand: undefined;

  private provider: ZapierActionProvider | undefined;

  getZapierProvider(): ZapierActionProvider | undefined {
    this.provider ??= new ZapierSdkActionProvider();
    return this.provider;
  }

  hasZapierProvider(): boolean {
    return true;
  }
}

registerScopedService(
  LifecycleScope.App,
  IZapierProviderService,
  ZapierProviderService,
  ScopeActivation.OnScopeCreated,
  'auth',
);
