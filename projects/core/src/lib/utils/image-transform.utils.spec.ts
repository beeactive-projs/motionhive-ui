import { describe, expect, it } from 'vitest';

import { BLOG_COVER_PRESETS, withImageTransform } from './image-transform.utils';

const R2 = 'https://img.motionhive.fit/motionhive/production/avatars/u1/abc.jpg';
const OLD = 'https://res.cloudinary.com/demo/image/upload/v1/motionhive/production/avatars/u1/abc.jpg';

describe('withImageTransform', () => {
  it('asks Cloudflare for an avatar, width rounded up the ladder', () => {
    expect(
      withImageTransform(R2, { width: 76, height: 76, crop: 'fill', gravity: 'face' }),
    ).toBe(
      'https://img.motionhive.fit/cdn-cgi/image/width=96,height=96,fit=cover,gravity=face,quality=80,format=auto/motionhive/production/avatars/u1/abc.jpg',
    );
  });

  it('turns an aspect ratio into a height', () => {
    const url = withImageTransform(R2, BLOG_COVER_PRESETS.homeCarousel);
    expect(url).toContain('/cdn-cgi/image/width=800,height=450,fit=cover,gravity=auto,');
  });

  it('maps north to top and a named quality to a number', () => {
    const url = withImageTransform(R2, BLOG_COVER_PRESETS.featuredCard);
    expect(url).toContain('width=1200,height=900,fit=cover,gravity=top,quality=85,format=auto/');
  });

  it('works for the dev host too', () => {
    const dev = R2.replace('img.', 'img-dev.');
    expect(withImageTransform(dev, { width: 64 })).toMatch(
      /^https:\/\/img-dev\.motionhive\.fit\/cdn-cgi\/image\/width=64,/,
    );
  });

  it('never transforms an already transformed link twice', () => {
    const once = withImageTransform(R2, { width: 64 });
    expect(withImageTransform(once, { width: 128 })).toBe(once);
  });

  it('caps the width at the largest stored size', () => {
    expect(withImageTransform(R2, { width: 5000 })).toContain('width=2048');
  });

  it('keeps Cloudinary parameters for a link that has not moved yet', () => {
    expect(withImageTransform(OLD, { width: 76, height: 76, gravity: 'face' })).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_fill,g_face,w_76,h_76,q_auto,f_auto/v1/motionhive/production/avatars/u1/abc.jpg',
    );
  });

  it('passes any other URL through and empties an empty one', () => {
    const other = 'https://images.unsplash.com/photo-1?w=800';
    expect(withImageTransform(other, { width: 64 })).toBe(other);
    expect(withImageTransform(null, { width: 64 })).toBe('');
    expect(withImageTransform('', { width: 64 })).toBe('');
  });
});
