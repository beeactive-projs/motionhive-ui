import { Injectable, inject } from '@angular/core';
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
  private readonly _base = `${environment.apiUrl}${API_ENDPOINTS.BLOG.BASE}`;

  getPosts(query: BlogQueryParams = {}): Observable<BlogListResponse> {
    let params = new HttpParams();
    if (query.page) params = params.set('page', query.page);
    if (query.limit) params = params.set('limit', query.limit);
    if (query.category) params = params.set('category', query.category);
    if (query.search) params = params.set('search', query.search);
    return this._http.get<BlogListResponse>(this._base, { params });
  }

  getAllPosts(): Observable<BlogListResponse> {
    return this._http.get<BlogListResponse>(this._base);
  }

  getAllPostData(): Observable<BlogPost[]> {
    return this._http
      .get<BlogListResponse>(this._base)
      .pipe(map((response) => response.items));
  }

  getBySlug(slug: string): Observable<BlogPost> {
    return this._http.get<BlogPost>(`${this._base}/${slug}`);
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
