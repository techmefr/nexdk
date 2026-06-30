import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { defineResource } from '../src/define-resource.ts'

const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email(),
})

describe('defineResource', () => {
    it('stores name and schema', () => {
        const resource = defineResource({ name: 'users', schema: UserSchema })
        expect(resource.name).toBe('users')
        expect(resource.schema).toBe(UserSchema)
    })

    it('defaults fragments and relations to empty objects', () => {
        const resource = defineResource({ name: 'users', schema: UserSchema })
        expect(resource.fragments).toEqual({})
        expect(resource.relations).toEqual({})
    })

    it('stores fragments when provided', () => {
        const resource = defineResource({
            name: 'users',
            schema: UserSchema,
            fragments: { withPosts: ['id', 'name', 'posts { id title }'] },
        })
        expect(resource.fragments['withPosts']).toEqual(['id', 'name', 'posts { id title }'])
    })
})
