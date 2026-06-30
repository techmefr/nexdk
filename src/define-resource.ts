import type { ZodTypeAny } from 'zod'
import type { Resource, ResourceConfig } from './types.ts'

export function defineResource<TSchema extends ZodTypeAny>(
    config: ResourceConfig<TSchema>,
): Resource<TSchema> {
    return {
        name: config.name,
        schema: config.schema,
        fragments: config.fragments ?? {},
        relations: config.relations ?? {},
    }
}
