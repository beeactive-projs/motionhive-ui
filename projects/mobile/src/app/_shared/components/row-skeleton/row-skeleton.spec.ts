import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { RowSkeleton } from './row-skeleton';

// The template blanked (Ionic does not render in jsdom), once per test.
beforeEach(() => {
  TestBed.overrideComponent(RowSkeleton, { set: { template: '', imports: [] } });
});

function skeleton(compact?: boolean) {
  const fixture = TestBed.createComponent(RowSkeleton);
  if (compact !== undefined) fixture.componentRef.setInput('compact', compact);
  fixture.detectChanges();
  return { instance: fixture.componentInstance, host: fixture.nativeElement as HTMLElement };
}

describe('RowSkeleton', () => {
  it("stands in for a person or conversation row: the lg avatar's block", () => {
    const { instance, host } = skeleton();
    expect(instance.blockSize()).toBe('3.25rem');
    expect(host.classList.contains('mh-compact-row')).toBe(false);
  });

  // The exercise library's rows are compact, so its skeleton must be too,
  // or the list shifts when the rows land.
  it("stands in for a compact row: the md tile's block and the compact skin", () => {
    const { instance, host } = skeleton(true);
    expect(instance.blockSize()).toBe('2.5rem');
    expect(host.classList.contains('mh-compact-row')).toBe(true);
  });
});
