import { Routes } from '@angular/router';

import { HomeComponent } from './home/home.component';
import { SessionEntryComponent } from './session/session-entry.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 's/:sessionId', component: SessionEntryComponent },
  { path: '**', redirectTo: '' },
];
