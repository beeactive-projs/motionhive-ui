export interface InstructorGroupSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  joinPolicy: string;
  tags: string[] | null;
  city: string | null;
  country: string | null;
  memberCount: number;
  createdAt: string;
}
