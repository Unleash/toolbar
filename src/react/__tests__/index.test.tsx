import type { UnleashClient } from 'unleash-proxy-client';
import { UnleashToolbarProvider, useFlag, useUnleashClient, useVariant } from '../index';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('UnleashToolbarProvider', () => {
  let mockClient: UnleashClient;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    mockClient = {
      isEnabled: vi.fn(() => false),
      getVariant: vi.fn(() => ({ name: 'disabled', enabled: false })),
      getContext: vi.fn(() => ({})),
      updateContext: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      start: vi.fn(),
    } as unknown as UnleashClient;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render children', () => {
    render(
      <UnleashToolbarProvider client={mockClient}>
        <div>Test Content</div>
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Test Content')).toBeDefined();
  });

  it('should initialize toolbar with client', () => {
    render(
      <UnleashToolbarProvider client={mockClient}>
        <div>Test</div>
      </UnleashToolbarProvider>
    );

    expect(mockClient.start).toHaveBeenCalledOnce();
  });

  it('should accept toolbar options', () => {
    const toolbarOptions = {
      storageMode: 'session' as const,
      storageKey: 'custom-key',
      sortAlphabetically: true,
    };

    render(
      <UnleashToolbarProvider client={mockClient} toolbarOptions={toolbarOptions}>
        <div>Test</div>
      </UnleashToolbarProvider>
    );

    expect(mockClient.start).toHaveBeenCalled();
  });

  it('should not initialize toolbar when toolbarOptions is undefined (production mode)', () => {
    render(
      <UnleashToolbarProvider client={mockClient} toolbarOptions={undefined}>
        <div>Test</div>
      </UnleashToolbarProvider>
    );

    expect(mockClient.start).toHaveBeenCalled();
  });
});

describe('useUnleashClient', () => {
  let mockClient: UnleashClient;

  beforeEach(() => {
    localStorage.clear();
    mockClient = {
      isEnabled: vi.fn(() => false),
      getVariant: vi.fn(() => ({ name: 'disabled', enabled: false })),
      getContext: vi.fn(() => ({})),
      updateContext: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      start: vi.fn(),
    } as unknown as UnleashClient;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should return the wrapped client', () => {
    function TestComponent() {
      const client = useUnleashClient();
      return <div>{client ? 'Client Found' : 'No Client'}</div>;
    }

    render(
      <UnleashToolbarProvider client={mockClient}>
        <TestComponent />
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Client Found')).toBeDefined();
  });

  it('should throw error when used outside provider', () => {
    function TestComponent() {
      try {
        useUnleashClient();
      } catch (error) {
        return <div>{(error as Error).message}</div>;
      }
      return <div>Test</div>;
    }

    render(<TestComponent />);
    expect(screen.getByText('useUnleashClient must be used within UnleashToolbarProvider')).toBeDefined();
  });
});

describe('useFlag', () => {
  let mockClient: UnleashClient;

  beforeEach(() => {
    localStorage.clear();
    mockClient = {
      isEnabled: vi.fn(() => false),
      getVariant: vi.fn(() => ({ name: 'disabled', enabled: false })),
      getContext: vi.fn(() => ({})),
      updateContext: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      start: vi.fn(),
    } as unknown as UnleashClient;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should return flag state', () => {
    (mockClient.isEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    function TestComponent() {
      const enabled = useFlag('test-flag');
      return <div>{enabled ? 'Enabled' : 'Disabled'}</div>;
    }

    render(
      <UnleashToolbarProvider client={mockClient}>
        <TestComponent />
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Enabled')).toBeDefined();
    expect(mockClient.isEnabled).toHaveBeenCalledWith('test-flag');
  });

  it('should return false when flag is disabled', () => {
    (mockClient.isEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);

    function TestComponent() {
      const enabled = useFlag('test-flag');
      return <div>{enabled ? 'Enabled' : 'Disabled'}</div>;
    }

    render(
      <UnleashToolbarProvider client={mockClient}>
        <TestComponent />
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Disabled')).toBeDefined();
  });

  it('should update when flag changes', async () => {
    let updateCallback: (() => void) | undefined;
    const testClient = {
      isEnabled: vi.fn(() => false),
      getVariant: vi.fn(() => ({ name: 'disabled', enabled: false })),
      getContext: vi.fn(() => ({})),
      updateContext: vi.fn(() => Promise.resolve()),
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'update') {
          updateCallback = callback;
        }
      }),
      start: vi.fn(),
    } as unknown as UnleashClient;

    function TestComponent() {
      const enabled = useFlag('test-flag');
      return <div>{enabled ? 'Enabled' : 'Disabled'}</div>;
    }

    render(
      <UnleashToolbarProvider client={testClient}>
        <TestComponent />
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Disabled')).toBeDefined();

    // Change the flag value and trigger update
    (testClient.isEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    if (updateCallback) {
      updateCallback();
    }

    await waitFor(() => {
      expect(screen.getByText('Enabled')).toBeDefined();
    });
  });

  it('should throw error when used outside provider', () => {
    function TestComponent() {
      try {
        useFlag('test-flag');
      } catch (error) {
        return <div>{(error as Error).message}</div>;
      }
      return <div>Test</div>;
    }

    render(<TestComponent />);
    expect(screen.getByText('useFlag must be used within UnleashToolbarProvider')).toBeDefined();
  });

  it('should handle multiple flags independently', () => {
    (mockClient.isEnabled as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
      return name === 'flag1';
    });

    function TestComponent() {
      const flag1 = useFlag('flag1');
      const flag2 = useFlag('flag2');
      return (
        <div>
          <span>Flag1: {flag1 ? 'On' : 'Off'}</span>
          <span>Flag2: {flag2 ? 'On' : 'Off'}</span>
        </div>
      );
    }

    render(
      <UnleashToolbarProvider client={mockClient}>
        <TestComponent />
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Flag1: On')).toBeDefined();
    expect(screen.getByText('Flag2: Off')).toBeDefined();
  });
});

describe('useVariant', () => {
  let mockClient: UnleashClient;

  beforeEach(() => {
    localStorage.clear();
    mockClient = {
      isEnabled: vi.fn(() => false),
      getVariant: vi.fn(() => ({ name: 'disabled', enabled: false })),
      getContext: vi.fn(() => ({})),
      updateContext: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      start: vi.fn(),
    } as unknown as UnleashClient;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should return variant', () => {
    const mockVariant = { name: 'blue', enabled: true, payload: { type: 'string', value: 'test' } };
    (mockClient.getVariant as ReturnType<typeof vi.fn>).mockReturnValue(mockVariant);

    function TestComponent() {
      const variant = useVariant('test-flag');
      return <div>Variant: {variant.name}</div>;
    }

    render(
      <UnleashToolbarProvider client={mockClient}>
        <TestComponent />
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Variant: blue')).toBeDefined();
    expect(mockClient.getVariant).toHaveBeenCalledWith('test-flag');
  });

  it('should return disabled variant when flag is disabled', () => {
    const mockVariant = { name: 'disabled', enabled: false };
    (mockClient.getVariant as ReturnType<typeof vi.fn>).mockReturnValue(mockVariant);

    function TestComponent() {
      const variant = useVariant('test-flag');
      return <div>Variant: {variant.name}</div>;
    }

    render(
      <UnleashToolbarProvider client={mockClient}>
        <TestComponent />
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Variant: disabled')).toBeDefined();
  });

  it('should update when variant changes', async () => {
    let updateCallback: (() => void) | undefined;
    const testClient = {
      isEnabled: vi.fn(() => false),
      getVariant: vi.fn(() => ({ name: 'control', enabled: true })),
      getContext: vi.fn(() => ({})),
      updateContext: vi.fn(() => Promise.resolve()),
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'update') {
          updateCallback = callback;
        }
      }),
      start: vi.fn(),
    } as unknown as UnleashClient;

    function TestComponent() {
      const variant = useVariant('test-flag');
      return <div>Variant: {variant.name}</div>;
    }

    render(
      <UnleashToolbarProvider client={testClient}>
        <TestComponent />
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Variant: control')).toBeDefined();

    // Change the variant and trigger update
    (testClient.getVariant as ReturnType<typeof vi.fn>).mockReturnValue({
      name: 'treatment',
      enabled: true,
    });

    if (updateCallback) {
      updateCallback();
    }

    await waitFor(() => {
      expect(screen.getByText('Variant: treatment')).toBeDefined();
    });
  });

  it('should throw error when used outside provider', () => {
    function TestComponent() {
      try {
        useVariant('test-flag');
      } catch (error) {
        return <div>{(error as Error).message}</div>;
      }
      return <div>Test</div>;
    }

    render(<TestComponent />);
    expect(screen.getByText('useVariant must be used within UnleashToolbarProvider')).toBeDefined();
  });

  it('should handle multiple variants independently', () => {
    (mockClient.getVariant as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
      if (name === 'flag1') return { name: 'blue', enabled: true };
      if (name === 'flag2') return { name: 'red', enabled: true };
      return { name: 'disabled', enabled: false };
    });

    function TestComponent() {
      const variant1 = useVariant('flag1');
      const variant2 = useVariant('flag2');
      return (
        <div>
          <span>Variant1: {variant1.name}</span>
          <span>Variant2: {variant2.name}</span>
        </div>
      );
    }

    render(
      <UnleashToolbarProvider client={mockClient}>
        <TestComponent />
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Variant1: blue')).toBeDefined();
    expect(screen.getByText('Variant2: red')).toBeDefined();
  });

  it('should handle variant with payload', () => {
    const mockVariant = {
      name: 'experiment',
      enabled: true,
      payload: { type: 'json', value: '{"key": "value"}' },
    };
    (mockClient.getVariant as ReturnType<typeof vi.fn>).mockReturnValue(mockVariant);

    function TestComponent() {
      const variant = useVariant('test-flag');
      return (
        <div>
          <span>Name: {variant.name}</span>
          <span>Payload: {variant.payload?.value}</span>
        </div>
      );
    }

    render(
      <UnleashToolbarProvider client={mockClient}>
        <TestComponent />
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Name: experiment')).toBeDefined();
    expect(screen.getByText('Payload: {"key": "value"}')).toBeDefined();
  });
});

describe('Integration tests', () => {
  let mockClient: UnleashClient;

  beforeEach(() => {
    localStorage.clear();
    mockClient = {
      isEnabled: vi.fn(() => false),
      getVariant: vi.fn(() => ({ name: 'disabled', enabled: false })),
      getContext: vi.fn(() => ({})),
      updateContext: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      start: vi.fn(),
    } as unknown as UnleashClient;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should work with both useFlag and useVariant in same component', () => {
    (mockClient.isEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (mockClient.getVariant as ReturnType<typeof vi.fn>).mockReturnValue({
      name: 'blue',
      enabled: true,
    });

    function TestComponent() {
      const enabled = useFlag('test-flag');
      const variant = useVariant('test-flag');
      return (
        <div>
          <span>Enabled: {enabled ? 'Yes' : 'No'}</span>
          <span>Variant: {variant.name}</span>
        </div>
      );
    }

    render(
      <UnleashToolbarProvider client={mockClient}>
        <TestComponent />
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Enabled: Yes')).toBeDefined();
    expect(screen.getByText('Variant: blue')).toBeDefined();
  });

  it('should work with nested components', () => {
    (mockClient.isEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    function ChildComponent() {
      const enabled = useFlag('child-flag');
      return <span>Child: {enabled ? 'On' : 'Off'}</span>;
    }

    function ParentComponent() {
      const enabled = useFlag('parent-flag');
      return (
        <div>
          <span>Parent: {enabled ? 'On' : 'Off'}</span>
          <ChildComponent />
        </div>
      );
    }

    render(
      <UnleashToolbarProvider client={mockClient}>
        <ParentComponent />
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Parent: On')).toBeDefined();
    expect(screen.getByText('Child: On')).toBeDefined();
  });

  it('should share client across multiple hooks', () => {
    function TestComponent() {
      const client1 = useUnleashClient();
      const client2 = useUnleashClient();
      return <div>{client1 === client2 ? 'Same Client' : 'Different Clients'}</div>;
    }

    render(
      <UnleashToolbarProvider client={mockClient}>
        <TestComponent />
      </UnleashToolbarProvider>
    );

    expect(screen.getByText('Same Client')).toBeDefined();
  });
});
