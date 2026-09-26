import { Routes } from '@angular/router';

/**
 * The Groups area, mounted at `/tabs/groups`.
 *
 * No guard: groups are the one shared surface. A coach owns and moderates
 * them, a trainee joins and posts in them, and both read the same screens —
 * what differs is which controls appear, which `groups.config.ts` answers
 * per group from the viewer's membership role.
 *
 * Every path keeps `groups` as the first segment after `/tabs` so the tab
 * stays lit on pushed screens, same rule as clients and sessions.
 *
 * The composer, the member sheet and the group's own settings are sheets
 * driven from a page rather than routes: each is modal over the screen that
 * opened it and needs that screen's context when it closes.
 */
export const groupsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./groups').then((m) => m.Groups),
    title: 'Groups - MotionHive',
  },
  {
    // One post and its comments. Declared before `:groupId`, or that route
    // swallows the word. Stands on its own without the group screen under
    // it, because this is where a comment notification lands.
    path: 'post/:postId',
    loadComponent: () => import('./post-detail/post-detail').then((m) => m.PostDetail),
    title: 'Post - MotionHive',
  },
  {
    // Creating. Before `:groupId`, or that route swallows the word.
    path: 'create',
    loadComponent: () => import('./group-edit/group-edit').then((m) => m.GroupEdit),
    title: 'New group - MotionHive',
  },
  {
    path: ':groupId/edit',
    loadComponent: () => import('./group-edit/group-edit').then((m) => m.GroupEdit),
    title: 'Edit group - MotionHive',
  },
  {
    path: ':groupId/compose',
    loadComponent: () => import('./post-compose/post-compose').then((m) => m.PostCompose),
    title: 'New post - MotionHive',
  },
  {
    // The owner's two queues: join requests and posts awaiting review. Its
    // own screen rather than a tab, because it is reached from a
    // notification as often as from the group.
    path: ':groupId/manage',
    loadComponent: () => import('./group-manage/group-manage').then((m) => m.GroupManage),
    title: 'Manage group - MotionHive',
  },
  {
    // A post's photos, full screen. Under `post/` so it pushes over the post
    // it came from and the back gesture closes it.
    path: 'post/:postId/photos',
    loadComponent: () => import('./photo-view/photo-view').then((m) => m.PhotoView),
    title: 'Photos - MotionHive',
  },
  {
    // A group seen from outside, with the way in. Its own route because the
    // group's own page is members-only: sending a non-member there is the
    // 403 this screen exists to prevent.
    path: 'preview/:groupId',
    loadComponent: () =>
      import('./group-preview/group-preview').then((m) => m.GroupPreview),
    title: 'Group - MotionHive',
  },
  {
    // One group: posts, members and about. Which controls appear is decided
    // per viewer from the role the server returns on the group.
    path: ':groupId',
    loadComponent: () =>
      import('./group-detail/group-detail').then((m) => m.GroupDetail),
    title: 'Group - MotionHive',
  },
];
