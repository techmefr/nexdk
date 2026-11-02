import { SdkError } from 'nexdk'
import { describe, expect, it, vi } from 'vitest'
import { createStrapiDriver } from '../src/driver.ts'
import { toStrapiQuery } from '../src/query.ts'

function jsonResponse(status: number, value: unknown) {
    return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('strapi empty list operators', () => {
    it('emits an empty value for an empty in and not in list', () => {
        expect(toStrapiQuery({ filters: { role: { $in: [] } } })).toBe('?filters%5Brole%5D%5B%24in%5D=')
        expect(toStrapiQuery({ filters: { role: { $notIn: [] } } })).toBe('?filters%5Brole%5D%5B%24notIn%5D=')
    })

    it('keeps dropping other empty arrays', () => {
        expect(toStrapiQuery({ sort: [], fields: [] })).toBe('')
        expect(toStrapiQuery({ filters: { $or: [] } })).toBe('')
    })

    it('still indexes non empty lists', () => {
        expect(toStrapiQuery({ filters: { role: { $in: ['a'] } } })).toBe('?filters%5Brole%5D%5B%24in%5D%5B0%5D=a')
    })
})

describe('strapi validation error', () => {
    it('exposes the message and the field errors', async () => {
        const injected = vi.fn().mockResolvedValue(
            jsonResponse(400, {
                data: null,
                error: {
                    status: 400,
                    name: 'ValidationError',
                    message: 'name must be defined.',
                    details: { errors: [{ path: ['name'], message: 'name must be defined.', name: 'ValidationError' }] },
                },
            }),
        )
        const driver = createStrapiDriver({ baseUrl: 'http://localhost:1337', fetch: injected as unknown as typeof fetch })

        const error = (await (driver as unknown as { create: (r: string, p: unknown) => Promise<unknown> })
            .create('users', {})
            .catch(e => e)) as SdkError

        expect(error.message).toBe('name must be defined.')
        expect(error.errors).toEqual({ name: ['name must be defined.'] })
        expect(error.status).toBe(400)
    })
})
