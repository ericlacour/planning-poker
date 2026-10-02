import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ServerWakeService } from './wake/server-wake.service';
import { WakeScreenComponent } from './wake/wake-screen.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, WakeScreenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="top-bar">
      <div class="brand"><span class="brand-mark card-back" aria-hidden="true"></span>Planning Poker</div>
    </header>
    @switch (wake.state()) {
      @case ('waking') {
        <app-wake-screen />
      }
      @case ('unavailable') {
        <app-wake-screen [unavailable]="true" (retry)="wake.start()" />
      }
      @case ('ready') {
        <router-outlet />
      }
    }
  `,
})
export class App implements OnInit {
  protected readonly wake = inject(ServerWakeService);

  ngOnInit(): void {
    this.wake.start();
  }
}
