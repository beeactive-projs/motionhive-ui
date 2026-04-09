import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { UIChart } from 'primeng/chart';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Divider } from 'primeng/divider';
import { Button } from 'primeng/button';

type UnitSystem = 'metric' | 'imperial';
type Gender = 'male' | 'female';
type Goal = 'cut' | 'maintain' | 'bulk';

interface BodyFatCategory {
  label: string;
  color: string;
  range: string;
}

@Component({
  selector: 'mh-calorie-calculator',
  imports: [DecimalPipe, FormsModule, SelectButton, Select, InputNumber, UIChart, Divider, Button],
  templateUrl: './calorie-calculator.html',
  styleUrl: './calorie-calculator.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalorieCalculator {
  private readonly _meta = inject(Meta);
  private readonly _storageKey = 'mh-calorie-calculator';

  constructor() {
    this._meta.updateTag({
      name: 'description',
      content: $localize`:@@calorie.description:Calculate your Total Daily Energy Expenditure (TDEE) and macros for free. Built for group fitness athletes using the Mifflin-St Jeor equation.`,
    });
    this._meta.updateTag({
      name: 'keywords',
      content: $localize`:@@calorie.keywords:TDEE calculator, calorie calculator, macro calculator, body fat calculator, group fitness, weight loss, bulking, Mifflin-St Jeor`,
    });
    this._meta.updateTag({
      property: 'og:title',
      content: $localize`:@@calorie.og.title:Free TDEE & macro calculator - MotionHive`,
    });
    this._meta.updateTag({
      property: 'og:description',
      content: $localize`:@@calorie.og.description:Find your maintenance calories, macro split, and body fat percentage — free, instant, no sign-up required.`,
    });

    try {
      const raw = localStorage.getItem(this._storageKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.unit) this.unit.set(s.unit);
        if (s.gender) this.gender.set(s.gender);
        if (s.age) this.age.set(s.age);
        if (s.activityLevel) this.activityLevel.set(s.activityLevel);
        if (s.goal) this.goal.set(s.goal);
        // linkedSignals reset when unit changes, so set them after unit
        if (s.weight) this.weight.set(s.weight);
        if (s.height) this.height.set(s.height);
        if (s.waist) this.waist.set(s.waist);
        if (s.hips) this.hips.set(s.hips);
        if (s.neck) this.neck.set(s.neck);
      }
    } catch { /* SSR or corrupt storage */ }

    effect(() => {
      try {
        localStorage.setItem(
          this._storageKey,
          JSON.stringify({
            unit: this.unit(),
            gender: this.gender(),
            age: this.age(),
            activityLevel: this.activityLevel(),
            goal: this.goal(),
            weight: this.weight(),
            height: this.height(),
            waist: this.waist(),
            hips: this.hips(),
            neck: this.neck(),
          }),
        );
      } catch { /* SSR or storage quota exceeded */ }
    });
  }

  // ===== Options =====

  readonly unitOptions: { label: string; value: UnitSystem }[] = [
    { label: $localize`:@@calorie.unit.metric:Metric`, value: 'metric' },
    { label: $localize`:@@calorie.unit.imperial:Imperial`, value: 'imperial' },
  ];

  readonly genderOptions: { label: string; value: Gender }[] = [
    { label: $localize`:@@calorie.gender.male:Male`, value: 'male' },
    { label: $localize`:@@calorie.gender.female:Female`, value: 'female' },
  ];

  readonly goalOptions: { label: string; value: Goal }[] = [
    { label: $localize`:@@calorie.goal.cut:Slimming`, value: 'cut' },
    { label: $localize`:@@calorie.goal.maintain:Maintaining`, value: 'maintain' },
    { label: $localize`:@@calorie.goal.bulk:Mass`, value: 'bulk' },
  ];

  readonly activityOptions = [
    {
      label: $localize`:@@calorie.activity.sedentary:Sedentary (little or no exercise)`,
      value: 1.2,
    },
    { label: $localize`:@@calorie.activity.light:Lightly active (1–3 days/week)`, value: 1.375 },
    {
      label: $localize`:@@calorie.activity.moderate:Moderately active (3–5 days/week)`,
      value: 1.55,
    },
    { label: $localize`:@@calorie.activity.very:Very active (6–7 days/week)`, value: 1.725 },
    { label: $localize`:@@calorie.activity.extra:Extra active (very hard exercise)`, value: 1.9 },
  ];

  // ===== Main inputs =====

  readonly unit = signal<UnitSystem>('metric');
  readonly gender = signal<Gender>('male');
  readonly age = signal(30);
  readonly activityLevel = signal(1.55);
  readonly goal = signal<Goal>('maintain');

  readonly weight = linkedSignal<number>(() => (this.unit() === 'metric' ? 70 : 154));
  readonly height = linkedSignal<number>(() => (this.unit() === 'metric' ? 175 : 69));

  readonly weightMin = computed(() => (this.unit() === 'metric' ? 30 : 66));
  readonly weightMax = computed(() => (this.unit() === 'metric' ? 200 : 441));
  readonly heightMin = computed(() => (this.unit() === 'metric' ? 120 : 48));
  readonly heightMax = computed(() => (this.unit() === 'metric' ? 220 : 90));
  readonly weightLabel = computed(() => (this.unit() === 'metric' ? 'kg' : 'lbs'));
  readonly heightLabel = computed(() => (this.unit() === 'metric' ? 'cm' : 'in'));

  private readonly _weightKg = computed(() =>
    this.unit() === 'metric' ? this.weight() : this.weight() * 0.453592,
  );
  private readonly _heightCm = computed(() =>
    this.unit() === 'metric' ? this.height() : this.height() * 2.54,
  );

  // ===== TDEE / Calorie calculations (Mifflin-St Jeor) =====

  readonly bmr = computed(() => {
    const offset = this.gender() === 'male' ? 5 : -161;
    return 10 * this._weightKg() + 6.25 * this._heightCm() - 5 * this.age() + offset;
  });

  readonly tdee = computed(() => Math.round(this.bmr() * this.activityLevel()));
  readonly cuttingCalories = computed(() => Math.max(1200, this.tdee() - 500));
  readonly bulkingCalories = computed(() => this.tdee() + 300);

  readonly displayCalories = computed(() => {
    const g = this.goal();
    if (g === 'cut') return this.cuttingCalories();
    if (g === 'bulk') return this.bulkingCalories();
    return this.tdee();
  });

  readonly goalDescription = computed(() => {
    const g = this.goal();
    if (g === 'cut') return $localize`:@@calorie.goal.desc.cut:500 kcal below maintenance`;
    if (g === 'bulk') return $localize`:@@calorie.goal.desc.bulk:300 kcal above maintenance`;
    return $localize`:@@calorie.goal.desc.maintain:Matches your energy expenditure`;
  });

  // 40 / 30 / 30 macro split
  readonly carbsGrams = computed(() => Math.round((this.displayCalories() * 0.4) / 4));
  readonly proteinGrams = computed(() => Math.round((this.displayCalories() * 0.3) / 4));
  readonly fatGrams = computed(() => Math.round((this.displayCalories() * 0.3) / 9));

  // ===== Additional calculation — body measurements =====

  readonly waist = linkedSignal<number>(() => (this.unit() === 'metric' ? 80 : 31));
  readonly hips = linkedSignal<number>(() => (this.unit() === 'metric' ? 95 : 37));
  readonly neck = linkedSignal<number>(() => (this.unit() === 'metric' ? 38 : 15));

  readonly measMin = computed(() => (this.unit() === 'metric' ? 20 : 8));
  readonly waistMax = computed(() => (this.unit() === 'metric' ? 150 : 59));
  readonly hipsMax = computed(() => (this.unit() === 'metric' ? 160 : 63));
  readonly neckMax = computed(() => (this.unit() === 'metric' ? 65 : 26));
  readonly measLabel = computed(() => (this.unit() === 'metric' ? 'cm' : 'in'));

  private readonly _waistCm = computed(() =>
    this.unit() === 'metric' ? this.waist() : this.waist() * 2.54,
  );
  private readonly _hipsCm = computed(() =>
    this.unit() === 'metric' ? this.hips() : this.hips() * 2.54,
  );
  private readonly _neckCm = computed(() =>
    this.unit() === 'metric' ? this.neck() : this.neck() * 2.54,
  );

  // ===== Body fat (US Navy method) =====

  readonly bodyFatValid = computed(() => {
    const isMale = this.gender() === 'male';
    const diff = isMale
      ? this._waistCm() - this._neckCm()
      : this._waistCm() + this._hipsCm() - this._neckCm();
    return diff > 0 && this._heightCm() > 0;
  });

  readonly bodyFatPct = computed(() => {
    if (!this.bodyFatValid()) return 0;
    const w = this._waistCm();
    const n = this._neckCm();
    const h = this._hipsCm();
    const ht = this._heightCm();
    let pct: number;
    if (this.gender() === 'male') {
      pct = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(ht)) - 450;
    } else {
      pct = 495 / (1.29579 - 0.35004 * Math.log10(w + h - n) + 0.221 * Math.log10(ht)) - 450;
    }
    return Math.max(0, Math.round(pct * 10) / 10);
  });

  readonly bodyFatCategory = computed((): BodyFatCategory => {
    const pct = this.bodyFatPct();
    const isMale = this.gender() === 'male';
    if (!this.bodyFatValid()) {
      return { label: '—', color: 'var(--p-surface-400)', range: '—' };
    }
    if (isMale) {
      if (pct < 6)
        return {
          label: $localize`:@@calorie.bodyfat.cat.essential:Essential`,
          color: 'var(--p-blue-500)',
          range: '2–5%',
        };
      if (pct < 14)
        return {
          label: $localize`:@@calorie.bodyfat.cat.athletic:Athletic`,
          color: 'var(--p-green-500)',
          range: '6–13%',
        };
      if (pct < 18)
        return {
          label: $localize`:@@calorie.bodyfat.cat.fitness:Fitness`,
          color: 'var(--p-green-400)',
          range: '14–17%',
        };
      if (pct < 25)
        return {
          label: $localize`:@@calorie.bodyfat.cat.average:Average`,
          color: 'var(--p-yellow-500)',
          range: '18–24%',
        };
      return {
        label: $localize`:@@calorie.bodyfat.cat.obese:Obese`,
        color: 'var(--p-red-500)',
        range: '25%+',
      };
    } else {
      if (pct < 14)
        return {
          label: $localize`:@@calorie.bodyfat.cat.essential:Essential`,
          color: 'var(--p-blue-500)',
          range: '10–13%',
        };
      if (pct < 21)
        return {
          label: $localize`:@@calorie.bodyfat.cat.athletic:Athletic`,
          color: 'var(--p-green-500)',
          range: '14–20%',
        };
      if (pct < 25)
        return {
          label: $localize`:@@calorie.bodyfat.cat.fitness:Fitness`,
          color: 'var(--p-green-400)',
          range: '21–24%',
        };
      if (pct < 32)
        return {
          label: $localize`:@@calorie.bodyfat.cat.average:Average`,
          color: 'var(--p-yellow-500)',
          range: '25–31%',
        };
      return {
        label: $localize`:@@calorie.bodyfat.cat.obese:Obese`,
        color: 'var(--p-red-500)',
        range: '32%+',
      };
    }
  });

  // SVG gauge: semicircle arc length for r=80 ≈ 251, max range = 50% body fat
  readonly gaugeArcLength = 251;
  readonly gaugeOffset = computed(() => {
    const ratio = Math.min(this.bodyFatPct() / 50, 1);
    return this.gaugeArcLength * (1 - ratio);
  });

  // ===== Water intake =====

  readonly waterIntakeMl = computed(() => Math.round(this._weightKg() * 35));

  // ===== Macro chart =====

  readonly macroChartData = computed(() => {
    const style =
      typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const primary = style?.getPropertyValue('--p-emerald-500').trim() || '#10b981';
    const blue = style?.getPropertyValue('--p-amber-500').trim() || '#3b82f6';
    const orange = style?.getPropertyValue('--p-purple-500').trim() || '#f97316';
    return {
      labels: [
        $localize`:@@calorie.chart.proteins:Proteins`,
        $localize`:@@calorie.chart.carbs:Carbohydrates`,
        $localize`:@@calorie.chart.fats:Fats`,
      ],
      datasets: [
        {
          data: [this.proteinGrams(), this.carbsGrams(), this.fatGrams()],
          backgroundColor: [primary, blue, orange],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    };
  });

  readonly macroChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${ctx.raw} g`,
        },
      },
    },
  };

  // ===== FAQ =====

  readonly faqItems = [
    {
      value: 'faq-1',
      icon: 'pi-calculator',
      question: $localize`:@@calorie.faq.q1:How accurate is this calorie calculator?`,
      answer: $localize`:@@calorie.faq.a1:This calculator uses the Mifflin-St Jeor equation, which is considered the most accurate formula for estimating Basal Metabolic Rate (BMR) for most people. Studies show it has a margin of error of roughly ±10%. For greater precision, consider a DEXA scan or a clinical resting metabolic rate test.`,
    },
    {
      value: 'faq-2',
      icon: 'pi-plus',
      question: $localize`:@@calorie.faq.q2:Should I eat more on HIIT days?`,
      answer: $localize`:@@calorie.faq.a2:Yes — high-intensity interval training significantly elevates calorie expenditure. On hard training days, you may benefit from an extra 200–400 calories. Prioritise complex carbohydrates before your session and protein-rich foods within 30 minutes of finishing to support performance and recovery.`,
    },
    {
      value: 'faq-3',
      icon: 'pi-arrow-down-right',
      question: $localize`:@@calorie.faq.q3:What is a safe calorie deficit for weight loss?`,
      answer: $localize`:@@calorie.faq.a3:A deficit of 300–500 calories per day is generally considered safe and sustainable, leading to roughly 0.3–0.5 kg (0.5–1 lb) of fat loss per week. Deficits exceeding 1,000 calories per day risk muscle loss, nutrient deficiencies, and metabolic adaptation that can stall progress.`,
    },
  ];
}
