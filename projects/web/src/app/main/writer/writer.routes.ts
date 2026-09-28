import { Routes } from '@angular/router';

export const writerRoutes: Routes = [
  {
    path: 'posts',
    loadComponent: () => import('./posts/posts').then((m) => m.Posts),
    title: 'pageTitle.posts',
  },
  {
    path: 'posts/new',
    loadComponent: () => import('./posts/post-detail/post-detail').then((m) => m.PostDetail),
    title: 'pageTitle.newPost',
  },
  {
    path: 'posts/:slug',
    loadComponent: () => import('./posts/post-detail/post-detail').then((m) => m.PostDetail),
    title: 'pageTitle.editPost',
  },
];
