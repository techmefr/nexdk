# AGENT.md — @nexdk/driver-nhost

## Role
GraphQL + subscriptions driver for Hasura / Nhost: `query`, `mutation`, `upsert`, `updateById`, `updateWhere`, `deleteById`, `subscription`. Exposes `NhostDriver`. Built with `defineDriver`.

## Layout
- `driver.ts`: GraphQL document building. Values go through GraphQL variables, never string interpolation. Keep it injection-safe.
- `document.ts`: field selection (`fragment` from `extra`, else `fragments.default`, else the schema `shape`, else `id`) and `enumIdentifier`.
- `connection-pool.ts`: `graphql-transport-ws` pool with refCount, a pending-before-ack queue, reconnect with exponential backoff (500 ms to 15 s) and resubscribe. Intentional teardown (refCount 0) never reconnects.

## Validation and safety
- `enumIdentifier` (`[_A-Za-z][_0-9A-Za-z]*`) checks the resource name (also on `bindResource`), payload keys, `conflictConstraint` and `updateColumns`.
- A WebSocket to an `http` endpoint is refused unless the host is `localhost`, `127.0.0.1` or `[::1]`.
- The pool is shared only when `adminSecret` is set (key: url, secret, resolver identity). Without it, each subscription is isolated, so credentials are never shared.

## Dependency rule
`nexdk`: `peerDependency` (+ devDependency `workspace:*`). No other runtime dependency. It uses `fetch` directly, not `@nexdk/http`.

## Contract
Emit `error`, then throw an `SdkError`. A GraphQL `errors` array throws even with HTTP 200 (`errors` = the GraphQL array); a non-2xx response throws `HTTP {status}` with `status`, `data` (parsed body) and `errors` (body `errors` key). The event is `{ message, status?, errors? }`. `config.fetch` (optional) replaces `globalThis.fetch` for HTTP calls, not for the WebSocket. `headers` is a record or a resolver (per request and on every WS `connection_init`).

- Pool: `pending` is gone, subscriptions live in `handlers`. `connected`, `disconnected`, `complete` and `error` are emitted per subscription. A close code 4400-4499 emits `error` and stops reconnecting. The pool key uses the identity of `config.headers` (or the driver instance when unset); `removeSubscription` drops the pool entry at once and only deletes its own key.

## Build/test
`pnpm --filter @nexdk/driver-nhost build` · `... test`. Tests mock `fetch` and `WebSocket` (reconnect and replay with fake timers).

## Call options and onResponse
- `GraphQLOptions` extends `SdkCallOptions`: `{ fragment, signal, timeout, headers }` (third argument of every method, `updateWhere` and `deleteById` included). `createExecute` merges the headers case-insensitively and combines `signal` with `AbortSignal.timeout`.
- `config.onResponse(response, { url, method: 'POST' })` runs before the status check; its throw is the error of the call.
- nhost does not use `@nexdk/http`; `src/errors.ts` gives its errors a `status` and a `kind`: HTTP failure `kind` `http`; GraphQL errors status from `extensions.code` (`statusByCode`, first known code, else 500), `kind` `http`; fetch throw status 0, `kind` `timeout`/`abort`/`network`, `cause` kept.
