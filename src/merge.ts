import type { SdkEventHandler } from './types.ts'

export function mergeEventHandlers(
    global: SdkEventHandler | undefined,
    local: SdkEventHandler | undefined,
): SdkEventHandler | undefined {
    if (global === undefined) return local
    if (local === undefined) return global
    return (event, data) => {
        let failure: { error: unknown } | undefined
        for (const handler of [global, local]) {
            try {
                handler(event, data)
            } catch (error) {
                failure ??= { error }
            }
        }
        if (failure) throw failure.error
    }
}
