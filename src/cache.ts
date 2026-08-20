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
  /**
   * Monotonic token bumped on every clear(). updateStatus() captures the value
   * before its await; if the value changed by the time the fetch resolves, a
   * clear() (model_select to a non-matching provider, or session_shutdown)
   * ran during the fetch and the stale result must NOT be painted or cached.
   *
   * This fixes a race where a deferred post-await setStatus() call re-painted
   * a stale footer on top of the clear that model_select had just issued.
   */
  private generation = 0

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
    // Capture the generation before any await. If a clear() runs while the fetch
    // is in flight (model_select to a non-matching provider, or session_shutdown),
    // generation bumps and this result is stale — drop it instead of re-painting
    // over the clear. Hoisted out of try so the catch block can share it.
    const generation = this.generation

    try {
      const now = Temporal.Now.instant().epochMilliseconds

      // Use cached data if still fresh
      if (this.lastData && now - this.lastFetchTime < this.cooldownMs) {
        ctx.ui.setStatus(this.statusKey, this.renderStatus(this.lastData, ctx.ui.theme))
        return
      }

      const data = await this.fetchUsage(ctx.modelRegistry)

      if (generation !== this.generation) return

      this.lastData = data
      this.lastFetchTime = now

      ctx.ui.setStatus(this.statusKey, this.renderStatus(data, ctx.ui.theme))
    } catch (error) {
      // A clear() during the in-flight fetch invalidates the error paint too.
      if (generation !== this.generation) return
      // Show error code in footer (no console.error)
      const rendered = this.renderError(error, ctx.ui.theme)
      ctx.ui.setStatus(this.statusKey, rendered) // undefined → clears
    }
  }

  /** Clear footer status */
  clear(ctx: ExtensionContext): void {
    this.generation++
    this.lastData = null
    ctx.ui.setStatus(this.statusKey, undefined)
  }
}
