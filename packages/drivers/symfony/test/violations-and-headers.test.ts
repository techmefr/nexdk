import { SdkError } from 'nexdk'
import { describe, expect, it, vi } from 'vitest'
import { createSymfonyDriver } from '../src/driver.ts'

type Call = (resource: string, payload?: unknown, onEvent?: (event: string, data?: unknown) => void) => Promise<unknown>

function jsonResponse(status: number, value: unknown) {
    return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/ld+json' } })
}

function makeDriver(fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) {
    return createSymfonyDriver({ baseUrl: 'http://localhost:8000/api', fetch: fetchImpl, ...extra }) as unknown as {
        get: Call
        update: Call
        create: Call
    }
}

describe('symfony violations', () => {
    it('exposes the detail and the violations as field errors', async () => {
        const injected = vi.fn().mockResolvedValue(
            jsonResponse(422, {
                detail: 'name: blank',
                violations: [{ propertyPath: 'name', message: 'blank' }, { propertyPath: 'email', message: 'invalid' }],
            }),
        )
        const events: Array<[string, unknown]> = []

        const error = (await makeDriver(injected as unknown as typeof fetch)
            .create('users', {}, (event, data) => events.push([event, data]))
            .catch(e => e)) as SdkError

        expect(error.message).toBe('name: blank')
        expect(error.errors).toEqual({ name: ['blank'], email: ['invalid'] })
        expect(events.find(([event]) => event === 'error')?.[1]).toEqual({
            message: 'name: blank',
            status: 422,
            errors: { name: ['blank'], email: ['invalid'] },
            kind: 'http',
            resource: 'users',
            method: 'create',
        })
    })
})

describe('symfony collection pagination', () => {
    it('keeps the members as the result and exposes totalItems and view as a hidden pagination property', async () => {
        const view = { '@id': '/users?page=1', 'hydra:next': '/users?page=2' }
        const injected = vi.fn().mockResolvedValue(
            jsonResponse(200, { 'hydra:member': [{ id: 1 }, { id: 2 }], 'hydra:totalItems': 12, 'hydra:view': view }),
        )

        const rows = (await makeDriver(injected as unknown as typeof fetch).get('users')) as Array<{ id: number }> & {
            pagination: { totalItems: number; view: unknown }
        }

        expect(rows).toEqual([{ id: 1 }, { id: 2 }])
        expect(Object.keys(rows)).toEqual(['0', '1'])
        expect(rows.pagination).toEqual({ totalItems: 12, view })
    })

    it('also reads the unprefixed member, totalItems and view', async () => {
        const injected = vi.fn().mockResolvedValue(jsonResponse(200, { member: [{ id: 1 }], totalItems: 1, view: { id: 'v' } }))

        const rows = (await makeDriver(injected as unknown as typeof fetch).get('users')) as { pagination: unknown }

        expect(rows.pagination).toEqual({ totalItems: 1, view: { id: 'v' } })
    })
})

describe('symfony PATCH content type', () => {
    it.each([{ 'Content-Type': 'application/ld+json' }, { 'content-type': 'application/json' }])(
        'keeps merge-patch even when headers set %o',
        async headers => {
            const injected = vi.fn().mockResolvedValue(jsonResponse(200, { id: 1 }))

            await makeDriver(injected as unknown as typeof fetch, { headers }).update('users', { id: 1, name: 'x' })

            const sent = new Headers((injected.mock.calls[0][1] as RequestInit).headers)
            expect(sent.get('content-type')).toBe('application/merge-patch+json')
        },
    )

    it('still lets headers override the content type of other calls', async () => {
        const injected = vi.fn().mockResolvedValue(jsonResponse(200, { id: 1 }))

        await makeDriver(injected as unknown as typeof fetch, { headers: { 'Content-Type': 'application/json' } }).create('users', {})

        expect(new Headers((injected.mock.calls[0][1] as RequestInit).headers).get('content-type')).toBe('application/json')
    })
})

describe('symfony resource name guard', () => {
    it.each(['', '.', '..'])('refuses the resource name "%s"', async name => {
        const injected = vi.fn()

        await expect(makeDriver(injected as unknown as typeof fetch).get(name)).rejects.toThrow('Invalid resource name')
        expect(injected).not.toHaveBeenCalled()
    })
})
