import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HEALTH_PROBE, ServerWakeService, WAKE_TIMINGS } from './server-wake.service';

describe('ServerWakeService', () => {
  let answers: boolean[];
  let probe: ReturnType<typeof vi.fn>;

  function service(): ServerWakeService {
    TestBed.configureTestingModule({ providers: [{ provide: HEALTH_PROBE, useValue: probe }] });
    return TestBed.inject(ServerWakeService);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    answers = [];
    probe = vi.fn(async () => answers.shift() ?? false);
  });

  afterEach(() => vi.useRealTimers());

  it('goes straight to ready, without the wake screen, when the server answers within 1 s', async () => {
    answers = [true];
    const wake = service();
    wake.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(wake.state()).toBe('ready');
    await vi.advanceTimersByTimeAsync(WAKE_TIMINGS.giveUpAfterMs);
    expect(wake.state()).toBe('ready');
  });

  it('shows the wake screen after 1 s without an answer, then ready on the first 200', async () => {
    const wake = service();
    wake.start();
    await vi.advanceTimersByTimeAsync(999);
    expect(wake.state()).toBe('checking');
    await vi.advanceTimersByTimeAsync(1);
    expect(wake.state()).toBe('waking');

    answers = [false, true];
    await vi.advanceTimersByTimeAsync(WAKE_TIMINGS.pollEveryMs);
    expect(wake.state()).toBe('waking');
    await vi.advanceTimersByTimeAsync(WAKE_TIMINGS.pollEveryMs);
    expect(wake.state()).toBe('ready');
  });

  it('polls every 3 s', async () => {
    const wake = service();
    wake.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(probe).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(WAKE_TIMINGS.pollEveryMs * 3);
    expect(probe).toHaveBeenCalledTimes(4);
  });

  it('gives up after 3 min, and Réessayer starts a new 3 min cycle', async () => {
    const wake = service();
    wake.start();
    await vi.advanceTimersByTimeAsync(WAKE_TIMINGS.giveUpAfterMs - 1);
    expect(wake.state()).toBe('waking');
    await vi.advanceTimersByTimeAsync(1);
    expect(wake.state()).toBe('unavailable');

    const calls = probe.mock.calls.length;
    await vi.advanceTimersByTimeAsync(WAKE_TIMINGS.pollEveryMs * 5);
    expect(probe).toHaveBeenCalledTimes(calls);

    answers = [true];
    wake.start();
    expect(wake.state()).toBe('checking');
    await vi.advanceTimersByTimeAsync(0);
    expect(wake.state()).toBe('ready');
  });

  it('ignores a slow answer that arrives after giving up', async () => {
    let resolveLate!: (healthy: boolean) => void;
    probe.mockImplementation(() => new Promise<boolean>((resolve) => (resolveLate = resolve)));
    const wake = service();
    wake.start();
    await vi.advanceTimersByTimeAsync(WAKE_TIMINGS.giveUpAfterMs);
    expect(wake.state()).toBe('unavailable');
    resolveLate(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(wake.state()).toBe('unavailable');
  });
});
