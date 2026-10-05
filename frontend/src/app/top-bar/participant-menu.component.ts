import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';

import { Role } from '../api/contract';
import { TopBarState } from './top-bar-state';

const ROLES: readonly { readonly value: Role; readonly label: string }[] = [
  { value: 'VOTER', label: 'Je vote' },
  { value: 'OBSERVER', label: "J'observe" },
];

/**
 * Menu du participant (`participant-menu`, UX-DR11), dans la barre du haut de l'écran Session : un bouton qui affiche
 * mon pseudo et une flèche, et ouvre sous la barre une liste « Je vote » / « J'observe », mon rôle actuel coché. Il
 * passe par la connexion que l'écran Session confie à {@link TopBarState}.
 * Choisir l'autre rôle envoie `changeRole` (FR5) ; choisir le rôle actuel ne fait que fermer le menu. Rien n'est
 * affiché avant le premier instantané. Clavier : flèches haut / bas entre les choix, Entrée ou Espace pour choisir,
 * Échap ou Tab pour fermer ; à la fermeture par Échap ou par un choix, le focus revient au bouton.
 */
@Component({
  selector: 'app-participant-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'participant-menu',
    '(document:click)': 'onDocumentClick($event)',
  },
  template: `
    @if (me(); as me) {
      <button
        #trigger
        type="button"
        class="btn btn-secondary participant-menu-trigger"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        aria-controls="participant-menu-list"
        [attr.aria-label]="'Menu du participant : ' + me.pseudo"
        (click)="toggle()"
      >
        <span class="participant-menu-pseudo">{{ me.pseudo }}</span>
        <span class="chev" aria-hidden="true"></span>
      </button>
      @if (open()) {
        <div
          id="participant-menu-list"
          class="participant-menu-list"
          role="menu"
          [attr.aria-label]="'Menu du participant : ' + me.pseudo"
          (keydown)="onMenuKeydown($event)"
        >
          <div role="group" aria-label="Ton rôle">
            @for (option of roles; track option.value) {
              <button
                #item
                type="button"
                class="participant-menu-item"
                role="menuitemradio"
                [attr.aria-checked]="me.role === option.value"
                tabindex="-1"
                (click)="choose(option.value)"
              >
                <span class="participant-menu-check" aria-hidden="true">{{ me.role === option.value ? '✓' : '' }}</span>
                {{ option.label }}
              </button>
            }
          </div>
        </div>
      }
    }
  `,
})
export class ParticipantMenuComponent {
  private readonly topBar = inject(TopBarState);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly items = viewChildren<ElementRef<HTMLButtonElement>>('item');

  protected readonly roles = ROLES;
  protected readonly open = signal(false);
  protected readonly me = computed(() => {
    const state = this.topBar.session()?.state();
    return state?.participants.find((p) => p.participantId === state.selfParticipantId) ?? null;
  });

  protected toggle(): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.open.set(true);
    // Le focus va au choix coché, une fois la liste rendue.
    afterNextRender(() => this.focusItem(Math.max(this.checkedIndex(), 0)), { injector: this.injector });
  }

  protected choose(role: Role): void {
    if (role !== this.me()?.role) this.topBar.session()?.changeRole(role);
    this.close();
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const index = this.items().findIndex((item) => item.nativeElement === event.target);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusItem((index + 1) % ROLES.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusItem((index - 1 + ROLES.length) % ROLES.length);
        break;
      case 'Home':
        event.preventDefault();
        this.focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusItem(ROLES.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'Tab':
        this.open.set(false);
        break;
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.contains(event.target as Node)) this.open.set(false);
  }

  private close(): void {
    this.open.set(false);
    this.trigger()?.nativeElement.focus();
  }

  private checkedIndex(): number {
    return ROLES.findIndex((option) => option.value === this.me()?.role);
  }

  private focusItem(index: number): void {
    this.items()[index]?.nativeElement.focus();
  }
}
