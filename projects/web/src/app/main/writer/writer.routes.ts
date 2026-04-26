import { Routes } from '@angular/router';

export const writerRoutes: Routes = [
  {
    path: 'posts',
    loadComponent: () => import('./posts/posts').then((m) => m.Posts),
    title: 'Posts - MotionHive',
  },
  {
    path: 'posts/new',
    loadComponent: () => import('./posts/post-detail/post-detail').then((m) => m.PostDetail),
    title: 'New Post - MotionHive',
  },
  {
    path: 'posts/:slug',
    loadComponent: () => import('./posts/post-detail/post-detail').then((m) => m.PostDetail),
    title: 'Edit Post - MotionHive',
  },
];
