/**
 * pi-usage-lib — Shared library for Pi usage monitoring extensions
 * Public API
 */

// API utilities
export { buildAuthHeaders, safeFetch, safeParseJson, UsageError } from "./api"

// Cache class (for advanced use)
export { UsageCache } from "./cache"
// Color threshold helpers
export { colorForCredit, colorForPercentage } from "./color"
// Factory function
export { createUsageExtension } from "./extension"

// Types
export type {
  FetchUsageFn,
  RenderErrorFn,
  RenderStatusFn,
  Theme,
  UsageExtensionConfig,
} from "./types"
