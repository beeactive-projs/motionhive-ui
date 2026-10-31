import { describe, expect, it } from 'vitest';

import { StoryShareErrors, base64Of, storyShareErrorCode } from './story-share.config';

describe('story share helpers', () => {
  it('sends the bytes of a data URL across the bridge, not the prefix', () => {
    expect(base64Of('data:image/png;base64,iVBORw0')).toBe('iVBORw0');
    expect(base64Of('data:image/jpeg;base64,/9j/4AAQ')).toBe('/9j/4AAQ');
    expect(base64Of('iVBORw0')).toBe('iVBORw0');
  });

  it('reads the code the native side rejected with', () => {
    expect(storyShareErrorCode({ code: StoryShareErrors.Unavailable })).toBe('UNAVAILABLE');
    expect(storyShareErrorCode({ code: StoryShareErrors.Denied, message: 'no' })).toBe('DENIED');
    expect(storyShareErrorCode(new Error('plain'))).toBeNull();
    expect(storyShareErrorCode(null)).toBeNull();
    expect(storyShareErrorCode({ code: 42 })).toBeNull();
  });
});
