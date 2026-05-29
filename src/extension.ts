/**
 * pi-usage-lib — Extension factory
 * Creates a Pi extension from a UsageExtensionConfig, handling all event
 * registration, provider matching, caching, and footer lifecycle.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent"
import { UsageCache } from "./cache"
import type { UsageExtensionConfig } from "./types"

/** Check if a provider name matches the given prefix (case-insensitive) */
function isProviderMatch(provider: string | undefined, prefix: string): boolean {
  return provider?.toLowerCase().startsWith(prefix) ?? false
}

/** Check if the current model's provider matches the given prefix */
function isCurrentProvider(ctx: ExtensionContext, prefix: string): boolean {
  return isProviderMatch(ctx.model?.provider, prefix)
}

/**
 * Create a Pi usage extension from a configuration object.
 *
 * Handles all boilerplate: event registration, provider matching,
 * cache management, and footer lifecycle.
 *
 * @example
 * ```ts
 * export default createUsageExtension({
 *   providerPrefix: "zai",
 *   statusKey: "zai-usage",
 *   label: "Z.ai",
 *   fetchUsage: async (registry) => { ... },
 *   renderStatus: (data, theme) => { ... },
 * })
 * ```
 */
export function createUsageExtension<TData>(config: UsageExtensionConfig<TData>) {
  const { providerPrefix, statusKey, label, cooldownMs = 30_000 } = config

  return function extension(pi: ExtensionAPI) {
    const cache = new UsageCache(
      statusKey,
      label,
      config.fetchUsage,
      config.renderStatus,
      config.renderError,
      cooldownMs,
    )

    // Show footer at session start (only when using matching model)
    pi.on("session_start", async (_event, ctx) => {
      if (isCurrentProvider(ctx, providerPrefix)) {
        await cache.updateStatus(ctx)
      }
    })

    // Update footer on model select
    pi.on("model_select", async (event, ctx) => {
      if (isProviderMatch(event.model.provider, providerPrefix)) {
        await cache.updateStatus(ctx)
      } else {
        cache.clear(ctx)
      }
    })

    // Update footer after each turn
    pi.on("turn_end", async (_event, ctx) => {
      if (isCurrentProvider(ctx, providerPrefix)) {
        await cache.updateStatus(ctx)
      }
    })

    // Clear footer on session shutdown
    pi.on("session_shutdown", async (_event, ctx) => {
      cache.clear(ctx)
    })
  }
}
