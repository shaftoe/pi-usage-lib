/**
 * Unit tests for extension.ts — createUsageExtension factory
 */

import { describe, expect, it, mock } from "bun:test"
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent"
import { UsageError } from "../src/api"
import { createUsageExtension } from "../src/extension"
import type { RenderStatusFn } from "../src/types"

// --- Helpers ---

interface TestData {
  value: number
}

const defaultRender: RenderStatusFn<TestData> = (data, theme) =>
  theme.fg("muted", "Svc:") + theme.fg("accent", `${data.value}`)

/**
 * Captures pi.on() handlers by event name, then allows triggering them.
 */
function createMockPi(): ExtensionAPI & {
  handlers: Record<string, (...args: any[]) => Promise<void>>
  trigger: (event: string, ...args: any[]) => Promise<void>
} {
  const handlers: Record<string, (...args: any[]) => Promise<void>> = {}

  const pi = {
    on: mock((event: string, handler: (...args: any[]) => Promise<void>) => {
      handlers[event] = handler
    }),
    handlers,
    trigger: async (event: string, ...args: any[]) => {
      const handler = handlers[event]
      if (handler) await handler(...args)
    },
  } as any

  return pi
}

function createMockCtx(provider?: string) {
  return {
    model: provider ? { provider, id: "some-model" } : undefined,
    modelRegistry: {
      getApiKeyForProvider: async () => "test-key",
    },
    ui: {
      theme: {
        fg: (style: string, text: string) => `${style}:${text}`,
      },
      setStatus: mock(() => {}),
    },
  } as any as ExtensionContext
}

// --- Tests ---

describe("createUsageExtension", () => {
  it("should register 4 event handlers", () => {
    const extension = createUsageExtension<TestData>({
      providerPrefix: "testsvc",
      statusKey: "testsvc-usage",
      label: "TestSvc",
      fetchUsage: async () => ({ value: 42 }),
      renderStatus: defaultRender,
    })
    const pi = createMockPi()
    extension(pi)

    expect(pi.on).toHaveBeenCalledTimes(4)
    expect(pi.handlers.session_start).toBeDefined()
    expect(pi.handlers.model_select).toBeDefined()
    expect(pi.handlers.turn_end).toBeDefined()
    expect(pi.handlers.session_shutdown).toBeDefined()
  })

  describe("session_start", () => {
    it("should update status when provider matches", async () => {
      const extension = createUsageExtension<TestData>({
        providerPrefix: "testsvc",
        statusKey: "testsvc-usage",
        label: "TestSvc",
        fetchUsage: async () => ({ value: 42 }),
        renderStatus: defaultRender,
      })
      const pi = createMockPi()
      extension(pi)

      const ctx = createMockCtx("testsvc")
      await pi.trigger("session_start", {}, ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith("testsvc-usage", "muted:Svc:accent:42")
    })

    it("should do nothing when provider does not match", async () => {
      const extension = createUsageExtension<TestData>({
        providerPrefix: "testsvc",
        statusKey: "testsvc-usage",
        label: "TestSvc",
        fetchUsage: async () => ({ value: 42 }),
        renderStatus: defaultRender,
      })
      const pi = createMockPi()
      extension(pi)

      const ctx = createMockCtx("other-provider")
      await pi.trigger("session_start", {}, ctx)

      expect(ctx.ui.setStatus).not.toHaveBeenCalled()
    })

    it("should match provider prefix case-insensitively", async () => {
      const extension = createUsageExtension<TestData>({
        providerPrefix: "testsvc",
        statusKey: "testsvc-usage",
        label: "TestSvc",
        fetchUsage: async () => ({ value: 42 }),
        renderStatus: defaultRender,
      })
      const pi = createMockPi()
      extension(pi)

      const ctx = createMockCtx("TESTSVC-PRO")
      await pi.trigger("session_start", {}, ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith("testsvc-usage", "muted:Svc:accent:42")
    })

    it("should match extended provider names", async () => {
      const extension = createUsageExtension<TestData>({
        providerPrefix: "testsvc",
        statusKey: "testsvc-usage",
        label: "TestSvc",
        fetchUsage: async () => ({ value: 42 }),
        renderStatus: defaultRender,
      })
      const pi = createMockPi()
      extension(pi)

      const ctx = createMockCtx("testsvc-extra")
      await pi.trigger("session_start", {}, ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalled()
    })
  })

  describe("model_select", () => {
    it("should update status when selecting matching provider", async () => {
      const extension = createUsageExtension<TestData>({
        providerPrefix: "testsvc",
        statusKey: "testsvc-usage",
        label: "TestSvc",
        fetchUsage: async () => ({ value: 42 }),
        renderStatus: defaultRender,
      })
      const pi = createMockPi()
      extension(pi)

      const ctx = createMockCtx("whatever")
      await pi.trigger("model_select", { model: { provider: "testsvc" } }, ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith("testsvc-usage", "muted:Svc:accent:42")
    })

    it("should clear status when selecting non-matching provider", async () => {
      const extension = createUsageExtension<TestData>({
        providerPrefix: "testsvc",
        statusKey: "testsvc-usage",
        label: "TestSvc",
        fetchUsage: async () => ({ value: 42 }),
        renderStatus: defaultRender,
      })
      const pi = createMockPi()
      extension(pi)

      const ctx = createMockCtx("testsvc")
      await pi.trigger("model_select", { model: { provider: "openai" } }, ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith("testsvc-usage", undefined)
    })
  })

  describe("turn_end", () => {
    it("should update status when provider matches", async () => {
      const extension = createUsageExtension<TestData>({
        providerPrefix: "testsvc",
        statusKey: "testsvc-usage",
        label: "TestSvc",
        fetchUsage: async () => ({ value: 42 }),
        renderStatus: defaultRender,
      })
      const pi = createMockPi()
      extension(pi)

      const ctx = createMockCtx("testsvc")
      await pi.trigger("turn_end", {}, ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith("testsvc-usage", "muted:Svc:accent:42")
    })

    it("should not update status for non-matching provider", async () => {
      const extension = createUsageExtension<TestData>({
        providerPrefix: "testsvc",
        statusKey: "testsvc-usage",
        label: "TestSvc",
        fetchUsage: async () => ({ value: 42 }),
        renderStatus: defaultRender,
      })
      const pi = createMockPi()
      extension(pi)

      const ctx = createMockCtx("openai")
      await pi.trigger("turn_end", {}, ctx)

      expect(ctx.ui.setStatus).not.toHaveBeenCalled()
    })
  })

  describe("session_shutdown", () => {
    it("should always clear status regardless of provider", async () => {
      const extension = createUsageExtension<TestData>({
        providerPrefix: "testsvc",
        statusKey: "testsvc-usage",
        label: "TestSvc",
        fetchUsage: async () => ({ value: 42 }),
        renderStatus: defaultRender,
      })
      const pi = createMockPi()
      extension(pi)

      const ctx = createMockCtx("openai")
      await pi.trigger("session_shutdown", {}, ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith("testsvc-usage", undefined)
    })
  })

  describe("error display", () => {
    it("should show error code in footer when fetch fails", async () => {
      const extension = createUsageExtension<TestData>({
        providerPrefix: "testsvc",
        statusKey: "testsvc-usage",
        label: "TestSvc",
        fetchUsage: async () => {
          throw new Error("network down")
        },
        renderStatus: defaultRender,
      })
      const pi = createMockPi()
      extension(pi)

      const ctx = createMockCtx("testsvc")
      await pi.trigger("session_start", {}, ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith(
        "testsvc-usage",
        "muted:TestSvc:error:<err:fetch>",
      )
    })

    it("should show UsageError code in footer", async () => {
      const extension = createUsageExtension<TestData>({
        providerPrefix: "testsvc",
        statusKey: "testsvc-usage",
        label: "TestSvc",
        fetchUsage: async () => {
          throw new UsageError("API error", "http401")
        },
        renderStatus: defaultRender,
      })
      const pi = createMockPi()
      extension(pi)

      const ctx = createMockCtx("testsvc")
      await pi.trigger("session_start", {}, ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith(
        "testsvc-usage",
        "muted:TestSvc:error:<err:http401>",
      )
    })
  })

  describe("custom renderError", () => {
    it("should use custom error renderer when provided", async () => {
      const extension = createUsageExtension<TestData>({
        providerPrefix: "testsvc",
        statusKey: "testsvc-usage",
        label: "TestSvc",
        fetchUsage: async () => {
          throw new Error("boom")
        },
        renderStatus: defaultRender,
        renderError: (_error, theme) => theme.fg("error", "CUSTOM_ERR"),
      })
      const pi = createMockPi()
      extension(pi)

      const ctx = createMockCtx("testsvc")
      await pi.trigger("session_start", {}, ctx)

      expect(ctx.ui.setStatus).toHaveBeenCalledWith("testsvc-usage", "error:CUSTOM_ERR")
    })
  })

  describe("caching across events", () => {
    it("should reuse cached data across multiple events within cooldown", async () => {
      let fetchCount = 0
      const extension = createUsageExtension<TestData>({
        providerPrefix: "testsvc",
        statusKey: "testsvc-usage",
        label: "TestSvc",
        fetchUsage: async () => {
          fetchCount++
          return { value: fetchCount }
        },
        renderStatus: defaultRender,
      })
      const pi = createMockPi()
      extension(pi)

      const ctx = createMockCtx("testsvc")

      // First event — fetches
      await pi.trigger("session_start", {}, ctx)
      expect(fetchCount).toBe(1)

      // Second event — uses cache
      await pi.trigger("turn_end", {}, ctx)
      expect(fetchCount).toBe(1)

      // Both should show same value
      const calls = (ctx.ui.setStatus as any).mock.calls
      expect(calls[0]?.[1]).toBe("muted:Svc:accent:1")
      expect(calls[1]?.[1]).toBe("muted:Svc:accent:1")
    })
  })
})
