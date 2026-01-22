import type { UnleashClient } from 'unleash-proxy-client';
import { UnleashToolbarProvider } from '../index';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

// Mock the official FlagProvider
const MockFlagProvider = ({ 
  children, 
  unleashClient,
  startClient,
}: { 
  children: React.ReactNode;
  unleashClient?: UnleashClient;
  startClient?: boolean;
  [key: string]: any;
}) => {
  return <div data-testid="mock-flag-provider" data-client={unleashClient ? 'present' : 'missing'} data-start-client={String(startClient)}>{children}</div>;
};

describe('UnleashToolbarProvider', () => {
  let mockClient: UnleashClient;
  let mockConfig: any;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    mockClient = {
      isEnabled: vi.fn(() => false),
      getVariant: vi.fn(() => ({ name: 'disabled', enabled: false })),
      getContext: vi.fn(() => ({})),
      updateContext: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      off: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      getAllToggles: vi.fn(() => []),
      setContextField: vi.fn(),
    } as unknown as UnleashClient;

    mockConfig = {
      url: 'https://test.unleash.io/api/frontend',
      clientKey: 'test-key',
      appName: 'test-app'
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render with children when using client prop', () => {
    render(
      <UnleashToolbarProvider 
        client={mockClient}
      >
        <div>Test Content</div>
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Test Content')).toBeDefined();
  });

  it('should render with children when using config prop', () => {
    render(
      <UnleashToolbarProvider 
        config={mockConfig}
      >
        <div>Test Content</div>
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Test Content')).toBeDefined();
  });

  it('should use default FlagProvider when not provided', () => {
    // Uses the default imported FlagProvider from @unleash/proxy-client-react
    render(
      <UnleashToolbarProvider 
        config={mockConfig}
      >
        <div>Test Content</div>
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Test Content')).toBeDefined();
  });

  it('should throw error when neither config nor client is provided', () => {
    const originalError = console.error;
    console.error = vi.fn(); // Suppress error output in test

    expect(() => {
      render(
        <UnleashToolbarProvider>
          <div>Test</div>
        </UnleashToolbarProvider>
      );
    }).toThrow('Either "config" or "client" prop must be provided');

    console.error = originalError;
  });

  it('should throw error when both config and client are provided', () => {
    const originalError = console.error;
    console.error = vi.fn(); // Suppress error output in test

    expect(() => {
      render(
        <UnleashToolbarProvider 
          config={mockConfig}
          client={mockClient}
        >
          <div>Test</div>
        </UnleashToolbarProvider>
      );
    }).toThrow('Provide either "config" or "client" prop, not both');

    console.error = originalError;
  });

  it('should pass wrapped client to FlagProvider', () => {
    render(
      <UnleashToolbarProvider 
        FlagProvider={MockFlagProvider}
        client={mockClient}
      >
        <div>Test</div>
      </UnleashToolbarProvider>
    );

    const provider = screen.getByTestId('mock-flag-provider');
    expect(provider.getAttribute('data-client')).toBe('present');
  });

  it('should accept toolbar options', () => {
    const toolbarOptions = {
      storageMode: 'session' as const,
      storageKey: 'custom-key',
      sortAlphabetically: true,
    };

    render(
      <UnleashToolbarProvider 
        client={mockClient} 
        toolbarOptions={toolbarOptions}
      >
        <div>Test</div>
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Test')).toBeDefined();
  });

  it('should not initialize toolbar when toolbarOptions is undefined (production mode)', () => {
    render(
      <UnleashToolbarProvider 
        client={mockClient} 
        toolbarOptions={undefined}
      >
        <div>Test</div>
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Test')).toBeDefined();
  });

  it('should pass startClient prop to FlagProvider', () => {
    render(
      <UnleashToolbarProvider 
        FlagProvider={MockFlagProvider}
        client={mockClient}
        startClient={false}
      >
        <div>Test</div>
      </UnleashToolbarProvider>
    );

    const provider = screen.getByTestId('mock-flag-provider');
    expect(provider.getAttribute('data-start-client')).toBe('false');
  });

  it('should default startClient to true', () => {
    render(
      <UnleashToolbarProvider 
        FlagProvider={MockFlagProvider}
        client={mockClient}
      >
        <div>Test</div>
      </UnleashToolbarProvider>
    );

    const provider = screen.getByTestId('mock-flag-provider');
    expect(provider.getAttribute('data-start-client')).toBe('true');
  });

  it('should pass additional props to custom FlagProvider', () => {
    const CustomFlagProvider = ({ 
      children, 
      customProp,
    }: { 
      children: React.ReactNode;
      customProp?: string;
      unleashClient?: UnleashClient;
      [key: string]: any;
    }) => {
      return <div data-testid="custom-provider" data-custom-prop={customProp}>{children}</div>;
    };

    render(
      <UnleashToolbarProvider 
        FlagProvider={CustomFlagProvider}
        client={mockClient}
        customProp="test-value"
      >
        <div>Test</div>
      </UnleashToolbarProvider>
    );

    const provider = screen.getByTestId('custom-provider');
    expect(provider.getAttribute('data-custom-prop')).toBe('test-value');
  });

  // Tests for custom FlagProvider functionality
  it('should accept custom FlagProvider and pass wrapped client to it', () => {
    render(
      <UnleashToolbarProvider 
        FlagProvider={MockFlagProvider}
        client={mockClient}
      >
        <div>Test</div>
      </UnleashToolbarProvider>
    );

    const provider = screen.getByTestId('mock-flag-provider');
    expect(provider.getAttribute('data-client')).toBe('present');
  });

  it('should accept custom FlagProvider with config prop', () => {
    render(
      <UnleashToolbarProvider 
        FlagProvider={MockFlagProvider}
        config={mockConfig}
      >
        <div>Custom Provider Content</div>
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Custom Provider Content')).toBeDefined();
    expect(screen.getByTestId('mock-flag-provider')).toBeDefined();
  });

  it('should pass startClient prop to custom FlagProvider', () => {
    render(
      <UnleashToolbarProvider 
        FlagProvider={MockFlagProvider}
        client={mockClient}
        startClient={false}
      >
        <div>Test</div>
      </UnleashToolbarProvider>
    );

    const provider = screen.getByTestId('mock-flag-provider');
    expect(provider.getAttribute('data-start-client')).toBe('false');
  });

  it('should default startClient to true with custom FlagProvider', () => {
    render(
      <UnleashToolbarProvider 
        FlagProvider={MockFlagProvider}
        client={mockClient}
      >
        <div>Test</div>
      </UnleashToolbarProvider>
    );

    const provider = screen.getByTestId('mock-flag-provider');
    expect(provider.getAttribute('data-start-client')).toBe('true');
  });

  it('should allow custom FlagProvider to override default', () => {
    const CustomProvider = ({ children }: { children: React.ReactNode; [key: string]: any }) => {
      return <div data-testid="very-custom-provider">{children}</div>;
    };

    render(
      <UnleashToolbarProvider 
        FlagProvider={CustomProvider}
        client={mockClient}
      >
        <div>Override Test</div>
      </UnleashToolbarProvider>
    );

    expect(screen.getByTestId('very-custom-provider')).toBeDefined();
    expect(screen.getByText('Override Test')).toBeDefined();
  });
});
