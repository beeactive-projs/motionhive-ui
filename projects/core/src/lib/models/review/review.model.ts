export interface ReviewAuthor {
  id: string | null;
  name: string;
  initials: string;
  avatarId: number | null;
  avatarUrl: string | null;
}

export interface Review {
  id: string;
  rating: number;
  body: string;
  monthsIn: number | null;
  createdAt: string;
  author: ReviewAuthor;
}

export interface ReviewBreakdownBucket {
  star: 1 | 2 | 3 | 4 | 5;
  count: number;
  percent: number;
}

export interface ReviewBreakdown {
  average: number;
  total: number;
  distribution: ReviewBreakdownBucket[];
}

export interface PaginatedReviews {
  items: Review[];
  nextCursor: string | null;
  breakdown?: ReviewBreakdown;
}
