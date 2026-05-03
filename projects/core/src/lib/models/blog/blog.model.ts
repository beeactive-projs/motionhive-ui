import type { BlogCategory, BlogLanguage } from './blog.enums';
import { PaginatedResponse } from '../common/pagination.model';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategory;
  coverImage: string;
  content: string;
  /**
   * Computed by the BE — for registered authors, derived from
   * `firstName + lastName` of the joined user; for guest contributors,
   * mirrors `guestAuthorName`. Always populated.
   */
  authorName: string;
  /**
   * Computed by the BE — first letter of first + last name (or first
   * two letters of the byline for guests). Always populated.
   */
  authorInitials: string;
  /**
   * Cloudinary URL of the registered author's profile picture, or
   * null. Always null for guest-authored posts (no user link). Use
   * with the initials circle as fallback when null.
   */
  authorAvatarUrl: string | null;
  /** FK to user; null for guest-authored posts. */
  authorUserId: string | null;
  /** Byline for guest-authored posts (no MotionHive account). */
  guestAuthorName: string | null;
  readTime: number;
  tags: string[];
  language: BlogLanguage;
  isPublished: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlogPostPayload {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: BlogCategory;
  coverImage: string;
  /**
   * Optional. Set ONLY when publishing under a guest byline (admins
   * only). Leave undefined to attribute the post to the logged-in
   * writer — the BE uses the JWT subject as `authorUserId`.
   */
  guestAuthorName?: string;
  readTime: number;
  tags: string[];
  language: BlogLanguage;
  isPublished?: boolean;
}

export type UpdateBlogPostPayload = Partial<CreateBlogPostPayload>;

export interface BlogQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}

export interface UploadImageResponse {
  url: string;
  publicId: string;
}

export type BlogListResponse = PaginatedResponse<BlogPost>;
