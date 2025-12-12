<script setup lang="ts">
import { ref, watch } from 'vue'
import { useUnleash } from './composables/useUnleash'

// Initialize Unleash with the composable
const { unleashClient, isReady, updateTrigger } = useUnleash()

// Reactive flag states
const newCheckout = ref(false)
const darkMode = ref(false)
const premium = ref(false)
const paymentProvider = ref<any>({ enabled: false, name: 'default' })

// Evaluate all flags
const evaluateFlags = () => {
  if (!unleashClient.value) return
  
  newCheckout.value = unleashClient.value.isEnabled('new-checkout-flow')
  darkMode.value = unleashClient.value.isEnabled('dark-mode')
  premium.value = unleashClient.value.isEnabled('premium-features')
  paymentProvider.value = unleashClient.value.getVariant('payment-provider')
}

// Evaluate flags when unleashClient is ready
watch(isReady, (ready) => {
  if (ready) {
    evaluateFlags()
  }
})

// Re-evaluate flags when toolbar changes (updateTrigger increments)
watch(updateTrigger, () => {
  evaluateFlags()
})
</script>

<template>
  <main>
    <h1>🚀 Unleash Toolbar - Vue 3 Example</h1>
    <p>
      This demo shows the Unleash Toolbar with a few feature flags.
    </p>
      <p>
        Feature flags automatically update when you change overrides in the toolbar.
      </p>

      <div v-if="!isReady" class="loading">
        Loading Unleash...
      </div>

      <div v-else class="features">
      <div class="feature-demo">
        <h2>Feature: New Checkout Flow</h2>
        <div v-if="newCheckout">
          <span class="status on">ENABLED</span>
          <p>✅ Users will see the redesigned checkout page.</p>
        </div>
        <div v-else>
          <span class="status off">DISABLED</span>
          <p>❌ Users will see the classic checkout page.</p>
        </div>
      </div>

      <div class="feature-demo">
        <h2>Feature: Dark Mode</h2>
        <div v-if="darkMode">
          <span class="status on">ENABLED</span>
          <p>✅ The app interface will use dark theme colors.</p>
        </div>
        <div v-else>
          <span class="status off">DISABLED</span>
          <p>❌ The app will use the standard light theme.</p>
        </div>
      </div>

      <div class="feature-demo">
        <h2>Feature: Payment Provider (Variant)</h2>
        <div v-if="paymentProvider.enabled">
          <span class="variant-badge">{{ paymentProvider.name }}</span>
          <p>✅ Payment processing will be handled by {{ paymentProvider.name }}.</p>
        </div>
        <div v-else>
          <span class="status off">DISABLED</span>
          <p>❌ Using default payment provider.</p>
        </div>
      </div>

      <div class="feature-demo">
        <h2>Feature: Premium Features</h2>
        <span :class="['status', premium ? 'on' : 'off']">
          {{ premium ? 'ENABLED' : 'DISABLED' }}
        </span>
      </div>

      <div class="info-box">
        <strong>💡 Vue 3 Integration:</strong>
        <ul>
          <li>Uses Composition API with reactive refs</li>
          <li>Subscribes to toolbar events for automatic updates</li>
          <li>Clean lifecycle management with onMounted/onUnmounted</li>
          <li>Works seamlessly with Vue's reactivity system</li>
        </ul>
      </div>
    </div>
  </main>
</template>

<style scoped>
main {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
  background: #f5f6fa;
  min-height: 100vh;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #2c3e50;
  text-align: center;
}

main > p {
  font-size: 1.1rem;
  line-height: 1.6;
  color: #34495e;
  margin-bottom: 1rem;
  text-align: center;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.loading {
  text-align: center;
  padding: 2rem;
  font-size: 1.2rem;
  color: #7f8c8d;
}

.features {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  margin-top: 2rem;
  max-width: 1000px;
  margin-left: auto;
  margin-right: auto;
}

.feature-demo {
  background: white;
  color: #2c3e50;
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid #e1e4e8;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.feature-demo:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.feature-demo h2 {
  font-size: 1.1rem;
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-weight: 600;
}

.status {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.75rem;
}

.status.on {
  background: #d4edda;
  color: #155724;
}

.status.off {
  background: #f8d7da;
  color: #721c24;
}

.variant-badge {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.875rem;
  background: #d1ecf1;
  color: #0c5460;
  text-transform: capitalize;
}

.info-box {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
  border-radius: 12px;
  border: none;
  color: white;
  grid-column: 1 / -1;
}

.info-box strong {
  display: block;
  margin-bottom: 0.75rem;
  color: white;
  font-size: 1.2rem;
}

.info-box ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.info-box li {
  margin: 0.5rem 0;
  color: rgba(255, 255, 255, 0.95);
  line-height: 1.6;
}

code {
  background: #f1f3f4;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.875em;
}

.error-message {
  max-width: 600px;
  margin: 2rem auto;
  padding: 2rem;
  background: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: 8px;
  color: #856404;
}

.error-message h1 {
  margin-top: 0;
  color: #856404;
}

.error-message pre {
  background: #fff;
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid #ffc107;
  overflow-x: auto;
}

.error-message code {
  background: #fff;
  color: #d63384;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-family: 'Monaco', 'Courier New', monospace;
}
</style>
