import { PaginatedResponse } from '../common/pagination.model';
import type { PostAudienceApprovalState } from '../group/group.enums';

/**
 * Post — author-owned. Audiences live in PostAudience rows; in V1 only
 * GROUP audiences exist, but the shape is forward-compatible for
 * V2 (FOLLOWERS) and V3 (PUBLIC).
 */
export interface Post {
  id: string;
  authorId: string;
  content: string;
  mediaUrls: string[] | null;
  reactionCount: number;
  commentCount: number;
  /** Caller's own reaction type, e.g. 'LIKE'. Null when the caller hasn't reacted. */
  myReaction: string | null;
  createdAt: string;
  updatedAt: string;
  audiences?: PostAudience[];
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  } | null;
}

export interface PostAudience {
  id: string;
  postId: string;
  audienceType: 'GROUP'; // V2/V3 will widen
  audienceId: string | null;
  approvalState: PostAudienceApprovalState;
  postedAt: string;
}

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
  } | null;
  /** Populated for top-level comments only (1-level nesting on the UI). */
  replies?: PostComment[];
}

export interface CreatePostPayload {
  content: string;
  groupIds: string[];
  mediaUrls?: string[];
}

export interface UpdatePostPayload {
  content?: string;
  mediaUrls?: string[];
}

export interface DeletePostPayload {
  /** Omit to delete the post from all audiences. */
  groupIds?: string[];
}

export interface DeletePostResult {
  post: 'kept' | 'deleted';
  audiencesRemoved: number;
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
