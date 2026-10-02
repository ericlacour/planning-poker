import { Routes } from '@angular/router';

import { HomeComponent } from './home/home.component';
import { SessionPageComponent } from './session/session-page.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 's/:sessionId', component: SessionPageComponent },
  { path: '**', redirectTo: '' },
];
