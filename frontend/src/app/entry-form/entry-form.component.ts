import { ChangeDetectionStrategy, Component, ElementRef, computed, input, linkedSignal, output, signal, viewChildren } from '@angular/core';

import { Card, DECK_FAMILIES, Deck, DeckType, MIN_DECK_CARDS, Role } from '../api/contract';
import { cardName, cardText } from '../session/cards';

export interface EntryFormValue {
  readonly pseudo: string;
  readonly role: Role;
  /** Le jeu choisi ; présent seulement quand le formulaire propose de le choisir (création d'une session). */
  readonly deck?: Deck;
}

const ROLES: readonly { readonly value: Role; readonly label: string }[] = [
  { value: 'VOTER', label: 'Je vote' },
  { value: 'OBSERVER', label: "J'observe" },
];

const DECK_TYPES: readonly { readonly value: DeckType; readonly label: string }[] = [
  { value: 'FIBONACCI', label: 'Fibonacci' },
  { value: 'TSHIRT', label: 'Tailles de tee-shirt' },
];

/**
 * Formulaire d'entrée commun à l'Accueil et à Rejoindre (`entry-form`) : « Ton pseudo », « Ton rôle »
 * (« Je vote » par défaut) et un bouton pleine largeur, inactif tant que le pseudo est vide ou blanc. À la création
 * d'une session (`withDeck`), « Cartes de la session » propose la suite de Fibonacci ou les tailles de tee-shirt,
 * toutes les cartes retenues au départ : on en retire à volonté, mais il en reste au moins deux. Ce choix est
 * définitif pour la session.
 */
@Component({
  selector: 'app-entry-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="entry-form" novalidate (submit)="onSubmit($event)">
      <div class="entry-form-mark card-back" aria-hidden="true"></div>
      <h1>Planning Poker</h1>

      @if (notice(); as message) {
        <p class="entry-notice" role="status">{{ message }}</p>
      }

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

      @if (withDeck()) {
        <div class="deck-group">
          <span class="field-label" id="entry-deck-label">Cartes de la session</span>
          <div class="roles" role="radiogroup" aria-labelledby="entry-deck-label">
            @for (option of deckTypes; track option.value) {
              <button
                #deckButton
                type="button"
                class="role"
                role="radio"
                [attr.aria-checked]="deckType() === option.value"
                [attr.tabindex]="deckType() === option.value ? 0 : -1"
                [disabled]="busy()"
                (click)="chooseDeckType(option.value)"
                (keydown)="onDeckKeydown($event)"
              >
                {{ option.label }}
              </button>
            }
          </div>
          <div class="deck-cards" role="group" aria-label="Cartes retenues">
            @for (card of familyCards(); track card) {
              <button
                type="button"
                class="deck-chip"
                [attr.aria-pressed]="isKept(card)"
                [attr.aria-label]="name(card)"
                [disabled]="busy()"
                (click)="toggle(card)"
              >
                {{ text(card) }}
              </button>
            }
          </div>
          <p class="deck-hint" [class.deck-hint-error]="!deckValid()" [attr.role]="deckValid() ? null : 'alert'">
            @if (deckValid()) {
              Retire les cartes dont tu n'as pas besoin. Ce choix est définitif pour la session.
            } @else {
              Garde au moins {{ minCards }} cartes.
            }
          </p>
        </div>
      }

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
  /** Information neutre au-dessus du champ (place reprise depuis un autre appareil). */
  readonly notice = input<string | null>(null);
  /** Erreur sous le champ (pseudo refusé). */
  readonly pseudoError = input<string | null>(null);
  /** Erreur sous le bouton (serveur injoignable). */
  readonly submitError = input<string | null>(null);

  /** Propose le choix des cartes de la session (création seulement : le jeu est figé ensuite). */
  readonly withDeck = input(false);

  readonly submitted = output<EntryFormValue>();

  protected readonly roles = ROLES;
  protected readonly pseudo = linkedSignal(() => this.initialPseudo());
  protected readonly role = signal<Role>('VOTER');
  protected readonly deckTypes = DECK_TYPES;
  protected readonly minCards = MIN_DECK_CARDS;
  protected readonly name = cardName;
  protected readonly text = cardText;
  protected readonly deckType = signal<DeckType>('FIBONACCI');
  /** Cartes retirées du jeu, par famille : changer de famille ne perd pas le choix fait dans l'autre. */
  private readonly dropped = signal<Readonly<Record<DeckType, readonly Card[]>>>({ FIBONACCI: [], TSHIRT: [] });
  protected readonly familyCards = computed(() => DECK_FAMILIES[this.deckType()]);
  /** Les cartes retenues, dans l'ordre de la famille. */
  private readonly keptCards = computed(() => {
    const dropped = this.dropped()[this.deckType()];
    return this.familyCards().filter((card) => !dropped.includes(card));
  });
  protected readonly deckValid = computed(() => !this.withDeck() || this.keptCards().length >= MIN_DECK_CARDS);
  protected readonly canSubmit = computed(
    () => !this.busy() && this.pseudo().trim().length > 0 && this.deckValid(),
  );

  private readonly roleButtons = viewChildren<ElementRef<HTMLButtonElement>>('roleButton');
  private readonly deckButtons = viewChildren<ElementRef<HTMLButtonElement>>('deckButton');

  protected isKept(card: Card): boolean {
    return !this.dropped()[this.deckType()].includes(card);
  }

  protected toggle(card: Card): void {
    const type = this.deckType();
    const dropped = this.dropped()[type];
    this.dropped.update((all) => ({
      ...all,
      [type]: dropped.includes(card) ? dropped.filter((c) => c !== card) : [...dropped, card],
    }));
  }

  protected chooseDeckType(type: DeckType): void {
    this.deckType.set(type);
  }

  protected onPseudoInput(event: Event): void {
    this.pseudo.set((event.target as HTMLInputElement).value);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.canSubmit()) {
      this.submitted.emit({
        pseudo: this.pseudo(),
        role: this.role(),
        ...(this.withDeck() ? { deck: { type: this.deckType(), cards: this.keptCards() } } : {}),
      });
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

  /** Même navigation que le rôle : les flèches passent d'une famille à l'autre et la choisissent. */
  protected onDeckKeydown(event: KeyboardEvent): void {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const index = DECK_TYPES.findIndex((option) => option.value === this.deckType());
    const next = (index + step + DECK_TYPES.length) % DECK_TYPES.length;
    this.deckType.set(DECK_TYPES[next].value);
    this.deckButtons()[next]?.nativeElement.focus();
  }
}
