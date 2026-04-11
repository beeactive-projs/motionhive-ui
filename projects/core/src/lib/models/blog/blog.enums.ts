import { SelectItem } from 'primeng/api';

export const BlogCategories = {
  Guide: 'Guide',
  Nutrition: 'Nutrition',
  Science: 'Science',
  Wellness: 'Wellness',
} as const;

export type BlogCategory = (typeof BlogCategories)[keyof typeof BlogCategories];

export const BLOG_CATEGORY_OPTIONS: SelectItem<BlogCategory>[] = [
  { label: 'Guide', value: BlogCategories.Guide },
  { label: 'Nutrition', value: BlogCategories.Nutrition },
  { label: 'Science', value: BlogCategories.Science },
  { label: 'Wellness', value: BlogCategories.Wellness },
];

export const BlogLanguages = {
  English: 'en',
  Romanian: 'ro',
} as const;

export type BlogLanguage = (typeof BlogLanguages)[keyof typeof BlogLanguages];

export const BLOG_LANGUAGE_OPTIONS: SelectItem<BlogLanguage>[] = [
  { label: 'English', value: BlogLanguages.English },
  { label: 'Romanian', value: BlogLanguages.Romanian },
];
