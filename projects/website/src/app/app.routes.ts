import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layouts/public-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
        title: 'BeeActive — Where active communities come together',
      },
      {
        path: 'about',
        loadComponent: () => import('./about/about.component').then((m) => m.AboutComponent),
        title: 'About - BeeActive',
      },
      {
        path: 'blog',
        loadComponent: () => import('./blog/blog.component').then((m) => m.BlogComponent),
        title: 'Blog - BeeActive',
      },
      {
        path: 'blog/:slug',
        loadComponent: () =>
          import('./blog/blog-article/blog-article.component').then((m) => m.BlogArticleComponent),
        title: 'BeeActive Blog',
      },
      {
        path: 'legal',
        loadChildren: () => import('./legal/legal.routes').then((m) => m.legalRoutes),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
