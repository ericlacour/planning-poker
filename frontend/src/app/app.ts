import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { CopyLinkComponent } from './share/copy-link';
import { TopBarState } from './top-bar/top-bar-state';
import { ServerWakeService } from './wake/server-wake.service';
import { WakeScreenComponent } from './wake/wake-screen.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, WakeScreenComponent, CopyLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="top-bar">
      <div class="brand">
        <span class="brand-mark card-back" aria-hidden="true"></span><span class="brand-name">Planning Poker</span>
      </div>
      @if (topBar.shareUrl(); as url) {
        <div class="top-actions">
          <app-copy-link [url]="url" variant="secondary" />
        </div>
      }
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
  protected readonly topBar = inject(TopBarState);

  ngOnInit(): void {
    this.wake.start();
  }
}
