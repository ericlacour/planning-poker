import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Card } from '../api/contract';

/**
 * Valeur affichée d'une carte : seul le front montre `coffee` en ☕ (forcé en texte, sélecteur U+FE0E) et écrit
 * `0.5` « 0,5 » à la française.
 */
export function cardText(card: Card): string {
  switch (card) {
    case 'coffee':
      return '☕︎';
    case '0.5':
      return '0,5';
    default:
      return card;
  }
}

/**
 * Nom accessible d'une carte de la main : « Carte 5 », « Carte 0,5 », « Carte taille M », « Carte je ne sais pas »,
 * « Carte pause café ».
 */
export function cardName(card: Card): string {
  switch (card) {
    case '?':
      return 'Carte je ne sais pas';
    case 'coffee':
      return 'Carte pause café';
    case 'XXS':
    case 'XS':
    case 'S':
    case 'M':
    case 'L':
    case 'XL':
    case 'XXL':
      return `Carte taille ${card}`;
    default:
      return `Carte ${cardText(card)}`;
  }
}

/** Compteur de la barre d'action (story 1.6) : « Aucun votant », « 0 vote sur M », « 1 vote sur M », « N votes sur M ». */
export function voteCounter(progress: { readonly voted: number; readonly expected: number }): string {
  if (progress.expected === 0) return 'Aucun votant';
  return `${progress.voted} ${progress.voted > 1 ? 'votes' : 'vote'} sur ${progress.expected}`;
}

/**
 * Anatomie d'une face de carte (`poker-card`, `seat-card-face`) posée sur l'élément hôte : valeur au centre, index
 * dans le coin supérieur gauche et, retourné, dans le coin inférieur droit. Décoratif : l'hôte porte le nom
 * accessible.
 */
@Component({
  selector: '[appCardFace]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'card-face', '[class.card-face-long]': 'long()' },
  template: `
    <span class="card-index card-index-top" aria-hidden="true">{{ text() }}</span>
    <span class="card-value" aria-hidden="true">{{ text() }}</span>
    <span class="card-index card-index-bottom" aria-hidden="true">{{ text() }}</span>
  `,
})
export class CardFaceComponent {
  readonly appCardFace = input.required<Card>();
  protected readonly text = computed(() => cardText(this.appCardFace()));
  /** Valeur de trois caractères ou plus (« XXL », « 0,5 ») : écrite plus petit pour tenir dans la carte. */
  protected readonly long = computed(() => this.text().length > 2);
}
