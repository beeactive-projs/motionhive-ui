import { Routes } from '@angular/router';

/**
 * One group and what it opens: its posts, photos, composer, settings and
 * queues, and the preview for someone outside it. The Groups tab mounts
 * these at its root (`/tabs/groups/:groupId`); every stack that mounts a
 * profile mounts them under `groups/` too, so a group tapped on a profile
 * opens in that stack and back returns to the profile (`stack-paths.ts`).
 * Each page builds its links with `groupBase` from the stack it is in.
 */
export const groupPageRoutes: Routes = [
  {
    // One post and its comments. Declared before `:groupId`, or that route
    // swallows the word. Stands on its own without the group screen under
    // it, because this is where a comment notification lands.
    path: 'post/:postId',
    loadComponent: () => import('./post-detail/post-detail').then((m) => m.PostDetail),
    title: 'pageTitle.post',
  },
  {
    // Creating. Before `:groupId`, or that route swallows the word.
    path: 'create',
    loadComponent: () => import('./group-edit/group-edit').then((m) => m.GroupEdit),
    title: 'pageTitle.newGroup',
  },
  {
    path: ':groupId/edit',
    loadComponent: () => import('./group-edit/group-edit').then((m) => m.GroupEdit),
    title: 'pageTitle.editGroup',
  },
  {
    path: ':groupId/compose',
    loadComponent: () => import('./post-compose/post-compose').then((m) => m.PostCompose),
    title: 'pageTitle.newPost',
  },
  {
    // The owner's two queues: join requests and posts awaiting review. Its
    // own screen rather than a tab, because it is reached from a
    // notification as often as from the group.
    path: ':groupId/manage',
    loadComponent: () => import('./group-manage/group-manage').then((m) => m.GroupManage),
    title: 'pageTitle.manageGroup',
  },
  {
    // A post's photos, full screen. Under `post/` so it pushes over the post
    // it came from and the back gesture closes it.
    path: 'post/:postId/photos',
    loadComponent: () => import('./photo-view/photo-view').then((m) => m.PhotoView),
    title: 'pageTitle.photos',
  },
  {
    // A group seen from outside, with the way in. Its own route because the
    // group's own page is members-only: sending a non-member there is the
    // 403 this screen exists to prevent.
    path: 'preview/:groupId',
    loadComponent: () => import('./group-preview/group-preview').then((m) => m.GroupPreview),
    title: 'pageTitle.group',
  },
  {
    // One group: posts, members and about. Which controls appear is decided
    // per viewer from the role the server returns on the group.
    path: ':groupId',
    loadComponent: () => import('./group-detail/group-detail').then((m) => m.GroupDetail),
    title: 'pageTitle.group',
  },
];
