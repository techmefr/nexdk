import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'
import type { AnyResource, StandardSchemaV1 } from 'nexdk'

type Nullable<T> = { [K in keyof T]: T[K] | null }

interface FormIssue {
    path: ReadonlyArray<PropertyKey>
    message: string
}

type FormParseResult =
    | { success: true; data: unknown }
    | { success: false; error: { issues: ReadonlyArray<FormIssue> } }

export type FormSchema = StandardSchemaV1 & {
    shape: Record<string, unknown>
    safeParse(value: unknown): FormParseResult
}

type FormResource = AnyResource & { schema: FormSchema }
type Output<TResource extends FormResource> = StandardSchemaV1.InferOutput<TResource['schema']>
type FormValues<TResource extends FormResource> = Nullable<Output<TResource>>
type FormErrors<TResource extends FormResource> = Partial<Record<keyof Output<TResource>, string[]>>

export interface ResourceFormReturn<TResource extends FormResource> {
    values: Ref<FormValues<TResource>>
    errors: Ref<FormErrors<TResource>>
    isDirty: ComputedRef<boolean>
    handleSubmit: (
        onValid: (data: Output<TResource>) => Promise<void> | void,
    ) => () => Promise<void>
    setServerErrors: (serverErrors: Record<string, string[]>) => void
    fill: (data: Partial<Output<TResource>>) => void
    reset: () => void
}

interface ZodV3Def {
    typeName?: unknown
    defaultValue?: unknown
}

interface ZodV4Def {
    type?: unknown
    defaultValue?: unknown
}

function readDefault(field: unknown): unknown {
    if (field === null || typeof field !== 'object') return null
    const candidate = field as { _def?: ZodV3Def; _zod?: { def?: ZodV4Def } }

    const v3 = candidate._def
    if (v3?.typeName === 'ZodDefault' && typeof v3.defaultValue === 'function') {
        return (v3.defaultValue as () => unknown)()
    }

    const v4 = candidate._zod?.def
    if (v4?.type === 'default') {
        return typeof v4.defaultValue === 'function' ? (v4.defaultValue as () => unknown)() : v4.defaultValue
    }

    return null
}

export class ResourceFormSchemaError extends Error {
    constructor(resourceName: string) {
        super(`useResourceForm needs a Zod object schema with shape and safeParse: resource "${resourceName}" has none`)
        this.name = 'ResourceFormSchemaError'
    }
}

function assertFormSchema(resource: AnyResource): void {
    const schema = resource.schema as { shape?: unknown; safeParse?: unknown }
    const hasShape = schema.shape !== null && typeof schema.shape === 'object'
    if (!hasShape || typeof schema.safeParse !== 'function') throw new ResourceFormSchemaError(resource.name)
}

function buildInitialValues<TResource extends FormResource>(resource: TResource): FormValues<TResource> {
    return Object.fromEntries(
        Object.entries(resource.schema.shape).map(([key, field]) => [key, readDefault(field)]),
    ) as FormValues<TResource>
}

export function useResourceForm<TResource extends FormResource>(
    resource: TResource,
): ResourceFormReturn<TResource> {
    type TValues = FormValues<TResource>
    type TErrors = FormErrors<TResource>

    assertFormSchema(resource)

    const initial = buildInitialValues(resource)
    let baseline: TValues = { ...initial }
    const values = ref({ ...initial }) as Ref<TValues>
    const errors = ref({} as TErrors)

    const isDirty: ComputedRef<boolean> = computed(() => {
        for (const key of Object.keys(baseline) as Array<keyof TValues>) {
            if (values.value[key] !== baseline[key]) return true
        }
        return false
    })

    function handleSubmit(
        onValid: (data: Output<TResource>) => Promise<void> | void,
    ): () => Promise<void> {
        return async (): Promise<void> => {
            errors.value = {} as TErrors

            const result = resource.schema.safeParse(values.value)

            if (!result.success) {
                const fieldErrors = {} as Record<string, string[]>
                for (const issue of result.error.issues) {
                    const field = String(issue.path[0] ?? '_')
                    fieldErrors[field] ??= []
                    fieldErrors[field].push(issue.message)
                }
                errors.value = fieldErrors as TErrors
                return
            }

            await onValid(result.data as Output<TResource>)
        }
    }

    function setServerErrors(serverErrors: Record<string, string[]>): void {
        errors.value = serverErrors as TErrors
    }

    function fill(data: Partial<Output<TResource>>): void {
        Object.assign(values.value, data)
        baseline = { ...initial, ...data } as TValues
    }

    function reset(): void {
        values.value = { ...initial }
        baseline = { ...initial }
        errors.value = {} as TErrors
    }

    return { values, errors: errors as Ref<TErrors>, isDirty, handleSubmit, setServerErrors, fill, reset }
}
