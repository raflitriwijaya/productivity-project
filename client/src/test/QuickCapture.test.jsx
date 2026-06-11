// Roadmap Wave 2: QuickCapture palette tests.
// The global Cmd/Ctrl+K listener and the 'open-quick-capture' event open the
// modal; it renders nothing while closed. useToast is mocked so the component
// can render without a ToastProvider.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { QuickCapture } from '../components/shared/QuickCapture';

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}));

afterEach(() => cleanup());

describe('QuickCapture', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<QuickCapture />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens on the "open-quick-capture" window event', async () => {
    render(<QuickCapture />);
    await act(async () => {
      window.dispatchEvent(new Event('open-quick-capture'));
    });
    expect(screen.getByRole('dialog', { name: /quick capture/i })).toBeTruthy();
  });

  it('opens on Cmd/Ctrl+K and closes on a second press', async () => {
    render(<QuickCapture />);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    });
    expect(screen.queryByRole('dialog')).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
