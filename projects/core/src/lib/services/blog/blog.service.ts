import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { environment } from '../../../environments/environment';
import {
  BlogPost,
  BlogPostData,
  CreateBlogPostRequest,
  UpdateBlogPostRequest,
  UploadImageResponse,
} from '../../models/blog/blog.model';

@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly _http = inject(HttpClient);
  private readonly _base = `${environment.apiUrl}${API_ENDPOINTS.BLOG.BASE}`;

  getAllPost(): Observable<BlogPost> {
    return this._http.get<BlogPost>(this._base);
  }

  getAllPostData(): Observable<BlogPostData[]> {
    return this._http
      .get<BlogPost>(this._base)
      .pipe(map((response) => response.items));
  }

  getBySlug(slug: string): Observable<BlogPostData> {
    return this._http.get<BlogPostData>(`${this._base}/${slug}`);
  }

  getRelatedPosts(currentSlug: string, category: string, limit = 3): Observable<BlogPostData[]> {
    return this.getAllPostData().pipe(
      map((posts) => {
        const sameCategory = posts.filter((p) => p.slug !== currentSlug && p.category === category);
        const others = posts.filter((p) => p.slug !== currentSlug && p.category !== category);
        return [...sameCategory, ...others].slice(0, limit);
      }),
    );
  }

  create(payload: CreateBlogPostRequest): Observable<BlogPostData> {
    return this._http.post<BlogPostData>(this._base, payload);
  }

  update(id: string, payload: UpdateBlogPostRequest): Observable<BlogPostData> {
    return this._http.patch<BlogPostData>(`${this._base}/${id}`, payload);
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
