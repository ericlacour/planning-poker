import { ChangeDetectionStrategy, Component, DestroyRef, InjectionToken, inject, input, signal } from '@angular/core';

/** Ce que le navigateur offre pour partager un lien, remplaçable dans les tests. */
export interface SharePlatform {
  /** Menu de partage natif, s'il existe. */
  readonly share: ((data: ShareData) => Promise<void>) | null;
  /** Vrai sur un écran tactile (téléphone, tablette). */
  readonly isCoarsePointer: () => boolean;
  readonly writeText: (text: string) => Promise<void>;
}

export const SHARE_PLATFORM = new InjectionToken<SharePlatform>('SHARE_PLATFORM', {
  providedIn: 'root',
  factory: () => ({
    share: typeof navigator.share === 'function' ? (data) => navigator.share(data) : null,
    isCoarsePointer: () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    writeText: (text) => navigator.clipboard.writeText(text),
  }),
});

/** Durée d'affichage de « Lien copié ». */
export const COPIED_FOR_MS = 2_000;

/**
 * Bouton « Copier le lien » (`copy-link-button`) : sur téléphone, menu de partage natif s'il existe ; sinon copie
 * dans le presse-papiers, puis « Lien copié » pendant 2 s. Un partage annulé ne montre rien.
 */
@Component({
  selector: 'app-copy-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="btn copy-link"
      [class.btn-primary]="variant() === 'primary'"
      [class.btn-secondary]="variant() === 'secondary'"
      (click)="share()"
    >
      @if (variant() === 'secondary') {
        <svg class="copy-link-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.8-2.8a3 3 0 0 0-4.2-4.2L10 5.8" />
          <path d="M11.5 8.5a3 3 0 0 0-4.2 0l-2.8 2.8a3 3 0 0 0 4.2 4.2L10 14.2" />
        </svg>
      }
      <span class="copy-link-label" aria-live="polite">{{ copied() ? 'Lien copié' : 'Copier le lien' }}</span>
    </button>
  `,
})
export class CopyLinkComponent {
  readonly url = input.required<string>();
  /** `secondary` dans la barre du haut, `primary` dans la Session vide. */
  readonly variant = input<'primary' | 'secondary'>('secondary');

  protected readonly copied = signal(false);

  private readonly platform = inject(SHARE_PLATFORM);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected async share(): Promise<void> {
    const url = this.url();
    if (this.platform.share && this.platform.isCoarsePointer()) {
      try {
        await this.platform.share({ url });
        return;
      } catch (e) {
        // Partage annulé : rien à montrer. Toute autre erreur : on copie le lien à la place.
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    try {
      await this.platform.writeText(url);
    } catch {
      // Presse-papiers refusé : le lien reste affiché en clair dans la page.
      return;
    }
    this.copied.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.copied.set(false), COPIED_FOR_MS);
  }
}
