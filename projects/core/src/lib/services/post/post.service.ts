import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { environment } from '../../../environments/environment';
import {
  CreateCommentPayload,
  CreatePostPayload,
  CreatePostResult,
  DeletePostResult,
  ModeratePostPayload,
  Post,
  PostComment,
  PostCommentListResponse,
  PostListResponse,
  ToggleReactionResult,
  UpdatePostPayload,
  UploadPostImageResult,
} from '../../models/post/post.model';

@Injectable({ providedIn: 'root' })
export class PostService {
  private readonly _http = inject(HttpClient);
  private readonly _api = environment.apiUrl;

  // ─────────────── Image upload ───────────────

  uploadImage(file: File): Observable<UploadPostImageResult> {
    const fd = new FormData();
    fd.append('file', file);
    return this._http.post<UploadPostImageResult>(
      `${this._api}${API_ENDPOINTS.POSTS.UPLOAD_IMAGE}`,
      fd,
    );
  }

  // ─────────────── CRUD ───────────────

  createPost(payload: CreatePostPayload): Observable<CreatePostResult> {
    return this._http.post<CreatePostResult>(
      `${this._api}${API_ENDPOINTS.POSTS.BASE}`,
      payload,
    );
  }

  getGroupFeed(
    groupId: string,
    page = 1,
    limit = 20,
  ): Observable<PostListResponse> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    return this._http.get<PostListResponse>(
      `${this._api}${API_ENDPOINTS.POSTS.GROUP_FEED(groupId)}`,
      { params },
    );
  }

  getPendingForGroup(
    groupId: string,
    page = 1,
    limit = 20,
  ): Observable<PostListResponse> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    return this._http.get<PostListResponse>(
      `${this._api}${API_ENDPOINTS.POSTS.GROUP_PENDING(groupId)}`,
      { params },
    );
  }

  updatePost(postId: string, payload: UpdatePostPayload): Observable<Post> {
    return this._http.patch<Post>(
      `${this._api}${API_ENDPOINTS.POSTS.BY_ID(postId)}`,
      payload,
    );
  }

  deletePost(postId: string): Observable<DeletePostResult> {
    return this._http.delete<DeletePostResult>(
      `${this._api}${API_ENDPOINTS.POSTS.BY_ID(postId)}`,
    );
  }

  moderatePost(
    postId: string,
    payload: ModeratePostPayload,
  ): Observable<{ ok: true }> {
    return this._http.patch<{ ok: true }>(
      `${this._api}${API_ENDPOINTS.POSTS.MODERATE(postId)}`,
      payload,
    );
  }

  // ─────────────── Comments ───────────────

  addComment(
    postId: string,
    payload: CreateCommentPayload,
  ): Observable<PostComment> {
    return this._http.post<PostComment>(
      `${this._api}${API_ENDPOINTS.POSTS.COMMENTS(postId)}`,
      payload,
    );
  }

  getComments(
    postId: string,
    page = 1,
    limit = 20,
  ): Observable<PostCommentListResponse> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    return this._http.get<PostCommentListResponse>(
      `${this._api}${API_ENDPOINTS.POSTS.COMMENTS(postId)}`,
      { params },
    );
  }

  deleteComment(postId: string, commentId: string): Observable<{ ok: true }> {
    return this._http.delete<{ ok: true }>(
      `${this._api}${API_ENDPOINTS.POSTS.COMMENT(postId, commentId)}`,
    );
  }

  // ─────────────── Reactions ───────────────

  toggleReaction(
    postId: string,
    reactionType: string = 'LIKE',
  ): Observable<ToggleReactionResult> {
    return this._http.post<ToggleReactionResult>(
      `${this._api}${API_ENDPOINTS.POSTS.REACTIONS(postId)}`,
      { reactionType },
    );
  }
}
