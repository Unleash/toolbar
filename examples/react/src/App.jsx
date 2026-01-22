import { useFlag, useVariant } from '@unleash/proxy-client-react'
import { UnleashToolbarProvider } from '../../../dist/react.es.js'
import '../../../dist/toolbar.css'

// Unleash configuration - matches official React SDK API
const unleashConfig = {
  url: import.meta.env.VITE_UNLEASH_URL,
  clientKey: import.meta.env.VITE_UNLEASH_CLIENT_KEY,
  appName: import.meta.env.VITE_UNLEASH_APP_NAME,
  environment: 'development',
  refreshInterval: 15,
  context: {
    userId: 'user-react-123',
    environment: 'development',
    properties: {
      userRole: 'developer',
      region: 'eu-west',
    },
  },
};

function FeatureFlags() {
  // Use hooks from the official Unleash React SDK
  // They automatically handle re-renders on flag changes!
  const newCheckout = useFlag('new-checkout-flow');
  const darkMode = useFlag('dark-mode');
  const premium = useFlag('premium-features');
  const paymentVariant = useVariant('payment-provider');

  return (
    <>
      <h1>🚀 Unleash Toolbar - React Example</h1>
      <p>
        This demo shows the Unleash Toolbar integrated with the <strong>official Unleash React SDK</strong>.
      </p>
      <p>
        The toolbar wraps the SDK's client to provide override functionality.
        Open the toolbar (bottom-right button) to test overrides!
      </p>

      <div className="feature-demo">
        <h2>Feature: New Checkout Flow</h2>
        {newCheckout ? (
          <div>
            <span className="status on">ENABLED</span>
            <p>✅ Users will see the redesigned checkout page with improved UX.</p>
          </div>
        ) : (
          <div>
            <span className="status off">DISABLED</span>
            <p>❌ Users will see the classic checkout page.</p>
          </div>
        )}
      </div>

      <div className="feature-demo">
        <h2>Feature: Dark Mode</h2>
        {darkMode ? (
          <div>
            <span className="status on">ENABLED</span>
            <p>✅ The app interface will use dark theme colors.</p>
          </div>
        ) : (
          <div>
            <span className="status off">DISABLED</span>
            <p>❌ The app will use the standard light theme.</p>
          </div>
        )}
      </div>

      <div className="feature-demo">
        <h2>Feature: Payment Provider (Variant)</h2>
        {paymentVariant.enabled ? (
          <div>
            <span className="variant-badge">{paymentVariant.name}</span>
            <p>✅ Payment processing will be handled by {paymentVariant.name}.</p>
          </div>
        ) : (
          <div>
            <span className="status off">DISABLED</span>
            <p>❌ Using default payment provider.</p>
          </div>
        )}
      </div>

      <div className="feature-demo">
        <h2>Feature: Premium Features</h2>
        {premium ? (
          <div>
            <span className="status on">ENABLED</span>
            <p>✅ Users have access to advanced analytics and priority support.</p>
          </div>
        ) : (
          <div>
            <span className="status off">DISABLED</span>
            <p>❌ Standard feature set only.</p>
          </div>
        )}
      </div>

      <div className="info-box">
        <strong>💡 Integration is Simple:</strong>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>Just pass your <code>config</code> to <code>UnleashToolbarProvider</code></li>
          <li>Use official <code>@unleash/proxy-client-react</code> hooks</li>
          <li><code>useFlag('flag-name')</code> returns a boolean that auto-updates</li>
          <li><code>useVariant('flag-name')</code> returns a variant object</li>
          <li>No need to import or manage FlagProvider!</li>
        </ul>
      </div>
    </>
  )
}

function App() {
  return (
    <UnleashToolbarProvider 
      config={unleashConfig}
      toolbarOptions={import.meta.env.DEV ? {
        themePreset: 'dark',
        initiallyVisible: false,
      } : undefined}
    >
      <FeatureFlags />
    </UnleashToolbarProvider>
  );
}

export default App
