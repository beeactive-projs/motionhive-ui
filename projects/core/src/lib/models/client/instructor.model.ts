export interface Instructor {
  name: string;
  email: string;
}

import { PaginatedResponse } from '../common/pagination.model';

export type InstructorListResponse = PaginatedResponse<Instructor>;

export interface InstructorSearchResult {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  avatarId: string | null;
  displayName: string | null;
  bio: string | null;
  specializations: string[] | null;
  yearsOfExperience: number | null;
  isAcceptingClients: boolean;
  city: string | null;
  country: string | null;
  socialLinks: object | null;
}
