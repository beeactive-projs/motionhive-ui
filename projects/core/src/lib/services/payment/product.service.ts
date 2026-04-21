import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import {
  CreateProductPayload,
  Product,
  ProductListParams,
  ProductListResponse,
  UpdateProductPayload,
} from '../../models/payment/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly _http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.PRODUCTS}`;

  list(params: ProductListParams = {}): Observable<ProductListResponse> {
    let httpParams = new HttpParams();
    if (params.type) httpParams = httpParams.set('type', params.type);
    if (params.isActive != null) httpParams = httpParams.set('isActive', String(params.isActive));
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return this._http.get<ProductListResponse>(this.baseUrl, { params: httpParams });
  }

  get(id: string): Observable<Product> {
    return this._http.get<Product>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.PRODUCT_BY_ID(id)}`,
    );
  }

  create(payload: CreateProductPayload): Observable<Product> {
    return this._http.post<Product>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateProductPayload): Observable<Product> {
    return this._http.patch<Product>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.PRODUCT_BY_ID(id)}`,
      payload,
    );
  }

  deactivate(id: string): Observable<Product> {
    return this._http.delete<Product>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.PRODUCT_BY_ID(id)}`,
    );
  }

  /**
   * Public — no auth. Lists products the instructor has opted to show
   * on their public profile (showOnProfile=true, isActive=true).
   */
  listPublicForInstructor(instructorId: string): Observable<Product[]> {
    return this._http.get<Product[]>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.PUBLIC_INSTRUCTOR_PRODUCTS(instructorId)}`,
    );
  }
}
