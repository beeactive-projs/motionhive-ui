import { Post } from 'core';

import { SheetAction } from '../../../../_shared/components/action-sheet/action-sheet.model';

/** The verbs a post's ⋯ can offer. */
export const PostActionIds = {
  Profile: 'profile',
  Edit: 'edit',
  Delete: 'delete',
} as const;

export type PostActionId = (typeof PostActionIds)[keyof typeof PostActionIds];

/** What the reader may do with one post, decided by the screen that holds it. */
export interface PostPermissions {
  /** The author's alone: staff may delete a post, never rewrite it. */
  canEdit: boolean;
  /** The author, or the group's owner and moderators. */
  canDelete: boolean;
}

/**
 * The verbs for one post, in the order the sheet shows them. View profile
 * needs the author's handle, since a profile is addressed by it; a deleted
 * account has none and the row is left out rather than shown dead.
 */
export function postActions(
  post: Pick<Post, 'author'>,
  permissions: PostPermissions,
): SheetAction<PostActionId>[] {
  const actions: SheetAction<PostActionId>[] = [];
  const handle = post.author?.handle;
  if (handle) {
    actions.push({
      id: PostActionIds.Profile,
      label: 'button.viewProfile',
      icon: 'person-outline',
      color: 'violet',
    });
  }
  if (permissions.canEdit) {
    actions.push({
      id: PostActionIds.Edit,
      label: 'groups.post.editTitle',
      icon: 'create-outline',
      color: 'primary',
    });
  }
  if (permissions.canDelete) {
    actions.push({
      id: PostActionIds.Delete,
      label: 'groups.post.deleteVerb',
      icon: 'trash-outline',
      color: 'danger',
      destructive: true,
    });
  }
  return actions;
}
