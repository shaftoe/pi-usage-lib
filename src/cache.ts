/**
 * pi-usage-lib — Generic usage cache with themed footer rendering
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent"
import { Temporal } from "temporal-polyfill"
import { UsageError } from "./api"
import type { FetchUsageFn, RenderErrorFn, RenderStatusFn, Theme } from "./types"

/** Build the default error renderer for a given label */
function defaultRenderError(label: string): RenderErrorFn {
  return (error: unknown, theme: Theme): string => {
    const code = error instanceof UsageError ? error.code : "fetch"
    return theme.fg("muted", `${label}:`) + theme.fg("error", `<err:${code}>`)
  }
}

/** Generic cache for usage data with cooldown and themed footer rendering */
export class UsageCache<TData> {
  private lastData: TData | null = null
  private lastFetchTime = 0
  private readonly renderError: RenderErrorFn

  constructor(
    private readonly statusKey: string,
    label: string,
    private readonly fetchUsage: FetchUsageFn<TData>,
    private readonly renderStatus: RenderStatusFn<TData>,
    renderError: RenderErrorFn | undefined,
    private readonly cooldownMs = 30_000,
  ) {
    // Use default error rendering
    this.renderError = renderError ?? defaultRenderError(label)
  }

  /** Update footer status from API or cache */
  async updateStatus(ctx: ExtensionContext): Promise<void> {
    try {
      const now = Temporal.Now.instant().epochMilliseconds

      // Use cached data if still fresh
      if (this.lastData && now - this.lastFetchTime < this.cooldownMs) {
        ctx.ui.setStatus(this.statusKey, this.renderStatus(this.lastData, ctx.ui.theme))
        return
      }

      const data = await this.fetchUsage(ctx.modelRegistry)
      this.lastData = data
      this.lastFetchTime = now

      ctx.ui.setStatus(this.statusKey, this.renderStatus(data, ctx.ui.theme))
    } catch (error) {
      // Show error code in footer (no console.error)
      const rendered = this.renderError(error, ctx.ui.theme)
      ctx.ui.setStatus(this.statusKey, rendered) // undefined → clears
    }
  }

  /** Clear footer status */
  clear(ctx: ExtensionContext): void {
    ctx.ui.setStatus(this.statusKey, undefined)
  }
}
