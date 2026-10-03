import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COPIED_FOR_MS, CopyLinkComponent, SHARE_PLATFORM, SharePlatform } from './copy-link';

const URL = 'https://planning-poker.example/s/k3Jx9QvT2mLpZ8wR4nYb7A';

describe('CopyLinkComponent', () => {
  let platform: { share: ReturnType<typeof vi.fn> | null; isCoarsePointer: () => boolean; writeText: ReturnType<typeof vi.fn> };

  function render(variant: 'primary' | 'secondary' = 'secondary') {
    TestBed.configureTestingModule({
      providers: [{ provide: SHARE_PLATFORM, useValue: platform as unknown as SharePlatform }],
    });
    const fixture = TestBed.createComponent(CopyLinkComponent);
    fixture.componentRef.setInput('url', URL);
    fixture.componentRef.setInput('variant', variant);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    return { fixture, button };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    platform = { share: null, isCoarsePointer: () => false, writeText: vi.fn(async () => undefined) };
  });

  afterEach(() => vi.useRealTimers());

  it('copies the link on a PC and shows « Lien copié » for 2 s', async () => {
    platform.share = vi.fn(async () => undefined);
    const { fixture, button } = render();
    expect(button.textContent?.trim()).toBe('Copier le lien');

    button.click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(platform.writeText).toHaveBeenCalledWith(URL);
    expect(platform.share).not.toHaveBeenCalled();
    expect(button.textContent?.trim()).toBe('Lien copié');

    await vi.advanceTimersByTimeAsync(COPIED_FOR_MS - 1);
    fixture.detectChanges();
    expect(button.textContent?.trim()).toBe('Lien copié');
    await vi.advanceTimersByTimeAsync(1);
    fixture.detectChanges();
    expect(button.textContent?.trim()).toBe('Copier le lien');
  });

  it('opens the native share menu on a touch screen', async () => {
    platform.share = vi.fn(async () => undefined);
    platform.isCoarsePointer = () => true;
    const { fixture, button } = render();
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(platform.share).toHaveBeenCalledWith({ url: URL });
    expect(platform.writeText).not.toHaveBeenCalled();
    expect(button.textContent?.trim()).toBe('Copier le lien');
  });

  it('shows nothing when the share is cancelled', async () => {
    platform.share = vi.fn(async () => Promise.reject(new DOMException('cancel', 'AbortError')));
    platform.isCoarsePointer = () => true;
    const { fixture, button } = render();
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(button.textContent?.trim()).toBe('Copier le lien');
    expect(platform.writeText).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard when the share is refused for another reason', async () => {
    platform.share = vi.fn(async () => Promise.reject(new DOMException('denied', 'NotAllowedError')));
    platform.isCoarsePointer = () => true;
    const { fixture, button } = render();
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(platform.share).toHaveBeenCalledWith({ url: URL });
    expect(platform.writeText).toHaveBeenCalledWith(URL);
    expect(button.textContent?.trim()).toBe('Lien copié');
  });

  it('copies on a touch screen without a share menu', async () => {
    platform.isCoarsePointer = () => true;
    const { button } = render();
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(platform.writeText).toHaveBeenCalledWith(URL);
  });

  it('shows nothing when the clipboard is refused', async () => {
    platform.writeText = vi.fn(async () => Promise.reject(new DOMException('denied', 'NotAllowedError')));
    const { fixture, button } = render();
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(button.textContent?.trim()).toBe('Copier le lien');
  });

  it('is a secondary button with a link icon in the top bar, a primary one otherwise', () => {
    const secondary = render('secondary').button;
    expect(secondary.classList).toContain('btn-secondary');
    expect(secondary.querySelector('svg')).not.toBeNull();
    TestBed.resetTestingModule();
    const primary = render('primary').button;
    expect(primary.classList).toContain('btn-primary');
    expect(primary.querySelector('svg')).toBeNull();
  });
});
