export interface BlogPost {
  items: BlogPostData[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BlogPostData {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  coverImage: string;
  content: string;
  authorName: string;
  authorInitials: string;
  authorRole: string;
  readTime: number;
  tags: string[];
  isPublished: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlogPostRequest {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  coverImage: string;
  authorName: string;
  authorInitials: string;
  authorRole: string;
  readTime: number;
  tags: string[];
}

export type UpdateBlogPostRequest = Partial<CreateBlogPostRequest>;

export interface UploadImageResponse {
  url: string;
  publicId: string;
}
