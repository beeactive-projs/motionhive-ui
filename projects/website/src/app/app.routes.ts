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
        title: $localize`MotionHive — Where active communities come together`,
      },
      {
        path: 'about',
        loadComponent: () => import('./about/about.component').then((m) => m.AboutComponent),
        title: $localize`About - MotionHive`,
      },
      {
        path: 'blog',
        loadComponent: () => import('./blog/blog.component').then((m) => m.BlogComponent),
        title: $localize`Blog - MotionHive`,
      },
      {
        path: 'blog/:slug',
        loadComponent: () =>
          import('./blog/blog-article/blog-article.component').then((m) => m.BlogArticleComponent),
        title: $localize`Blog - MotionHive`,
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
