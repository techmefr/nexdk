// Minimal Standard Schema v1 contract (https://standardschema.dev), copied
// verbatim per the spec's own guidance instead of adding a dependency — any
// validator that implements it (Zod 3.24+, Valibot, ArkType, …) plugs into
// `defineResource` as-is, so nexdk stays validator-agnostic and dependency-free.
export interface StandardSchemaV1<Input = unknown, Output = Input> {
    readonly '~standard': StandardSchemaV1.Props<Input, Output>
}

export declare namespace StandardSchemaV1 {
    export interface Props<Input = unknown, Output = Input> {
        readonly version: 1
        readonly vendor: string
        validate(value: unknown): Result<Output> | Promise<Result<Output>>
        readonly types?: Types<Input, Output> | undefined
    }

    export type Result<Output> = SuccessResult<Output> | FailureResult

    export interface SuccessResult<Output> {
        readonly value: Output
        readonly issues?: undefined
    }

    export interface FailureResult {
        readonly issues: ReadonlyArray<Issue>
    }

    export interface Issue {
        readonly message: string
        readonly path?: ReadonlyArray<PathSegment | PropertyKey> | undefined
    }

    export interface PathSegment {
        readonly key: PropertyKey
    }

    export interface Types<Input = unknown, Output = Input> {
        readonly input: Input
        readonly output: Output
    }

    export type InferInput<Schema extends StandardSchemaV1> =
        NonNullable<Schema['~standard']['types']>['input']

    export type InferOutput<Schema extends StandardSchemaV1> =
        NonNullable<Schema['~standard']['types']>['output']
}
