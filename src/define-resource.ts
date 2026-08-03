import type { StandardSchemaV1 } from './standard-schema.ts'
import type { Resource, ResourceConfig } from './types.ts'

export function defineResource<TSchema extends StandardSchemaV1>(
    config: ResourceConfig<TSchema>,
): Resource<TSchema> {
    return {
        name: config.name,
        schema: config.schema,
        fragments: config.fragments ?? {},
        relations: config.relations ?? {},
    }
}
