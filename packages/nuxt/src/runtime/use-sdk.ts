import { useNuxtApp } from '#app'
import type { NuxtApp } from '#app'

export function useSdk(): NuxtApp['$sdk'] {
    return useNuxtApp().$sdk
}
