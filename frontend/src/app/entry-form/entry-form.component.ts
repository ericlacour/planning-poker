import { ChangeDetectionStrategy, Component, ElementRef, computed, input, linkedSignal, output, signal, viewChildren } from '@angular/core';

import { Role } from '../api/contract';

export interface EntryFormValue {
  readonly pseudo: string;
  readonly role: Role;
}

const ROLES: readonly { readonly value: Role; readonly label: string }[] = [
  { value: 'VOTER', label: 'Je vote' },
  { value: 'OBSERVER', label: "J'observe" },
];

/**
 * Formulaire d'entrée commun à l'Accueil et à Rejoindre (`entry-form`) : « Ton pseudo », « Ton rôle »
 * (« Je vote » par défaut) et un bouton pleine largeur, inactif tant que le pseudo est vide ou blanc.
 */
@Component({
  selector: 'app-entry-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="entry-form" novalidate (submit)="onSubmit($event)">
      <div class="entry-form-mark card-back" aria-hidden="true"></div>
      <h1>Planning Poker</h1>

      <div class="field" [class.field-error]="pseudoError()">
        <label class="field-label" for="entry-pseudo">Ton pseudo</label>
        <input
          id="entry-pseudo"
          class="input"
          type="text"
          name="pseudo"
          maxlength="20"
          autocomplete="nickname"
          spellcheck="false"
          [value]="pseudo()"
          [readOnly]="busy()"
          [attr.aria-invalid]="pseudoError() ? 'true' : null"
          [attr.aria-describedby]="pseudoError() ? 'entry-pseudo-error' : null"
          (input)="onPseudoInput($event)"
        />
        @if (pseudoError(); as error) {
          <p id="entry-pseudo-error" class="error-msg" role="alert">
            <svg class="error-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="10" cy="10" r="8" />
              <path d="M10 5.5v5.5" />
              <circle cx="10" cy="14.2" r=".6" fill="currentColor" />
            </svg>
            {{ error }}
          </p>
        }
      </div>

      <div class="role-group">
        <span class="field-label" id="entry-role-label">Ton rôle</span>
        <div class="roles" role="radiogroup" aria-labelledby="entry-role-label">
          @for (option of roles; track option.value) {
            <button
              #roleButton
              type="button"
              class="role"
              role="radio"
              [attr.aria-checked]="role() === option.value"
              [attr.tabindex]="role() === option.value ? 0 : -1"
              [disabled]="busy()"
              (click)="role.set(option.value)"
              (keydown)="onRoleKeydown($event)"
            >
              {{ option.label }}
            </button>
          }
        </div>
      </div>

      <button type="submit" class="btn btn-primary entry-form-submit" [disabled]="!canSubmit()">
        {{ busy() ? 'Connexion…' : submitLabel() }}
      </button>
      @if (submitError(); as error) {
        <p class="error-msg submit-error" role="alert">
          <svg class="error-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="10" cy="10" r="8" />
            <path d="M10 5.5v5.5" />
            <circle cx="10" cy="14.2" r=".6" fill="currentColor" />
          </svg>
          {{ error }}
        </p>
      }
    </form>
  `,
})
export class EntryFormComponent {
  /** Libellé du bouton : « Créer une session » ou « Rejoindre ». */
  readonly submitLabel = input.required<string>();
  /** Pseudo prérempli (dernier pseudo utilisé). */
  readonly initialPseudo = input('');
  /** Envoi en cours : « Connexion… », bouton inactif, champ lisible. */
  readonly busy = input(false);
  /** Erreur sous le champ (pseudo refusé). */
  readonly pseudoError = input<string | null>(null);
  /** Erreur sous le bouton (serveur injoignable). */
  readonly submitError = input<string | null>(null);

  readonly submitted = output<EntryFormValue>();

  protected readonly roles = ROLES;
  protected readonly pseudo = linkedSignal(() => this.initialPseudo());
  protected readonly role = signal<Role>('VOTER');
  protected readonly canSubmit = computed(() => !this.busy() && this.pseudo().trim().length > 0);

  private readonly roleButtons = viewChildren<ElementRef<HTMLButtonElement>>('roleButton');

  protected onPseudoInput(event: Event): void {
    this.pseudo.set((event.target as HTMLInputElement).value);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.canSubmit()) {
      this.submitted.emit({ pseudo: this.pseudo(), role: this.role() });
    }
  }

  /** Groupe de boutons radio : les flèches passent d'une option à l'autre et la choisissent. */
  protected onRoleKeydown(event: KeyboardEvent): void {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const index = ROLES.findIndex((option) => option.value === this.role());
    const next = (index + step + ROLES.length) % ROLES.length;
    this.role.set(ROLES[next].value);
    this.roleButtons()[next]?.nativeElement.focus();
  }
}
