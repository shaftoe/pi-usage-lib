/**
 * pi-usage-lib — Shared library for Pi usage monitoring extensions
 * Public API types
 */

import type { ExtensionContext, ModelRegistry } from "@earendil-works/pi-coding-agent"

/** Theme helper — matches ctx.ui.theme */
export type Theme = ExtensionContext["ui"]["theme"]

/**
 * Color thresholds for usage display.
 *
 * Users can override any subset of these values via the
 * `~/.pi/agent/usage-lib.json` settings file.
 */
export interface ColorThresholds {
  /** Percentage-based usage thresholds (0–100) */
  percentage: {
    /** Above this % → **warning** color (default: 80) */
    warning: number
    /** At or above this % → **critical** color (default: 90) */
    critical: number
  }
  /** Credit / monetary balance thresholds (in USD) */
  credit: {
    /** Below this → **warning** color (default: 5) */
    warning: number
    /** At or below this → **critical** color (default: 1) */
    critical: number
  }
}

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
