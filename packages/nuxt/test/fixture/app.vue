<script setup lang="ts">
const sdk = useSdk()
const { data: rows } = await useAsyncData('users', async () => {
    const { data, error } = await sdk.lomkit.users.get({ search: { limit: 2 } })
    if (error) throw error
    return data.data
})

const clientRows = ref('')

async function reload() {
    const { data } = await useSdk().lomkit.users.get({})
    clientRows.value = (data?.data ?? []).map(row => `${row.name}:${row.side}`).join(',')
}
</script>

<template>
    <main>
        <ul>
            <li v-for="row in rows" :key="row.id" data-testid="row">{{ row.name }} ({{ row.side }})</li>
        </ul>
        <button data-testid="reload" @click="reload">reload</button>
        <p data-testid="client">{{ clientRows }}</p>
        <p data-testid="provided">{{ typeof $sdk.lomkit.users.get }}</p>
    </main>
</template>
