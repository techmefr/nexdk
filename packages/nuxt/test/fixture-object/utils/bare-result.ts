export async function firstName(): Promise<string | undefined> {
    const result = await useSdk().lomkit.users.get({})
    return result.data[0]?.name
}

export async function noErrorKey(): Promise<unknown> {
    const result = await useSdk().lomkit.users.get({})
    // @ts-expect-error with throw: true a call resolves the bare value, without an error key
    return result.error
}
