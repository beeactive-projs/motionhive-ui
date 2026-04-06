import { Pipe, PipeTransform } from '@angular/core';
import { BlogCategories } from 'core';

@Pipe({ name: 'blogCategory' })
export class BlogCategoryPipe implements PipeTransform {
  private readonly _labels: Record<string, string> = {
    All: $localize`:@@blog.category.all:All`,
    [BlogCategories.Guide]: $localize`:@@blog.category.guide:Guide`,
    [BlogCategories.Nutrition]: $localize`:@@blog.category.nutrition:Nutrition`,
    [BlogCategories.Science]: $localize`:@@blog.category.science:Science`,
    [BlogCategories.Wellness]: $localize`:@@blog.category.wellness:Wellness`,
  };

  transform(value: string): string {
    return this._labels[value] ?? value;
  }
}
