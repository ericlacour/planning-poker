import { TestBed } from '@angular/core/testing';
import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';

import { QR_QUIET_ZONE, QrCodeButtonComponent, qrModules, qrPath } from './qr-code';

const URL = 'https://planning-poker.example/s/k3Jx9QvT2mLpZ8wR4nYb7A';

/** Motif de repérage 7 × 7 attendu dont le coin haut gauche est (`top`, `left`). */
function finderAt(modules: boolean[][], top: number, left: number): boolean {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const ring = r === 0 || r === 6 || c === 0 || c === 6;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      if (modules[top + r][left + c] !== (ring || core)) return false;
    }
  }
  return true;
}

describe('qrModules', () => {
  it('builds a square matrix of a valid QR version with its three finder patterns', () => {
    const modules = qrModules(URL);
    const size = modules.length;
    // Version v : 17 + 4v modules de côté. 57 octets en correction M : version 4 (33 modules).
    expect((size - 17) % 4).toBe(0);
    expect(size).toBe(33);
    expect(modules.every((row) => row.length === size)).toBe(true);
    expect(finderAt(modules, 0, 0)).toBe(true);
    expect(finderAt(modules, 0, size - 7)).toBe(true);
    expect(finderAt(modules, size - 7, 0)).toBe(true);
    // Séparateurs clairs autour des motifs, et module sombre fixe (4v + 9, 8).
    expect(modules[7].slice(0, 8).some(Boolean)).toBe(false);
    expect(modules[size - 8][8]).toBe(true);
    // Lignes de synchronisation : alternance sombre / clair entre les motifs.
    for (let i = 8; i < size - 8; i++) {
      expect(modules[6][i]).toBe(i % 2 === 0);
      expect(modules[i][6]).toBe(i % 2 === 0);
    }
  });

  it('grows with the text and is deterministic', () => {
    expect(qrModules(URL)).toEqual(qrModules(URL));
    expect(qrModules(`${URL}/${'x'.repeat(100)}`).length).toBeGreaterThan(qrModules(URL).length);
    expect(qrModules('https://é.example').length).toBe(25);
  });
});

/** Rend `modules` en image RGBA, marge blanche comprise, `scale` pixels par module. */
function rasterize(modules: boolean[][], scale = 4): { data: Uint8ClampedArray; side: number } {
  const side = (modules.length + 2 * QR_QUIET_ZONE) * scale;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  modules.forEach((line, row) =>
    line.forEach((dark, col) => {
      if (!dark) return;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const i = (((row + QR_QUIET_ZONE) * scale + y) * side + (col + QR_QUIET_ZONE) * scale + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }),
  );
  return { data, side };
}

describe('qrModules decoded', () => {
  for (const text of [URL, 'http://127.0.0.1:4300/s/k3Jx9QvT2mLpZ8wR4nYb7A', 'https://é.example/s/ü-🃏']) {
    it(`gives back exactly ${text}`, () => {
      const { data, side } = rasterize(qrModules(text));
      const result = jsQR(data, side, side);
      expect(result).not.toBeNull();
      expect(new TextDecoder().decode(new Uint8Array(result!.binaryData))).toBe(text);
    });
  }
});

describe('qrPath', () => {
  it('draws each run of dark modules once, shifted by the quiet zone', () => {
    expect(qrPath([[true, true, false, true]], 4)).toBe('M4 4h2v1h-2zM7 4h1v1h-1z');
    expect(qrPath([[false], [true]], 0)).toBe('M0 1h1v1h-1z');
    expect(qrPath([[false, false]])).toBe('');
  });
});

describe('QrCodeButtonComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(QrCodeButtonComponent);
    fixture.componentRef.setInput('url', URL);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector('button.qr-code-button') as HTMLButtonElement;
    const panel = () => element.querySelector('.qr-panel') as HTMLElement | null;
    const openPanel = () => {
      button.click();
      fixture.detectChanges();
      return panel()!;
    };
    return { fixture, element, button, panel, openPanel };
  }

  it('is a secondary button labelled « QR code », with an icon', () => {
    const { button } = render();
    expect(button.textContent?.trim()).toBe('QR code');
    expect(button.classList).toContain('btn-secondary');
    expect(button.classList).not.toContain('btn-primary');
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('unfolds a non-modal panel: title, the QR code as an image, the link in clear and « Fermer »', () => {
    const { element, button, panel, openPanel } = render();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.hasAttribute('aria-controls')).toBe(false);
    expect(panel()).toBeNull();

    const opened = openPanel();
    expect(element.querySelector('dialog')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe(opened.id);
    const title = opened.querySelector('.qr-panel-title')!;
    expect(opened.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();
    expect(title.textContent).toBe('QR code de la session');
    expect(opened.getAttribute('aria-labelledby')).toBe(title.id);

    const svg = opened.querySelector('svg.qr-code')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('QR code du lien de la session');
    expect(svg.getAttribute('shape-rendering')).toBe('crispEdges');
    const modules = qrModules(URL);
    const side = modules.length + 2 * QR_QUIET_ZONE;
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${side} ${side}`);
    expect(svg.querySelectorAll('path')).toHaveLength(1);
    expect(svg.querySelector('path')!.getAttribute('d')).toBe(qrPath(modules));
    expect(svg.hasAttribute('style')).toBe(false);

    expect(opened.querySelector('.qr-panel-url')?.textContent).toBe(URL);
    expect(opened.querySelector('button')?.textContent?.trim()).toBe('Fermer');
  });

  it('closes with « Fermer » and gives the focus back to the button', () => {
    const { fixture, button, panel, openPanel } = render();
    (openPanel().querySelector('.qr-panel-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('closes with Escape from inside the panel and gives the focus back to the button', () => {
    const { fixture, button, panel, openPanel } = render();
    const close = openPanel().querySelector('.qr-panel-close') as HTMLButtonElement;
    close.focus();
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('closes with Escape pressed while the focus is on body, and gives the focus back to the button', () => {
    const { fixture, button, panel, openPanel } = render();
    openPanel();
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('closes with Escape pressed elsewhere on the page, leaving the focus there', () => {
    const { fixture, panel, openPanel } = render();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    try {
      openPanel();
      outside.focus();
      outside.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(outside);
    } finally {
      outside.remove();
    }
  });

  it('ignores Escape while closed', () => {
    const { fixture, button, panel } = render();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).not.toBe(button);
  });

  it('closes on a new click on the button', () => {
    const { fixture, button, panel, openPanel } = render();
    openPanel();
    button.click();
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('closes on a click elsewhere, not on a click inside the panel, without moving the focus', () => {
    const { fixture, panel, openPanel } = render();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    try {
      (openPanel().querySelector('.qr-panel-url') as HTMLElement).click();
      fixture.detectChanges();
      expect(panel()).not.toBeNull();
      outside.focus();
      outside.click();
      fixture.detectChanges();
      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(outside);
    } finally {
      outside.remove();
    }
  });

  it('gives each instance its own ids', () => {
    const first = render().openPanel();
    const second = render().openPanel();
    expect(first.id).not.toBe(second.id);
    expect(first.getAttribute('aria-labelledby')).not.toBe(second.getAttribute('aria-labelledby'));
  });
});
