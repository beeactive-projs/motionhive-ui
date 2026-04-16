import { Injectable, inject, DOCUMENT } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { environment } from '../../../environments/environment';
import {
  BlogPost,
  BlogListResponse,
  BlogQueryParams,
  CreateBlogPostPayload,
  UpdateBlogPostPayload,
  UploadImageResponse,
} from '../../models/blog/blog.model';

@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly _http = inject(HttpClient);
  private readonly _document = inject(DOCUMENT);
  private readonly _base = `${environment.apiUrl}${API_ENDPOINTS.BLOG.BASE}`;

  private get _locale(): string {
    return (this._document.documentElement.lang || 'en').split('-')[0];
  }

  private buildListParams(query: BlogQueryParams, withLocale: boolean): HttpParams {
    let params = new HttpParams();
    if (withLocale) params = params.set('locale', this._locale);
    if (query.page) params = params.set('page', query.page);
    if (query.limit) params = params.set('limit', query.limit);
    if (query.category) params = params.set('category', query.category);
    if (query.search) params = params.set('search', query.search);
    return params;
  }

  // ---------- Public (published only) ----------

  getPosts(query: BlogQueryParams = {}): Observable<BlogListResponse> {
    return this._http.get<BlogListResponse>(this._base, {
      params: this.buildListParams(query, true),
    });
  }

  getAllPosts(): Observable<BlogListResponse> {
    const params = new HttpParams().set('locale', this._locale);
    return this._http.get<BlogListResponse>(this._base, { params });
  }

  getAllPostData(): Observable<BlogPost[]> {
    return this.getAllPosts().pipe(map((response) => response.items));
  }

  getBySlug(slug: string): Observable<BlogPost> {
    const params = new HttpParams().set('locale', this._locale);
    return this._http.get<BlogPost>(`${this._base}/${slug}`, { params });
  }

  getRelatedPosts(currentSlug: string, category: string, limit = 3): Observable<BlogPost[]> {
    return this.getAllPostData().pipe(
      map((posts) => {
        const sameCategory = posts.filter((p) => p.slug !== currentSlug && p.category === category);
        const others = posts.filter((p) => p.slug !== currentSlug && p.category !== category);
        return [...sameCategory, ...others].slice(0, limit);
      }),
    );
  }

  // ---------- Authoring (drafts + published, auth required) ----------

  /**
   * Admin/writer list — includes drafts. WRITER is scoped server-side to
   * their own posts; ADMIN/SUPER_ADMIN see everything.
   */
  getPostsForAdmin(query: BlogQueryParams = {}): Observable<BlogListResponse> {
    return this._http.get<BlogListResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.BLOG.ADMIN_LIST}`,
      { params: this.buildListParams(query, false) },
    );
  }

  /**
   * Load a post for editing by id. Returns drafts; enforces owner-or-admin
   * on the server.
   */
  getForEdit(id: string): Observable<BlogPost> {
    return this._http.get<BlogPost>(
      `${environment.apiUrl}${API_ENDPOINTS.BLOG.ADMIN_BY_ID(id)}`,
    );
  }

  create(payload: CreateBlogPostPayload): Observable<BlogPost> {
    return this._http.post<BlogPost>(this._base, payload);
  }

  update(id: string, payload: UpdateBlogPostPayload): Observable<BlogPost> {
    return this._http.patch<BlogPost>(`${this._base}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this._http.delete<void>(`${this._base}/${id}`);
  }

  uploadImage(file: File): Observable<UploadImageResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this._http.post<UploadImageResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.BLOG.UPLOAD_IMAGE}`,
      formData,
    );
  }
}
