import type { StatusContext, StatusError, StatusHandler, StatusHandlers } from './types.ts'

function handlerFor(handlers: StatusHandlers, status: number): StatusHandler | undefined {
    const exact = handlers[status]
    if (exact !== undefined) return exact
    if (status >= 400 && status < 500) return handlers['4xx']
    if (status >= 500 && status < 600) return handlers['5xx']
    return undefined
}

function hasStatus(error: unknown): error is StatusError {
    return error instanceof Error && typeof (error as { status?: unknown }).status === 'number'
}

export async function reactToStatus(
    handlers: StatusHandlers,
    error: unknown,
    context: Omit<StatusContext, 'error'>,
): Promise<void> {
    if (!hasStatus(error)) return
    const handler = handlerFor(handlers, error.status)
    if (handler === undefined) return
    try {
        await handler({ error, ...context })
    } catch {
        return
    }
}
