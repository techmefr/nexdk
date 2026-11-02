import { defineResource } from 'nexdk'
import { describe, expectTypeOf, it } from 'vitest'
import { z as z3 } from 'zod'
import { z as z4 } from 'zod/v4'
import { useResourceForm } from '../src/use-resource-form.ts'

const v3Resource = defineResource({
    name: 'products',
    schema: z3.object({ name: z3.string().default('x'), price: z3.number() }),
})

const v4Resource = defineResource({
    name: 'products',
    schema: z4.object({ name: z4.string().default('x'), price: z4.number() }),
})

describe('useResourceForm types', () => {
    it('infers values and parsed data from a zod 3 schema', () => {
        const form = useResourceForm(v3Resource)
        expectTypeOf(form.values.value.price).toEqualTypeOf<number | null>()
        form.handleSubmit(data => {
            expectTypeOf(data).toEqualTypeOf<{ name: string; price: number }>()
        })
    })

    it('infers values and parsed data from a zod 4 schema', () => {
        const form = useResourceForm(v4Resource)
        expectTypeOf(form.values.value.price).toEqualTypeOf<number | null>()
        expectTypeOf(form.values.value.name).toEqualTypeOf<string | null>()
        form.handleSubmit(data => {
            expectTypeOf(data).toEqualTypeOf<{ name: string; price: number }>()
        })
    })

    it('rejects a schema that is not an object schema', () => {
        // @ts-expect-error a string schema has no shape
        useResourceForm(defineResource({ name: 'x', schema: z4.string() }))
    })
})
