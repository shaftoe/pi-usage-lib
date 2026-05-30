/**
 * pi-usage-lib — Shared library for Pi usage monitoring extensions
 * Public API types
 */

import type { ExtensionContext, ModelRegistry } from "@earendil-works/pi-coding-agent"

/** Theme helper — matches ctx.ui.theme */
export type Theme = ExtensionContext["ui"]["theme"]

/** Fetch function signature */
export type FetchUsageFn<TData> = (
  modelRegistry: Pick<ModelRegistry, "getApiKeyForProvider">,
) => Promise<TData>

/** Render usage data into a themed footer string */
export type RenderStatusFn<TData> = (data: TData, theme: Theme) => string

/** Render an error into a themed footer string. Return undefined to clear the footer. */
export type RenderErrorFn = (error: unknown, theme: Theme) => string | undefined

/** Configuration to define a usage extension */
export interface UsageExtensionConfig<TData> {
  /** Provider name prefix for matching (e.g. "zai", "deepseek") */
  providerPrefix: string

  /** Status key for ctx.ui.setStatus() (e.g. "zai-usage") */
  statusKey: string

  /** Display label for footer prefix (e.g. "MyProvider") */
  label: string

  /** Cache cooldown in ms (default: 30_000) */
  cooldownMs?: number

  /** Fetch usage data from the provider API */
  fetchUsage: FetchUsageFn<TData>

  /** Render usage data into a themed footer string */
  renderStatus: RenderStatusFn<TData>

  /**
   * Render an error into a themed footer string.
   * Default: shows themed `<err:code>` using UsageError.code,
   * falling back to "fetch" for unknown errors.
   * Return undefined to clear the footer instead.
   */
  renderError?: RenderErrorFn
}
