import { SdkError } from 'nexdk'
import { describe, expect, it, vi } from 'vitest'
import { LomkitDriver } from '../src/driver.ts'
import { isGateAllowed } from '../src/gates.ts'

function jsonResponse(status: number, value: unknown) {
    return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
}

function open(status: number, body: unknown) {
    const injected = vi.fn().mockImplementation(async () => jsonResponse(status, body))
    const driver = new LomkitDriver({ baseUrl: 'http://localhost:8000/api/', fetch: injected as unknown as typeof fetch })
    const sent = () => {
        const [url, init] = injected.mock.calls[0] as [string, { method: string; body?: unknown }]
        return { url, method: init.method, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body }
    }
    return { driver, sent, injected }
}

describe('gates', () => {
    it('sends the requested gates inside search', async () => {
        const { driver, sent } = open(200, { data: [] })
        await driver.get('posts', { search: { gates: ['create', 'update', 'delete'], limit: 5 } })
        expect(sent().url).toBe('http://localhost:8000/api/posts/search')
        expect(sent().body).toEqual({ search: { gates: ['create', 'update', 'delete'], limit: 5 } })
    })

    it('returns the gates of each row and of meta untouched', async () => {
        const body = {
            data: [{ id: 1, gates: { authorized_to_update: true, authorized_to_delete: false } }],
            meta: { gates: { authorized_to_create: true } },
        }
        const { driver } = open(200, body)
        expect(await driver.get('posts', { search: { gates: ['create', 'update', 'delete'] } })).toEqual(body)
    })

    it('reads a gate in the boolean schema and in the message schema', () => {
        expect(isGateAllowed(true)).toBe(true)
        expect(isGateAllowed(false)).toBe(false)
        expect(isGateAllowed({ allowed: true, message: null })).toBe(true)
        expect(isGateAllowed({ allowed: false, message: 'Not yours' })).toBe(false)
        expect(isGateAllowed(undefined)).toBe(false)
    })
})

describe('restore and forceDelete', () => {
    it('posts the ids to /restore and returns the restored rows', async () => {
        const { driver, sent } = open(200, { data: [{ id: 1 }], meta: [] })
        const events: string[] = []
        const result = await driver.restore('posts', { resources: [1] }, event => events.push(event))
        expect(sent()).toEqual({ url: 'http://localhost:8000/api/posts/restore', method: 'POST', body: { resources: [1] } })
        expect(result).toEqual({ data: [{ id: 1 }], meta: [] })
        expect(events).toEqual(['request', 'success'])
    })

    it('sends DELETE /force with the ids and returns the removed rows', async () => {
        const { driver, sent } = open(200, { data: [{ id: 2 }] })
        const result = await driver.forceDelete('posts', { resources: [2] })
        expect(sent()).toEqual({ url: 'http://localhost:8000/api/posts/force', method: 'DELETE', body: { resources: [2] } })
        expect(result).toEqual({ data: [{ id: 2 }] })
    })

    it('emits error then throws a typed error on a failure', async () => {
        const { driver } = open(403, { message: 'This action is unauthorized.' })
        const events: Array<[string, unknown]> = []
        const error = (await driver.restore('posts', { resources: [1] }, (event, data) => events.push([event, data])).catch(e => e)) as SdkError
        expect(error).toBeInstanceOf(SdkError)
        expect(error.status).toBe(403)
        expect(events.map(([event]) => event)).toEqual(['request', 'error'])
        expect(events[1][1]).toEqual({ message: 'This action is unauthorized.', status: 403, errors: undefined })
    })
})

describe('actions', () => {
    it('posts the body to /actions/<name>', async () => {
        const { driver, sent } = open(200, { data: { impacted: 3 } })
        const result = await driver.actions('users', {
            name: 'rename-role',
            search: { filters: [{ field: 'role', value: 'guest' }] },
            fields: [{ name: 'role', value: 'member' }],
        })
        expect(sent()).toEqual({
            url: 'http://localhost:8000/api/users/actions/rename-role',
            method: 'POST',
            body: { search: { filters: [{ field: 'role', value: 'guest' }] }, fields: [{ name: 'role', value: 'member' }] },
        })
        expect(result).toEqual({ data: { impacted: 3 } })
    })

    it('sends resources for a targeted action and nothing else', async () => {
        const { driver, sent } = open(200, { data: { impacted: 2 } })
        await driver.actions('users', { name: 'archive', resources: [1, 2] })
        expect(sent().body).toEqual({ resources: [1, 2] })
    })

    it('encodes the action name and refuses an empty one', async () => {
        const { driver, sent, injected } = open(200, { data: { impacted: 0 } })
        await driver.actions('users', { name: 'a b/c' })
        expect(sent().url).toBe('http://localhost:8000/api/users/actions/a%20b%2Fc')
        injected.mockClear()
        await expect(driver.actions('users', { name: '' })).rejects.toThrow('Invalid action name')
        await expect(driver.actions('users')).rejects.toThrow('Invalid action name')
        expect(injected).not.toHaveBeenCalled()
    })

    it('answers a 422 with simple field names for the action fields and search', async () => {
        const { driver } = open(422, {
            message: 'The selected search.limit is invalid. (and 1 more error)',
            errors: { 'search.limit': ['bad limit'], 'fields.role': ['bad role'] },
        })
        const error = (await driver.actions('users', { name: 'x' }).catch(e => e)) as SdkError
        expect(error.errors).toEqual({ limit: ['bad limit'], 'fields.role': ['bad role'] })
    })
})

describe('details', () => {
    it('gets the resource description without a body', async () => {
        const body = { data: { actions: [], instructions: [], scout_instructions: [], fields: ['id'], scout_fields: [], limits: [10], scopes: [], relations: [], rules: { all: {}, create: {}, update: {} } } }
        const { driver, sent } = open(200, body)
        const events: string[] = []
        const result = await driver.details('users', undefined, event => events.push(event))
        expect(sent()).toEqual({ url: 'http://localhost:8000/api/users', method: 'GET', body: undefined })
        expect(result).toEqual(body)
        expect(events).toEqual(['request', 'success'])
    })
})
