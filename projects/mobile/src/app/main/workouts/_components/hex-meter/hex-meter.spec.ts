import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { HexMeter, HexMeterPhase, HexMeterPhases } from './hex-meter';

describe('HexMeter', () => {
  function build(phase: HexMeterPhase, left?: number, icon?: string) {
    TestBed.resetTestingModule();
    TestBed.overrideComponent(HexMeter, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(HexMeter);
    fixture.componentRef.setInput('phase', phase);
    if (left !== undefined) fixture.componentRef.setInput('left', left);
    if (icon !== undefined) fixture.componentRef.setInput('icon', icon);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('draws as much honey as there is rest left, out of the path’s 100', () => {
    expect(build(HexMeterPhases.Rest, 0.69).dashArray()).toBe('69.00 100');
    expect(build(HexMeterPhases.Rest, 1.4).dashArray()).toBe('100.00 100');
    expect(build(HexMeterPhases.Rest, -0.2).dashArray()).toBe('0.00 100');
  });

  it('starts the ring at the top point, a little past where the path begins', () => {
    const meter = build(HexMeterPhases.Rest, 0.5);
    expect(meter.dashOffset).toBeLessThan(0);
    expect(meter.dashOffset).toBeGreaterThan(-10);
  });

  it('shows the icon it is given, and always the tick once the rest is over', () => {
    expect(build(HexMeterPhases.Workout, 0, 'barbell-outline').glyph()).toBe('barbell-outline');
    expect(build(HexMeterPhases.Rest, 0.5).glyph()).toBeNull();
    expect(build(HexMeterPhases.Over, 0, 'barbell-outline').glyph()).toBe('checkmark-outline');
  });

  it('draws the classic hexagon standing on a point inside the 100 square', () => {
    const { d } = build(HexMeterPhases.Workout);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    // The top point sits 4 in, leaving the stroke room.
    expect(d).toContain('Q 50.00 4.00');
  });
});
