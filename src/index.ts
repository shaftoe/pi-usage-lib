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
// Config (user settings / threshold overrides)
export {
  DEFAULT_COLOR_THRESHOLDS,
  getSettingsFilePath,
  loadColorThresholds,
  mergeThresholds,
  resetThresholdsCache,
} from "./config"
// Factory function
export { createUsageExtension } from "./extension"

// Types
export type {
  ColorThresholds,
  FetchUsageFn,
  RenderErrorFn,
  RenderStatusFn,
  Theme,
  UsageExtensionConfig,
} from "./types"
