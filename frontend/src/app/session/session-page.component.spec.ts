import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { TopBarState } from '../top-bar/top-bar-state';
import { SessionPageComponent, sessionLink } from './session-page.component';

describe('SessionPageComponent', () => {
  function render() {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ sessionId: 'k3Jx9QvT2mLpZ8wR4nYb7A' }) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(SessionPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('builds the link as origin + /s/ + sessionId', () => {
    expect(sessionLink('https://pp.example', 'k3Jx9QvT2mLpZ8wR4nYb7A')).toBe('https://pp.example/s/k3Jx9QvT2mLpZ8wR4nYb7A');
  });

  it('shows the empty session state: invitation, link in clear and « Copier le lien » as primary button', () => {
    const element: HTMLElement = render().nativeElement;
    const link = `${location.origin}/s/k3Jx9QvT2mLpZ8wR4nYb7A`;
    expect(element.querySelector('.invite-text')?.textContent).toBe('Partage le lien pour inviter ton équipe');
    expect(element.querySelector('.invite-url')?.textContent).toBe(link);
    const button = element.querySelector('.invite button');
    expect(button?.textContent?.trim()).toBe('Copier le lien');
    expect(button?.classList).toContain('btn-primary');
  });

  it('puts « Copier le lien » in the top bar while it is displayed', () => {
    const fixture = render();
    const topBar = TestBed.inject(TopBarState);
    expect(topBar.shareUrl()).toBe(`${location.origin}/s/k3Jx9QvT2mLpZ8wR4nYb7A`);
    fixture.destroy();
    expect(topBar.shareUrl()).toBeNull();
  });
});
