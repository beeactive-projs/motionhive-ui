export const BlogCategories = {
  Guide: 'Guide',
  Nutrition: 'Nutrition',
  Science: 'Science',
  Wellness: 'Wellness',
} as const;

export type BlogCategory = (typeof BlogCategories)[keyof typeof BlogCategories];
