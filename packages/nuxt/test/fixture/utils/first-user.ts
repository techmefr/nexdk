export async function firstUserName(): Promise<string | undefined> {
    const { data } = await useSdk().lomkit.users.get({ search: { limit: 1 } }, undefined, { timeout: 1000 })
    return data?.data[0]?.name
}

export async function misreadName(): Promise<number | undefined> {
    const { data } = await useNuxtApp().$sdk.lomkit.users.get({})
    // @ts-expect-error a user name is a string
    return data?.data[0]?.name
}
