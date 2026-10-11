import { describe, expect, it } from 'vitest';
import { CORE_VERSION } from '@letter-race/core';

describe('server', () => {
  it('can import core', () => {
    expect(CORE_VERSION).toBeTypeOf('string');
  });
});
