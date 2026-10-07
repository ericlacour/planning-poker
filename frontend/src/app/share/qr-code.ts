import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import qrcode from 'qrcode-generator';

let nextId = 0;

/** Marge blanche réglementaire autour du QR code, en modules. */
export const QR_QUIET_ZONE = 4;

/**
 * Modules du QR code de `text` (correction M, version choisie selon la longueur) : `modules[ligne][colonne]` vaut
 * vrai pour un module noir. Le texte est encodé en UTF-8, en mode octet.
 */
export function qrModules(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  // L'encodeur garde l'octet de poids faible de chaque caractère : on lui passe les octets UTF-8 un par un.
  const utf8 = String.fromCharCode(...new TextEncoder().encode(text));
  qr.addData(utf8, 'Byte');
  qr.make();
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => qr.isDark(row, col)));
}

/** Tracé SVG des modules noirs, décalé de la marge : une suite horizontale de modules noirs par sous-tracé. */
export function qrPath(modules: readonly (readonly boolean[])[], margin = QR_QUIET_ZONE): string {
  const parts: string[] = [];
  modules.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      if (!line[col]) continue;
      const start = col;
      while (col + 1 < line.length && line[col + 1]) col++;
      const width = col - start + 1;
      parts.push(`M${start + margin} ${row + margin}h${width}v1h-${width}z`);
    }
  });
  return parts.join('');
}

/**
 * Bouton « QR code », placé juste après « Copier le lien » : déplie sous lui un panneau non modal, sur le modèle du
 * menu du participant, qui montre le QR code du lien de session, calculé dans le navigateur et dessiné en SVG en
 * ligne (CSP AD-11 : ni service tiers, ni image `data:`, ni `style` en ligne), le lien en clair et « Fermer ».
 * Échap, « Fermer » ou un nouveau clic sur le bouton le referment et rendent le focus au bouton ; un clic ailleurs
 * le referme simplement. Noir sur blanc quel que soit le thème (`styles/qr-code.css`).
 */
@Component({
  selector: 'app-qr-code-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'qr-code-host',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape($event)',
  },
  template: `
    <button
      #opener
      type="button"
      class="btn btn-secondary qr-code-button"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? panelId : null"
      (click)="toggle()"
    >
      <svg
        class="qr-code-button-icon"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="5" height="5" rx="1" />
        <rect x="12" y="3" width="5" height="5" rx="1" />
        <rect x="3" y="12" width="5" height="5" rx="1" />
        <path d="M12 12h2v2h-2zM15.5 15.5h1.5v1.5h-1.5zM12 16h1M16 12v1.5" />
      </svg>
      <span class="qr-code-button-label">QR code</span>
    </button>
    @if (open()) {
      <div #panel [id]="panelId" class="qr-panel" role="group" [attr.aria-labelledby]="titleId">
        <p [id]="titleId" class="qr-panel-title">QR code de la session</p>
        <svg
          class="qr-code"
          role="img"
          aria-label="QR code du lien de la session"
          [attr.viewBox]="viewBox()"
          shape-rendering="crispEdges"
        >
          <path [attr.d]="path()" />
        </svg>
        <p class="qr-panel-url">{{ url() }}</p>
        <button type="button" class="btn btn-secondary qr-panel-close" (click)="close()">Fermer</button>
      </div>
    }
  `,
})
export class QrCodeButtonComponent {
  /** Lien de session, le même que celui de « Copier le lien ». */
  readonly url = input.required<string>();

  /** Identifiants uniques : le bouton figure à la fois dans la barre du haut et dans la Session vide. */
  private readonly instance = nextId++;
  protected readonly panelId = `qr-panel-${this.instance}`;
  protected readonly titleId = `qr-panel-title-${this.instance}`;
  protected readonly open = signal(false);
  private readonly modules = computed(() => qrModules(this.url()));
  protected readonly viewBox = computed(() => {
    const side = this.modules().length + 2 * QR_QUIET_ZONE;
    return `0 0 ${side} ${side}`;
  });
  protected readonly path = computed(() => qrPath(this.modules()));

  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly opener = viewChild.required<ElementRef<HTMLButtonElement>>('opener');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected toggle(): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.open.set(true);
    // Session vide : le panneau déplié peut dépasser la zone qui défile ; on l'y fait apparaître en entier.
    afterNextRender(() => this.panel()?.nativeElement.scrollIntoView?.({ block: 'nearest' }), {
      injector: this.injector,
    });
  }

  /** « Fermer » ou Échap : le panneau se replie et le focus revient au bouton. */
  protected close(): void {
    this.open.set(false);
    this.opener().nativeElement.focus();
  }

  /**
   * Échap, d'où que vienne la touche : le panneau se replie ; le focus revient au bouton s'il était dans le
   * composant ou nulle part (`body`, après un clic sur l'image par exemple), sinon il reste où il est.
   */
  protected onEscape(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    const active = document.activeElement;
    const focusBack = !active || active === document.body || this.host.contains(active);
    this.open.set(false);
    if (focusBack) this.opener().nativeElement.focus();
  }

  /** Clic ailleurs : le panneau se replie, le focus reste où l'utilisateur l'a mis. */
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.contains(event.target as Node)) this.open.set(false);
  }
}
