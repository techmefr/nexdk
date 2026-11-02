import { describe, expectTypeOf, it } from 'vitest'
import { createRequest } from '../src/index.ts'
import type { FetchLike, HttpRequestInit } from '../src/index.ts'

const narrow: FetchLike = async () => new Response('{}')

const withExtraMember = Object.assign(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}'), {
    preconnect: (_url: string) => undefined,
})

describe('FetchLike', () => {
    it('is the minimal fetch signature', () => {
        expectTypeOf<FetchLike>().toEqualTypeOf<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    })

    it('accepts a narrow function', () => {
        createRequest(narrow)
        const init: HttpRequestInit = { fetch: narrow }
        expectTypeOf(init.fetch).toEqualTypeOf<FetchLike | undefined>()
    })

    it('accepts a fetch carrying an extra member without a cast', () => {
        createRequest(withExtraMember)
        const init: HttpRequestInit = { fetch: withExtraMember }
        expectTypeOf(init.fetch).toEqualTypeOf<FetchLike | undefined>()
    })

    it('still accepts the global fetch', () => {
        createRequest(fetch)
    })

    it('rejects a function that is not a fetch', () => {
        // @ts-expect-error returns the wrong type
        createRequest(async () => 1)
    })
})
