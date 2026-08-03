import type { ComputedRef, Ref } from 'vue'
import { ZodDefault, type ZodObject, type ZodRawShape, type z } from 'zod'
import { computed, ref } from 'vue'
import type { AnyResource } from 'nexdk'

type Nullable<T> = { [K in keyof T]: T[K] | null }

type FormResource = AnyResource & { schema: ZodObject<ZodRawShape> }
type FormValues<TResource extends FormResource> = Nullable<z.infer<TResource['schema']>>
type FormErrors<TResource extends FormResource> = Partial<
    Record<keyof z.infer<TResource['schema']>, string[]>
>

export interface ResourceFormReturn<TResource extends FormResource> {
    values: Ref<FormValues<TResource>>
    errors: Ref<FormErrors<TResource>>
    isDirty: ComputedRef<boolean>
    handleSubmit: (
        onValid: (data: z.infer<TResource['schema']>) => Promise<void> | void,
    ) => () => Promise<void>
    setServerErrors: (serverErrors: Record<string, string[]>) => void
    fill: (data: Partial<z.infer<TResource['schema']>>) => void
    reset: () => void
}

function buildInitialValues<TResource extends FormResource>(resource: TResource): FormValues<TResource> {
    return Object.fromEntries(
        Object.keys(resource.schema.shape).map(key => {
            const field = resource.schema.shape[key]
            const value = field instanceof ZodDefault ? field._def.defaultValue() : null
            return [key, value]
        }),
    ) as FormValues<TResource>
}

export function useResourceForm<TResource extends FormResource>(
    resource: TResource,
): ResourceFormReturn<TResource> {
    type TValues = FormValues<TResource>
    type TErrors = FormErrors<TResource>

    const initial = buildInitialValues(resource)
    let baseline: TValues = { ...initial }
    const values: Ref<TValues> = ref<TValues>({ ...initial })
    const errors = ref({} as TErrors)

    const isDirty: ComputedRef<boolean> = computed(() => {
        for (const key of Object.keys(baseline) as Array<keyof TValues>) {
            if (values.value[key] !== baseline[key]) return true
        }
        return false
    })

    function handleSubmit(
        onValid: (data: z.infer<TResource['schema']>) => Promise<void> | void,
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

            await onValid(result.data)
        }
    }

    function setServerErrors(serverErrors: Record<string, string[]>): void {
        errors.value = serverErrors as TErrors
    }

    function fill(data: Partial<z.infer<TResource['schema']>>): void {
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
