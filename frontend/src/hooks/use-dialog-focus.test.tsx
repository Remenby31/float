import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDialogFocus } from '@/hooks/use-dialog-focus';

function Child({ onClose }: { onClose: () => void }) {
  const ref = useDialogFocus();
  return <section ref={ref} role="dialog" aria-label="Nested"><button onClick={onClose}>Close nested</button><button>Last nested</button></section>;
}

function Parent() {
  const ref = useDialogFocus();
  const [nested, setNested] = useState(false);
  return <><section ref={ref} role="dialog" aria-label="Parent"><button onClick={() => setNested(true)}>Open nested</button><button tabIndex={-1}>Not in tab order</button><button>Last parent</button></section>{nested ? <Child onClose={() => setNested(false)} /> : null}</>;
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width: 44, height: 44 }] as unknown as DOMRectList);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('dialog focus', () => {
  it('only traps focus in the foremost dialog and returns to its trigger', async () => {
    const user = userEvent.setup();
    render(<Parent />);
    await user.click(screen.getByRole('button', { name: 'Open nested' }));
    expect(screen.getByRole('button', { name: 'Close nested' })).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Last nested' })).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(screen.getByRole('button', { name: 'Close nested' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Close nested' }));
    expect(screen.getByRole('button', { name: 'Open nested' })).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Last parent' })).toHaveFocus();
  });

  it('respects explicitly excluded tab stops', async () => {
    const user = userEvent.setup();
    render(<Parent />);
    expect(screen.getByRole('button', { name: 'Open nested' })).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(screen.getByRole('button', { name: 'Last parent' })).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(screen.getByRole('button', { name: 'Open nested' })).toHaveFocus();
  });
});
