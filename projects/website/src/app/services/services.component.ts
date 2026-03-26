import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'bee-services',
  imports: [RouterLink, ButtonModule],
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesComponent {
  readonly services = [
    {
      icon: 'pi-user',
      title: 'Personal Training',
      description:
        'One-on-one sessions with certified trainers crafted entirely around your specific goals, fitness level, and schedule.',
      features: ['Custom workout plans', 'Progress tracking', 'Nutritional guidance', 'Weekly check-ins'],
    },
    {
      icon: 'pi-users',
      title: 'Group Classes',
      description:
        'Join energetic group sessions and train alongside people who share your goals — motivation included at no extra charge.',
      features: ['Multiple class formats', 'Live and on-demand', 'Community support', 'Flexible scheduling'],
    },
    {
      icon: 'pi-mobile',
      title: 'Online Coaching',
      description:
        'World-class coaching delivered wherever you are, through video consultations and a fully digital training platform.',
      features: ['Video consultations', 'Custom meal plans', 'Form check videos', '24/7 messaging support'],
    },
    {
      icon: 'pi-chart-line',
      title: 'Performance Analytics',
      description:
        'Advanced tracking and detailed analytics to monitor every aspect of your training and unlock actionable insights.',
      features: ['Detailed metrics dashboard', 'Progress visualisation', 'Goal tracking', 'Performance reports'],
    },
    {
      icon: 'pi-calendar',
      title: 'Smart Scheduling',
      description:
        'Book, reschedule, and manage sessions with an intuitive calendar that fits around your life — not the other way around.',
      features: ['Real-time availability', 'Easy rescheduling', 'Automated reminders', 'Calendar sync'],
    },
    {
      icon: 'pi-heart',
      title: 'Wellness Programs',
      description:
        'Holistic programs that go beyond the gym — addressing fitness, nutrition, recovery, and mental well-being together.',
      features: ['Stress management', 'Sleep optimisation', 'Mindfulness training', 'Lifestyle coaching'],
    },
  ];
}
