import { describe, expect, it } from 'vitest'
import { z as z3 } from 'zod'
import { z as z4 } from 'zod/v4'
import { defineResource } from 'nexdk'
import { useResourceForm } from '../src/use-resource-form.ts'

const v3Resource = defineResource({
    name: 'products',
    schema: z3.object({
        name: z3.string().default('untitled'),
        price: z3.number().default(2),
        stock: z3.number(),
    }),
})

const v4Resource = defineResource({
    name: 'products',
    schema: z4.object({
        name: z4.string().default('untitled'),
        price: z4.number().default(() => 2),
        stock: z4.number(),
    }),
})

describe('useResourceForm with zod 3', () => {
    it('reads defaults and leaves other fields null', () => {
        const { values } = useResourceForm(v3Resource)
        expect(values.value).toEqual({ name: 'untitled', price: 2, stock: null })
    })
})

describe('useResourceForm with a schema from another zod instance (zod 4)', () => {
    it('reads defaults by duck typing, including function defaults', () => {
        const { values } = useResourceForm(v4Resource)
        expect(values.value).toEqual({ name: 'untitled', price: 2, stock: null })
    })

    it('validates and returns parsed data', async () => {
        const { values, handleSubmit, errors } = useResourceForm(v4Resource)
        let received: unknown
        values.value.stock = 5
        await handleSubmit(data => {
            received = data
        })()
        expect(errors.value).toEqual({})
        expect(received).toEqual({ name: 'untitled', price: 2, stock: 5 })
    })

    it('collects field errors on invalid data', async () => {
        const { handleSubmit, errors } = useResourceForm(v4Resource)
        await handleSubmit(() => {})()
        expect(Object.keys(errors.value)).toEqual(['stock'])
    })

    it('keeps isDirty, fill and reset consistent', () => {
        const { values, isDirty, fill, reset } = useResourceForm(v4Resource)
        expect(isDirty.value).toBe(false)
        fill({ stock: 3 })
        expect(isDirty.value).toBe(false)
        values.value.price = 9
        expect(isDirty.value).toBe(true)
        reset()
        expect(values.value.price).toBe(2)
    })

})

describe('useResourceForm with a hand-written zod-like schema', () => {
    const standard = z3.object({ a: z3.string() })['~standard']

    const fakeV3Default = { _def: { typeName: 'ZodDefault', defaultValue: () => 7 } }
    const fakeV4Default = { _zod: { def: { type: 'default', defaultValue: 8 } } }
    const plain = { _def: { typeName: 'ZodString' } }

    const resource = defineResource({
        name: 'fakes',
        schema: {
            '~standard': standard,
            shape: { v3: fakeV3Default, v4: fakeV4Default, plain, bare: null },
            safeParse: () => ({ success: true as const, data: {} }),
        } as unknown as z3.ZodObject<{ v3: z3.ZodNumber; v4: z3.ZodNumber; plain: z3.ZodString; bare: z3.ZodString }>,
    })

    it('recognises both default encodings and ignores anything else', () => {
        const { values } = useResourceForm(resource)
        expect(values.value).toEqual({ v3: 7, v4: 8, plain: null, bare: null })
    })
})
