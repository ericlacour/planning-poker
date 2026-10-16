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

import { Theme, ThemeService } from '../theme/theme';
import { TopBarState } from './top-bar-state';

const THEMES: readonly { readonly value: Theme; readonly label: string }[] = [
  { value: 'auto', label: 'Automatique' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

/**
 * Menu du participant (`participant-menu`, UX-DR11), dans la barre du haut de l'écran Session : un bouton qui affiche
 * mon pseudo (lu dans l'instantané que l'écran Session confie à {@link TopBarState}) et une flèche, et ouvre sous la
 * barre la liste du thème « Automatique » / « Clair » / « Sombre » (UX-DR2), le thème actuel coché. Le thème,
 * préférence locale, passe par {@link ThemeService} et reste actif hors connexion. Le rôle ne se choisit plus ici : il
 * se choisit à l'entrée, et un observateur redevient votant par « Je veux voter ». Rien n'est affiché avant le premier
 * instantané. Clavier : flèches haut / bas entre les trois choix, Début / Fin au premier et au dernier, Entrée ou
 * Espace pour choisir, Échap ou Tab pour fermer ; à la fermeture par Échap ou par un choix, le focus revient au bouton.
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
        [attr.aria-controls]="open() ? 'participant-menu-list' : null"
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
          <div role="group" aria-label="Thème">
            @for (option of themes; track option.value) {
              <button
                #item
                type="button"
                class="participant-menu-item"
                role="menuitemradio"
                [attr.aria-checked]="theme() === option.value"
                tabindex="-1"
                (click)="chooseTheme(option.value)"
              >
                <span class="participant-menu-check" aria-hidden="true">{{ theme() === option.value ? '✓' : '' }}</span>
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
  private readonly themeService = inject(ThemeService);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly items = viewChildren<ElementRef<HTMLButtonElement>>('item');

  protected readonly themes = THEMES;
  protected readonly theme = this.themeService.theme;
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

  /** Le thème s'applique tout de suite, même hors connexion : rien ne part sur le WebSocket. */
  protected chooseTheme(theme: Theme): void {
    if (theme !== this.theme()) this.themeService.choose(theme);
    this.close();
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const count = this.items().length;
    const index = this.items().findIndex((item) => item.nativeElement === event.target);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusItem((index + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusItem((index - 1 + count) % count);
        break;
      case 'Home':
        event.preventDefault();
        this.focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusItem(count - 1);
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
    return THEMES.findIndex((option) => option.value === this.theme());
  }

  private focusItem(index: number): void {
    this.items()[index]?.nativeElement.focus();
  }
}
