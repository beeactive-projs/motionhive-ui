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
  authorName: string;
  authorInitials: string;
  authorRole: string;
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
  authorName: string;
  authorInitials: string;
  authorRole: string;
  readTime: number;
  tags: string[];
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
