import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Accueil provisoire : la story 1.3 le remplace par le formulaire de création de session. */
@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="state-screen">
      <h1>Planning Poker</h1>
    </main>
  `,
})
export class HomeComponent {}
