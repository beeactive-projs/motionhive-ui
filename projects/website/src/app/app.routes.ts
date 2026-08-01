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
      },
      {
        path: 'about',
        loadComponent: () => import('./about/about.component').then((m) => m.AboutComponent),
      },
      {
        path: 'features',
        loadComponent: () =>
          import('./features/features.component').then((m) => m.FeaturesComponent),
      },
      {
        path: 'features/:slug',
        loadComponent: () =>
          import('./features/feature-detail/feature-detail.component').then(
            (m) => m.FeatureDetailComponent,
          ),
      },
      {
        path: 'pricing',
        loadComponent: () => import('./pricing/pricing.component').then((m) => m.PricingComponent),
      },
      {
        path: 'blog',
        loadComponent: () => import('./blog/blog.component').then((m) => m.BlogComponent),
      },
      {
        path: 'blog/:slug',
        loadComponent: () =>
          import('./blog/blog-article/blog-article.component').then((m) => m.BlogArticleComponent),
      },
      {
        path: 'tools/calorie-calculator',
        loadComponent: () =>
          import('./tools/calorie-calculator/calorie-calculator').then((m) => m.CalorieCalculator),
        title: $localize`Free TDEE & macro calculator - MotionHive`,
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
