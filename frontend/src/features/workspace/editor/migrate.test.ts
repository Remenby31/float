import { describe, expect, it } from 'vitest';

import { isHtml, migrateToHtml } from '@/features/workspace/editor/migrate';

describe('legacy note migration', () => {
  it('keeps HTML content unchanged', () => {
    expect(isHtml('<p>hello</p>')).toBe(true);
  });

  it('turns legacy task lines into task mention nodes', () => {
    expect(migrateToHtml('@task ship it')).toContain('data-type="taskMention"');
    expect(migrateToHtml('@done shipped')).toContain('data-id="done"');
  });
});
