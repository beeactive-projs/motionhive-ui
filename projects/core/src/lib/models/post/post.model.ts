import { PaginatedResponse } from '../common/pagination.model';
import type { PostApprovalState } from '../group/group.enums';
import type { ProfileWorkout } from '../profile/public-user-profile.model';

/**
 * Post — V1 model: each post belongs to exactly one group. Cross-posting
 * to N groups is a server-side fan-out (POST /posts with multiple
 * groupIds creates N independent posts, each with its own comments,
 * reactions, and image copies).
 */
export interface Post {
  id: string;
  authorId: string;
  groupId: string;
  approvalState: PostApprovalState;
  content: string;
  mediaUrls: string[] | null;
  postedAt: string;
  reactionCount: number;
  commentCount: number;
  /** Caller's own reaction type, e.g. 'LIKE'. Null when the caller hasn't reacted. */
  myReaction: string | null;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    /** How a profile is addressed (`/@<handle>`). Null when unset. */
    handle?: string | null;
  } | null;
  /**
   * Populated by the cross-group feed (`GET /posts/feed`) so the FE can
   * render a "posted in X" badge above the author line. Null on the
   * per-group feed because the group is implicit in the URL.
   */
  group?: { id: string; name: string; logoUrl: string | null } | null;
  /**
   * A finished workout shared into the group, as its safe summary. Null for
   * an ordinary post or once the workout is gone; absent from older APIs.
   */
  workout?: PostWorkout | null;
}

/** A workout card on a post; `onProfile` when its author made it Public. */
export type PostWorkout = ProfileWorkout & { onProfile: boolean };

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    /** How a profile is addressed (`/@<handle>`). Null when unset. */
    handle?: string | null;
  } | null;
  /** Populated for top-level comments only (1-level nesting on the UI). */
  replies?: PostComment[];
}

export interface CreatePostPayload {
  /** May be empty when the post carries a workout: the card says enough. */
  content: string;
  groupIds: string[];
  mediaUrls?: string[];
  /** One of your own finished workouts, shown as a card. */
  workoutLogId?: string;
}

/** POST /posts response — one item per group in `groupIds`. */
export interface CreatePostResult {
  posts: Post[];
}

export interface UpdatePostPayload {
  content?: string;
  mediaUrls?: string[];
}

/** DELETE /posts/:postId response. No body required on the request. */
export interface DeletePostResult {
  deleted: true;
}

export interface CreateCommentPayload {
  content: string;
  parentCommentId?: string;
}

export interface ModeratePostPayload {
  decision: 'APPROVED' | 'REJECTED';
}

export interface ToggleReactionResult {
  reacted: boolean;
  count: number;
}

export interface UploadPostImageResult {
  url: string;
  publicId: string;
}

export type PostListResponse = PaginatedResponse<Post>;
export type PostCommentListResponse = PaginatedResponse<PostComment>;
