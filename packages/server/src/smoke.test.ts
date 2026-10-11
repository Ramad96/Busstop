import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@letter-race/core';

describe('server', () => {
  it('can import core', () => {
    expect(DEFAULT_SETTINGS).toBeDefined();
  });
});
