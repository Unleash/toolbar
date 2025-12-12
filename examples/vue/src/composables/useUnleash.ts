import { ref, onMounted, onUnmounted } from 'vue'
import { UnleashClient } from 'unleash-proxy-client'
import { initUnleashToolbar } from '@unleash/toolbar'
import '@unleash/toolbar/toolbar.css'

export function useUnleash() {
  const isReady = ref(false)
  const unleashClient = ref<UnleashClient | null>(null)
  const updateTrigger = ref(0) // Used to trigger reactive updates

  function initializeClient() {
    const client = new UnleashClient({
      url: import.meta.env.VITE_UNLEASH_URL,
      clientKey: import.meta.env.VITE_UNLEASH_CLIENT_KEY,
      appName: import.meta.env.VITE_UNLEASH_APP_NAME,
      environment: 'development',
      refreshInterval: 15,
      context: {
        userId: 'user-vue-123',
        properties: {
          userRole: 'developer',
          region: 'eu-west',
        },
      },
    })

    // Wrap with toolbar in development mode
    if (import.meta.env.DEV) {
      return initUnleashToolbar(client, {
        themePreset: 'dark',
        initiallyVisible: false,
      })
    }

    return client
  }

  let unsubscribe: (() => void) | undefined

  onMounted(async () => {
    unleashClient.value = initializeClient()
    await unleashClient.value.start()
    isReady.value = true

    // Subscribe to toolbar events in development mode
    if (import.meta.env.DEV && (window as any).unleashToolbar) {
      unsubscribe = (window as any).unleashToolbar.subscribe((event: any) => {
        if (
          event.type === 'flag_override_changed' ||
          event.type === 'context_override_changed' ||
          event.type === 'sdk_updated'
        ) {
          // Trigger re-evaluation by incrementing the update trigger
          updateTrigger.value++
        }
      })
    }
  })

  onUnmounted(() => {
    unsubscribe?.()
  })

  return {
    unleashClient,
    isReady,
    updateTrigger, // Components can watch this to know when to re-evaluate flags
  }
}
