import { SessionState } from '../api/contract';

/** Délai minimal entre deux annonces du compteur « N votes sur M » (UX-DR17). */
export const COUNTER_WINDOW_MS = 5_000;

/** Annonce d'une arrivée : « Sofia a rejoint la session ». */
export function arrivalText(pseudo: string): string {
  return `${pseudo} a rejoint la session`;
}

/**
 * Joint des phrases d'annonce : un point sépare une phrase de la suivante, sauf si elle finit déjà par une
 * ponctuation (« Votes révélés. … Consensus ! »).
 */
export function joinSentences(sentences: readonly string[]): string {
  return sentences.reduce((text, sentence) => {
    if (!text) return sentence;
    return /[.!?…]$/.test(text) ? `${text} ${sentence}` : `${text}. ${sentence}`;
  }, '');
}

/**
 * Annonce des arrivées en passant de `previous` à `next` : chaque participant absent de l'instantané précédent,
 * autre que moi, dans l'ordre de la table (« Sofia a rejoint la session. Bob a rejoint la session ») ; `null` s'il
 * n'y en a pas, et toujours pour le premier instantané.
 */
export function arrivalAnnouncement(
  previous: SessionState | null,
  next: SessionState,
): string | null {
  if (!previous) return null;
  const known = new Set(previous.participants.map((p) => p.participantId));
  const arrivals = next.participants
    .filter((p) => !known.has(p.participantId) && p.participantId !== next.selfParticipantId)
    .map((p) => arrivalText(p.pseudo));
  return arrivals.length ? joinSentences(arrivals) : null;
}

/** Horloge et minuteurs du {@link CounterAnnouncer}, injectables pour les tests. */
export interface AnnouncerTimers {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const browserTimers: AnnouncerTimers = {
  // Horloge monotone : un réglage de l'heure système n'étire ni ne raccourcit la fenêtre.
  now: () => performance.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Cadence des annonces du compteur : au plus une toutes les {@link COUNTER_WINDOW_MS}. Hors fenêtre, le nouveau
 * texte est annoncé tout de suite (valeur de retour de {@link update}) ; dans la fenêtre, une seule annonce est
 * différée à la fin de la fenêtre, avec la valeur du moment (`onDeferred`), et rien si cette valeur est celle déjà
 * annoncée. {@link cancel} abandonne l'annonce différée (destruction) ; {@link reset} repart en plus d'une fenêtre
 * vierge (révélation, nouveau tour), pour que le premier compte d'un tour soit annoncé tout de suite.
 */
export class CounterAnnouncer {
  private lastAt: number | null = null;
  private lastText: string | null = null;
  private pending: string | null = null;
  private handle: unknown = null;

  constructor(
    private readonly onDeferred: (text: string) => void,
    private readonly timers: AnnouncerTimers = browserTimers,
  ) {}

  /** Nouveau texte du compteur : le texte à annoncer tout de suite, ou `null` s'il est différé. */
  update(text: string): string | null {
    const now = this.timers.now();
    if (this.lastAt === null || now - this.lastAt >= COUNTER_WINDOW_MS) {
      this.cancel();
      return this.announced(text, now);
    }
    this.pending = text;
    if (this.handle === null) {
      this.handle = this.timers.setTimeout(
        () => this.flush(),
        this.lastAt + COUNTER_WINDOW_MS - now,
      );
    }
    return null;
  }

  /** Abandonne l'annonce différée, s'il y en a une. */
  cancel(): void {
    if (this.handle !== null) this.timers.clearTimeout(this.handle);
    this.handle = null;
    this.pending = null;
  }

  /** Abandonne l'annonce différée et oublie la dernière annonce : le prochain texte est annoncé tout de suite. */
  reset(): void {
    this.cancel();
    this.lastAt = null;
    this.lastText = null;
  }

  private flush(): void {
    const text = this.pending;
    this.handle = null;
    this.pending = null;
    if (text === null || text === this.lastText) return;
    this.onDeferred(this.announced(text, this.timers.now()));
  }

  private announced(text: string, at: number): string {
    this.lastAt = at;
    this.lastText = text;
    return text;
  }
}
