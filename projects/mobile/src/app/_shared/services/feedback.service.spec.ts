import { TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular/standalone';
import { describe, expect, it, vi } from 'vitest';

import { ErrorDialogService } from 'core';

import { FeedbackService } from './feedback.service';

/** A toast whose closing the test decides, with the role it closes with. */
function setup() {
  let close: (role: string | undefined) => void = () => undefined;
  const closed = new Promise<{ role?: string }>((resolve) => {
    close = (role) => resolve({ role });
  });
  const toast = {
    present: vi.fn(() => Promise.resolve()),
    onDidDismiss: vi.fn(() => closed),
    dismiss: vi.fn(() => {
      close(undefined);
      return Promise.resolve(true);
    }),
  };
  const create = vi.fn(() => Promise.resolve(toast));
  TestBed.configureTestingModule({
    providers: [
      FeedbackService,
      { provide: ToastController, useValue: { create } },
      { provide: ErrorDialogService, useValue: { error: () => null, close: vi.fn() } },
    ],
  });
  return { service: TestBed.inject(FeedbackService), toast, create, close: (role?: string) => close(role) };
}

describe('FeedbackService.undoable', () => {
  it('offers one Undo button on a neutral toast, up long enough to reach it', async () => {
    const { service, create, toast } = setup();
    await service.undoable('Tuesday is now a rest day', 'Undo');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Tuesday is now a rest day',
        color: 'medium',
        duration: 5000,
        buttons: [{ text: 'Undo', role: 'undo' }],
      }),
    );
    expect(toast.present).toHaveBeenCalled();
  });

  it('says it was undone when Undo closed it', async () => {
    const { service, close } = setup();
    const handle = await service.undoable('Cleared', 'Undo');
    close('undo');
    await expect(handle.undone).resolves.toBe(true);
  });

  it('says it was not undone when it ran out', async () => {
    const { service, close } = setup();
    const handle = await service.undoable('Cleared', 'Undo');
    close('timeout');
    await expect(handle.undone).resolves.toBe(false);
  });

  it('can be closed by the page, which counts as not undone', async () => {
    const { service, toast } = setup();
    const handle = await service.undoable('Cleared', 'Undo');
    await handle.dismiss();
    expect(toast.dismiss).toHaveBeenCalled();
    await expect(handle.undone).resolves.toBe(false);
  });
});
