import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Écrans d'état du réveil (UX-DR13) : « Réveil du serveur… » puis, au-delà de 3 min, « Le serveur ne répond pas. ». */
@Component({
  selector: 'app-wake-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (unavailable()) {
      <main class="state-screen" role="alert">
        <svg class="state-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="10" cy="10" r="8" />
          <path d="M10 5.5v5.5" />
          <circle cx="10" cy="14.2" r=".6" fill="currentColor" />
        </svg>
        <h1 class="state-error">Le serveur ne répond pas.</h1>
        <button type="button" class="btn btn-primary" (click)="retry.emit()">Réessayer</button>
      </main>
    } @else {
      <main class="state-screen" role="status">
        <div class="deck" aria-hidden="true">
          <span class="card-back"></span><span class="card-back"></span><span class="card-back"></span>
        </div>
        <h1>Réveil du serveur…</h1>
        <p class="lead">Ça peut prendre jusqu'à 2 minutes.</p>
      </main>
    }
  `,
})
export class WakeScreenComponent {
  readonly unavailable = input(false);
  readonly retry = output<void>();
}
