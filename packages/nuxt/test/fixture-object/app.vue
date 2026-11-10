<script setup lang="ts">
const { data: name } = await useAsyncData('user', async () => {
    const result = await useSdk().lomkit.users.get({})
    return result.data[0]?.name ?? ''
})
</script>

<template>
    <main>
        <p data-testid="name">{{ name }}</p>
    </main>
</template>
