/**
 * Unit tests for cache.ts
 */

import { describe, expect, it, mock } from "bun:test"
import type { ExtensionContext } from "@earendil-works/pi-coding-agent"
import { UsageError } from "../src/api"
import { UsageCache } from "../src/cache"
import type { RenderErrorFn, RenderStatusFn, Theme } from "../src/types"

// --- Helpers ---

interface TestData {
  percentage: number
}

function createMockContext(overrides: Partial<ExtensionContext> = {}): ExtensionContext & {
  ui: {
    setStatus: ReturnType<typeof mock>
    theme: Theme
  }
} {
  return {
    ui: {
      setStatus: mock(() => {}),
      theme: {
        fg: (color: string, text: string) => `${color}:${text}`,
      },
    },
    modelRegistry: {
      getApiKeyForProvider: async () => "test-api-key",
    },
    ...overrides,
  } as any
}

const defaultRenderStatus: RenderStatusFn<TestData> = (data, theme) =>
  theme.fg("muted", "Test:") + theme.fg("accent", `${data.percentage}%`)

function createMockFetch(data: TestData) {
  return mock(() => Promise.resolve(data))
}

function createThrowingFetch(error: unknown) {
  return mock(() => Promise.reject(error))
}

function createCache(
  fetchFn: ReturnType<typeof createMockFetch>,
  renderError?: RenderErrorFn,
  cooldownMs?: number,
) {
  return new UsageCache(
    "test-usage",
    "Test",
    fetchFn as any,
    defaultRenderStatus,
    renderError,
    cooldownMs,
  )
}

// --- Tests ---

describe("UsageCache", () => {
  describe("fresh API call", () => {
    it("should set status from fresh API call", async () => {
      const ctx = createMockContext()
      const fetchFn = createMockFetch({ percentage: 50 })
      const cache = createCache(fetchFn)

      await cache.updateStatus(ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith("test-usage", "muted:Test:accent:50%")
    })

    it("should pass modelRegistry to fetchUsage", async () => {
      const ctx = createMockContext()
      const fetchFn = createMockFetch({ percentage: 50 })
      const cache = createCache(fetchFn)

      await cache.updateStatus(ctx)

      expect(fetchFn).toHaveBeenCalledWith(ctx.modelRegistry)
    })
  })

  describe("caching", () => {
    it("should use cached data within cooldown period", async () => {
      const ctx = createMockContext()
      const fetchFn = createMockFetch({ percentage: 50 })
      const cache = createCache(fetchFn)

      // First call — fetches
      await cache.updateStatus(ctx)
      expect(fetchFn).toHaveBeenCalledTimes(1)

      // Second call — uses cache
      await cache.updateStatus(ctx)
      expect(fetchFn).toHaveBeenCalledTimes(1)
    })

    it("should still set status when using cache", async () => {
      const ctx = createMockContext()
      const fetchFn = createMockFetch({ percentage: 75 })
      const cache = createCache(fetchFn)

      await cache.updateStatus(ctx)
      await cache.updateStatus(ctx)

      // Both calls should set status
      expect(ctx.ui.setStatus).toHaveBeenCalledTimes(2)
      expect(ctx.ui.setStatus).toHaveBeenCalledWith("test-usage", "muted:Test:accent:75%")
    })

    it("should re-fetch after cooldown expires", async () => {
      const ctx = createMockContext()
      const fetchFn = createMockFetch({ percentage: 50 })
      // Use a very short cooldown
      const cache = createCache(fetchFn, undefined, 0)

      await cache.updateStatus(ctx)
      expect(fetchFn).toHaveBeenCalledTimes(1)

      // With 0ms cooldown, next call should re-fetch
      await cache.updateStatus(ctx)
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })
  })

  describe("error handling — default", () => {
    it("should show <err:fetch> on generic error", async () => {
      const ctx = createMockContext()
      const fetchFn = createThrowingFetch(new Error("network down"))
      const cache = createCache(fetchFn)

      await cache.updateStatus(ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith("test-usage", "muted:Test:error:<err:fetch>")
    })

    it("should show <err:code> for UsageError", async () => {
      const ctx = createMockContext()
      const fetchFn = createThrowingFetch(new UsageError("API error", "http401"))
      const cache = createCache(fetchFn)

      await cache.updateStatus(ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith("test-usage", "muted:Test:error:<err:http401>")
    })

    it("should show <err:http500> for HTTP 500", async () => {
      const ctx = createMockContext()
      const fetchFn = createThrowingFetch(new UsageError("API failed", "http500"))
      const cache = createCache(fetchFn)

      await cache.updateStatus(ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith("test-usage", "muted:Test:error:<err:http500>")
    })

    it("should show <err:badjson> for bad JSON", async () => {
      const ctx = createMockContext()
      const fetchFn = createThrowingFetch(new UsageError("invalid JSON", "badjson"))
      const cache = createCache(fetchFn)

      await cache.updateStatus(ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith("test-usage", "muted:Test:error:<err:badjson>")
    })

    it("should not throw errors", async () => {
      const ctx = createMockContext()
      const fetchFn = createThrowingFetch(new Error("fail"))
      const cache = createCache(fetchFn)

      // Should resolve without throwing
      const result = await cache.updateStatus(ctx)
      expect(result).toBeUndefined()
    })

    it("should not call console.error", async () => {
      const ctx = createMockContext()
      const fetchFn = createThrowingFetch(new Error("fail"))
      const cache = createCache(fetchFn)
      const mockConsoleError = mock(() => {})
      const original = console.error
      console.error = mockConsoleError

      try {
        await cache.updateStatus(ctx)
        expect(mockConsoleError).not.toHaveBeenCalled()
      } finally {
        console.error = original
      }
    })
  })

  describe("error handling — custom renderError", () => {
    it("should use custom renderError when provided", async () => {
      const ctx = createMockContext()
      const fetchFn = createThrowingFetch(new Error("boom"))
      const customRender: RenderErrorFn = (_error, theme) => theme.fg("error", "CUSTOM_ERROR")
      const cache = createCache(fetchFn, customRender)

      await cache.updateStatus(ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith("test-usage", "error:CUSTOM_ERROR")
    })

    it("should clear footer when custom renderError returns undefined", async () => {
      const ctx = createMockContext()
      const fetchFn = createThrowingFetch(new Error("boom"))
      const customRender: RenderErrorFn = () => undefined
      const cache = createCache(fetchFn, customRender)

      await cache.updateStatus(ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith("test-usage", undefined)
    })
  })

  describe("clear", () => {
    it("should clear status", () => {
      const ctx = createMockContext()
      const fetchFn = createMockFetch({ percentage: 50 })
      const cache = createCache(fetchFn)

      cache.clear(ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith("test-usage", undefined)
    })

    it("should invalidate cached data so a later update re-fetches", async () => {
      const ctx = createMockContext()
      const fetchFn = createMockFetch({ percentage: 50 })
      const cache = createCache(fetchFn, undefined, 30_000)

      await cache.updateStatus(ctx)
      expect(fetchFn).toHaveBeenCalledTimes(1)

      cache.clear(ctx)

      // Within cooldown, but clear() nulled lastData → must re-fetch.
      await cache.updateStatus(ctx)
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })
  })

  describe("in-flight fetch vs clear race", () => {
    it("should not paint after clear() runs during an in-flight fetch", async () => {
      const ctx = createMockContext()
      let resolveFetch: (d: TestData) => void = () => {}
      const fetchPromise = new Promise<TestData>((r) => {
        resolveFetch = r
      })
      const fetchFn = mock(() => fetchPromise)
      const cache = createCache(fetchFn)

      // Start an updateStatus that awaits the fetch.
      const updatePromise = cache.updateStatus(ctx)
      // Yield so it reaches the await fetchUsage().
      await Promise.resolve()
      expect(fetchFn).toHaveBeenCalledTimes(1)

      // Switch to a non-matching provider mid-fetch → clear() runs.
      cache.clear(ctx)
      expect(ctx.ui.setStatus).toHaveBeenCalledWith("test-usage", undefined)
      ;(ctx.ui.setStatus as any).mockClear()

      // Resolve the stale fetch.
      resolveFetch({ percentage: 50 })
      await updatePromise

      // The in-flight update must NOT re-paint over the clear.
      expect(ctx.ui.setStatus).not.toHaveBeenCalled()
    })

    it("should not cache data from a fetch that resolved after clear()", async () => {
      const ctx = createMockContext()
      let resolveFetch: (d: TestData) => void = () => {}
      const fetchPromise = new Promise<TestData>((r) => {
        resolveFetch = r
      })
      const fetchFn = mock(() => fetchPromise)
      const cache = createCache(fetchFn)

      const updatePromise = cache.updateStatus(ctx)
      await Promise.resolve()
      expect(fetchFn).toHaveBeenCalledTimes(1)

      cache.clear(ctx)
      resolveFetch({ percentage: 50 })
      await updatePromise

      // A subsequent updateStatus must re-fetch: the cleared fetch never set
      // lastData, and clear() also nulled it.
      ;(ctx.ui.setStatus as any).mockClear()
      await cache.updateStatus(ctx)
      expect(fetchFn).toHaveBeenCalledTimes(2)
      expect(ctx.ui.setStatus).toHaveBeenCalledWith("test-usage", "muted:Test:accent:50%")
    })

    it("should not paint an error from a fetch that resolved after clear()", async () => {
      const ctx = createMockContext()
      let rejectFetch: (e: unknown) => void = () => {}
      const fetchPromise = new Promise<TestData>((_, reject) => {
        rejectFetch = reject
      })
      const fetchFn = mock(() => fetchPromise)
      const cache = createCache(fetchFn)

      const updatePromise = cache.updateStatus(ctx)
      await Promise.resolve()

      cache.clear(ctx)
      ;(ctx.ui.setStatus as any).mockClear()

      rejectFetch(new UsageError("API error", "http500"))
      await updatePromise

      expect(ctx.ui.setStatus).not.toHaveBeenCalled()
    })
  })

  describe("theme integration", () => {
    it("should pass theme to renderStatus", async () => {
      const customTheme = {
        fg: (color: string, text: string) => `[${color}]${text}[/${color}]`,
      }
      const ctx = createMockContext({
        ui: {
          setStatus: mock(() => {}),
          theme: customTheme,
        },
      } as any)

      const renderStatus: RenderStatusFn<TestData> = (data, theme) =>
        theme.fg("muted", `${data.percentage}%`)

      const cache = new UsageCache(
        "test-usage",
        "Test",
        createMockFetch({ percentage: 42 }) as any,
        renderStatus,
        undefined,
        30_000,
      )

      await cache.updateStatus(ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith("test-usage", "[muted]42%[/muted]")
    })
  })
})
