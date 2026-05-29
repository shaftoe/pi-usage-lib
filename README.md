# pi-usage-lib

Shared library for building [Pi coding agent](https://pi.dev/) usage-monitoring extensions.

It absorbs all the boilerplate that every `*-usage` extension needs — Pi event registration, provider matching, API fetching with sandbox-aware auth, response caching, error handling, and themed footer rendering — so that each extension reduces to a single config object with two callbacks.

## What's Included

| Module | Exports | Purpose |
|---|---|---|
| `pi-usage-lib` | `createUsageExtension()`, `UsageCache`, `UsageError`, `buildAuthHeaders()`, `safeFetch()`, `safeParseJson()` | Factory + building blocks |
| `pi-usage-lib/datetime` | `formatInstantFromEpochMs()`, `formatTimeRemainingFromEpochMs()` | Temporal date/time helpers |

## Install

```bash
bun add @alexanderfortin/pi-usage-lib
```

## Quick Start

```ts
import { createUsageExtension, buildAuthHeaders, safeFetch, safeParseJson } from "@alexanderfortin/pi-usage-lib"

export default createUsageExtension({
  providerPrefix: "myprovider",
  statusKey: "myprovider-usage",
  label: "MyProvider",

  async fetchUsage(modelRegistry) {
    const headers = await buildAuthHeaders(modelRegistry, "myprovider")
    const response = await safeFetch("https://api.myprovider.com/usage", { headers })
    const data = await safeParseJson(response)
    return { balance: data.balance }
  },

  renderStatus(data, theme) {
    return theme.fg("muted", "MyProvider:") + theme.fg("accent", `$${data.balance.toFixed(2)}`)
  },
})
```

That's it — one file, no other source files needed. The factory registers all Pi events, manages caching, handles errors, and shows a themed footer automatically.

## API Reference

### `createUsageExtension<TData>(config)`

Creates a Pi extension function from a configuration object.

```ts
interface UsageExtensionConfig<TData> {
  providerPrefix: string      // e.g. "zai", "deepseek"
  statusKey: string           // e.g. "zai-usage"
  label: string               // e.g. "Z.ai"
  cooldownMs?: number         // cache TTL (default: 30_000)
  fetchUsage: FetchUsageFn<TData>
  renderStatus: RenderStatusFn<TData>
  renderError?: RenderErrorFn // optional, defaults to Z.ai-style <err:code>
}
```

The returned function is a valid Pi extension — pass it as the default export or register it via `pi.extensions`.

### `buildAuthHeaders(modelRegistry, providerName, extra?)`

Builds authenticated fetch headers using Z.ai's **3-way sandbox-aware** strategy:

1. **Real key** → sends `Authorization: Bearer <key>`
2. **`"proxy-managed"` sentinel** → skips auth header (Docker Sandbox proxy handles it)
3. **No key** → skips auth header (API returns 401 → shown as `<err:http401>`)

Always sets `Accept-Encoding: identity` to work around Pi v0.75.0's undici gzip decompression issue.

### `safeFetch(url, init?)`

Wraps `fetch()` with structured error handling:

- Network errors (DNS, timeout, proxy) → throws `UsageError` with code `"fetch"`
- HTTP errors (4xx, 5xx) → throws `UsageError` with code `"http{status}"`

### `safeParseJson<T>(response)`

Parses `response.json()` with error handling:

- Empty or malformed body → throws `UsageError` with code `"badjson"`

### `UsageError`

```ts
class UsageError extends Error {
  readonly name = "UsageError"
  readonly code: string  // e.g. "fetch", "http401", "badjson", custom codes
}
```

Used by `safeFetch`, `safeParseJson`, and the default error renderer. Extensions can throw `UsageError` from their `fetchUsage` with custom codes — the default `renderError` will display them as `<err:code>` in the footer.

### `UsageCache<TData>`

The generic cache class used internally by `createUsageExtension`. Available for advanced use cases where you need direct control over the cache lifecycle.

### Error Display (Default Behavior)

By default, errors are shown in the footer using the Z.ai pattern:

```
MyProvider:<err:http401>
MyProvider:<err:fetch>
MyProvider:<err:badjson>
```

No `console.error` is called — the footer is the error channel. To customize, provide a `renderError` callback. Return `undefined` to clear the footer instead.

### Date/Time Utilities (`pi-usage-lib/datetime`)

```ts
import { formatInstantFromEpochMs, formatTimeRemainingFromEpochMs } from "@alexanderfortin/pi-usage-lib/datetime"

formatInstantFromEpochMs(1705318245000)    // "Mon, 15 Jan 2024, 14:30:45 GMT"
formatTimeRemainingFromEpochMs(Date.now() + 3665000)  // "1h 1m 5s"
```

## License

MIT
