import type { UrlFetcher, WebSearchProvider, ZapierActionProvider } from '../builtin';

export interface ToolServices {
  readonly urlFetcher?: UrlFetcher;
  readonly webSearcher?: WebSearchProvider;
  readonly zapierActions?: ZapierActionProvider;
}
