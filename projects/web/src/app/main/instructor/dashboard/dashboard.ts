import { Component, inject, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SelectItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { Avatar } from '../../../_shared/components/avatar/avatar';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { DividerModule } from 'primeng/divider';
import { Select } from 'primeng/select';
import { TagModule } from 'primeng/tag';

import {
  AuthStore,
  CurrencyRonPipe,
  EnumLabelPipe,
  monthNames,
  TagSeverity,
  InstructorClientStatuses,
  ClientStatusLabels,
  InvoiceStatuses,
  JoinPolicies,
  GroupMemberPostPolicies,
  type InstructorClient,
  type InstructorClientStatus,
  type Group,
  type JoinPolicy,
  type EarningsSummary,
  type Invoice,
  type InvoiceStatus,
  User,
} from 'core';

interface RecentActivity {
  id: string;
  userName: string;
  initials: string;
  description: string;
  timeAgo: string;
}

@Component({
  selector: 'mh-dashboard',
  imports: [
    RouterLink,
    DatePipe,
    FormsModule,
    NgTemplateOutlet,
    AvatarModule,
    Avatar,
    CardModule,
    ChartModule,
    DividerModule,
    Select,
    TagModule,
    CurrencyRonPipe,
    EnumLabelPipe,
    TranslatePipe,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly _authStore = inject(AuthStore);
  private readonly _translateService = inject(TranslateService);

  readonly ClientStatuses = InstructorClientStatuses;
  readonly ClientStatusLabels = ClientStatusLabels;
  readonly InvoiceStatuses = InvoiceStatuses;
  readonly JoinPolicies = JoinPolicies;

  selectedLocation = 'all';
  selectedEvent = 'all';
  selectedFilter = 'none';

  readonly locationOptions: SelectItem[] = [
    { label: this._translateService.instant('coachDashboard.activity.allLocations'), value: 'all' },
  ];
  readonly eventOptions: SelectItem[] = [
    { label: this._translateService.instant('coachDashboard.activity.allEvents'), value: 'all' },
  ];
  readonly filterOptions: SelectItem[] = [
    { label: this._translateService.instant('coachDashboard.activity.noFilter'), value: 'none' },
  ];

  readonly recentActivities = signal<RecentActivity[]>([
    {
      id: '1',
      userName: 'Bogdan test Daniel test',
      initials: 'BD',
      description: this._translateService.instant('coachDashboard.activity.completedSetup'),
      timeAgo: this._translateService.instant('coachDashboard.activity.minutesAgo', { count: 1 }),
    },
    {
      id: '2',
      userName: 'Bogdan Daniel',
      initials: 'BD',
      description: this._translateService.instant('coachDashboard.activity.completedSetup'),
      timeAgo: this._translateService.instant('coachDashboard.activity.hoursAgo', { count: 1 }),
    },
    {
      id: '5',
      userName: 'Bogdan Daniel',
      initials: 'BD',
      description: this._translateService.instant('coachDashboard.activity.completedSetup'),
      timeAgo: this._translateService.instant('coachDashboard.activity.hoursAgo', { count: 1 }),
    },
    {
      id: '4',
      userName: 'Bogdan test Daniel test',
      initials: 'BD',
      description: this._translateService.instant('coachDashboard.activity.completedSetup'),
      timeAgo: this._translateService.instant('coachDashboard.activity.minutesAgo', { count: 1 }),
    },
    {
      id: '5',
      userName: 'Bogdan Daniel',
      initials: 'BD',
      description: this._translateService.instant('coachDashboard.activity.completedSetup'),
      timeAgo: this._translateService.instant('coachDashboard.activity.hoursAgo', { count: 1 }),
    },
    {
      id: '6',
      userName: 'Bogdan Daniel',
      initials: 'BD',
      description: this._translateService.instant('coachDashboard.activity.completedSetup'),
      timeAgo: this._translateService.instant('coachDashboard.activity.hoursAgo', { count: 1 }),
    },
  ]);

  readonly businessGrowthData = {
    labels: this.growthMonthLabels(),
    datasets: [
      {
        label: this._translateService.instant('nav.clients'),
        data: [0, 5, 0, 0, 2, 0, 0, 0, 0, 1, 2, 3],
        fill: true,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        tension: 0.4,
        pointBackgroundColor: '#3b82f6',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  readonly chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 3.5,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { usePointStyle: true, padding: 16, boxWidth: 8 },
      },
      tooltip: { mode: 'index' as const, intersect: false },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '#94a3b8' },
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, precision: 0, color: '#94a3b8' },
        grid: { color: 'rgba(148, 163, 184, 0.15)' },
        border: { display: false },
      },
    },
  };

  readonly clients = signal<InstructorClient[]>([]);

  readonly activeClientCount = computed(
    () => this.clients().filter((c) => c.status === InstructorClientStatuses.Active).length,
  );

  readonly pendingClientCount = computed(
    () => this.clients().filter((c) => c.status === InstructorClientStatuses.Pending).length,
  );

  readonly groups = signal<Group[]>([
    {
      id: 'g1',
      instructorId: 'inst-1',
      name: 'Morning Bootcamp',
      slug: 'morning-bootcamp',
      description: 'High-intensity morning training sessions for all levels.',
      logoUrl: null,
      timezone: 'Europe/Bucharest',
      isActive: true,
      isPublic: true,
      joinPolicy: JoinPolicies.Open,
      memberPostPolicy: GroupMemberPostPolicies.Disabled,
      tags: ['fitness', 'bootcamp'],
      contactEmail: null,
      contactPhone: null,
      address: null,
      city: 'Bucharest',
      country: 'RO',
      memberCount: 12,
      joinToken: null,
      joinTokenExpiresAt: null,
      createdAt: '2025-01-01T10:00:00.000Z',
      updatedAt: '2025-01-01T10:00:00.000Z',
    },
    {
      id: 'g2',
      instructorId: 'inst-1',
      name: 'Yoga Foundations',
      slug: 'yoga-foundations',
      description: 'Beginner-friendly yoga sessions focused on flexibility and mindfulness.',
      logoUrl: null,
      timezone: 'Europe/Bucharest',
      isActive: true,
      isPublic: true,
      joinPolicy: JoinPolicies.Approval,
      memberPostPolicy: GroupMemberPostPolicies.Disabled,
      tags: ['yoga', 'flexibility'],
      contactEmail: null,
      contactPhone: null,
      address: null,
      city: 'Bucharest',
      country: 'RO',
      memberCount: 8,
      joinToken: null,
      joinTokenExpiresAt: null,
      createdAt: '2025-02-01T10:00:00.000Z',
      updatedAt: '2025-02-01T10:00:00.000Z',
    },
    {
      id: 'g3',
      instructorId: 'inst-1',
      name: 'Elite Athletes',
      slug: 'elite-athletes',
      description: 'Advanced strength and conditioning program for competitive athletes.',
      logoUrl: null,
      timezone: 'Europe/Bucharest',
      isActive: true,
      isPublic: false,
      joinPolicy: JoinPolicies.InviteOnly,
      memberPostPolicy: GroupMemberPostPolicies.Disabled,
      tags: ['strength', 'conditioning'],
      contactEmail: null,
      contactPhone: null,
      address: null,
      city: null,
      country: 'RO',
      memberCount: 5,
      joinToken: null,
      joinTokenExpiresAt: null,
      createdAt: '2025-03-01T10:00:00.000Z',
      updatedAt: '2025-03-01T10:00:00.000Z',
    },
  ]);

  readonly totalMembers = computed(() => this.groups().reduce((sum, g) => sum + g.memberCount, 0));

  readonly earnings = signal<EarningsSummary>({
    currency: 'RON',
    monthToDateRevenueCents: 420000,
    availableBalanceCents: 185000,
    pendingBalanceCents: 60000,
    outstandingInvoicesCents: 75000,
    openInvoiceCount: 2,
    overdueInvoiceCount: 1,
    nextPayoutDate: '2026-05-01',
    topClients: [
      {
        clientId: 'u1',
        firstName: 'Ana',
        lastName: 'Ionescu',
        email: 'ana@example.com',
        totalPaidCents: 195000,
      },
      {
        clientId: 'u4',
        firstName: 'Andrei',
        lastName: 'Munteanu',
        email: 'andrei@example.com',
        totalPaidCents: 160000,
      },
    ],
  });

  readonly recentInvoices = signal<Invoice[]>([
    {
      id: 'inv1',
      instructorId: 'inst-1',
      clientId: 'u1',
      clientEmail: 'ana@example.com',
      subscriptionId: null,
      stripeInvoiceId: 'in_mock1',
      number: 'INV-001',
      status: InvoiceStatuses.Paid,
      amountDueCents: 0,
      amountPaidCents: 15000,
      currency: 'RON',
      applicationFeeCents: 450,
      dueDate: '2026-04-15',
      finalizedAt: '2026-04-10T10:00:00.000Z',
      paidAt: '2026-04-14T10:00:00.000Z',
      voidedAt: null,
      hostedInvoiceUrl: null,
      invoicePdf: null,
      paidOutOfBand: false,
      description: 'Personal training, April week 2',
      createdAt: '2026-04-10T10:00:00.000Z',
      updatedAt: '2026-04-14T10:00:00.000Z',
    },
    {
      id: 'inv2',
      instructorId: 'inst-1',
      clientId: 'u2',
      clientEmail: 'mihai@example.com',
      subscriptionId: null,
      stripeInvoiceId: 'in_mock2',
      number: 'INV-002',
      status: InvoiceStatuses.Open,
      amountDueCents: 20000,
      amountPaidCents: 0,
      currency: 'RON',
      applicationFeeCents: 600,
      dueDate: '2026-05-01',
      finalizedAt: '2026-04-20T10:00:00.000Z',
      paidAt: null,
      voidedAt: null,
      hostedInvoiceUrl: null,
      invoicePdf: null,
      paidOutOfBand: false,
      description: 'Personal training, April',
      createdAt: '2026-04-20T10:00:00.000Z',
      updatedAt: '2026-04-20T10:00:00.000Z',
    },
    {
      id: 'inv3',
      instructorId: 'inst-1',
      clientId: 'u3',
      clientEmail: 'elena@example.com',
      subscriptionId: null,
      stripeInvoiceId: 'in_mock3',
      number: null,
      status: InvoiceStatuses.Draft,
      amountDueCents: 8000,
      amountPaidCents: 0,
      currency: 'RON',
      applicationFeeCents: 0,
      dueDate: null,
      finalizedAt: null,
      paidAt: null,
      voidedAt: null,
      hostedInvoiceUrl: null,
      invoicePdf: null,
      paidOutOfBand: false,
      description: 'Intro session',
      createdAt: '2026-04-25T10:00:00.000Z',
      updatedAt: '2026-04-25T10:00:00.000Z',
    },
    {
      id: 'inv4',
      instructorId: 'inst-1',
      clientId: 'u4',
      clientEmail: 'andrei@example.com',
      subscriptionId: null,
      stripeInvoiceId: 'in_mock4',
      number: 'INV-003',
      status: InvoiceStatuses.Open,
      amountDueCents: 32000,
      amountPaidCents: 0,
      currency: 'RON',
      applicationFeeCents: 960,
      dueDate: '2026-04-28',
      finalizedAt: '2026-04-22T10:00:00.000Z',
      paidAt: null,
      voidedAt: null,
      hostedInvoiceUrl: null,
      invoicePdf: null,
      paidOutOfBand: false,
      description: 'Monthly coaching package',
      createdAt: '2026-04-22T10:00:00.000Z',
      updatedAt: '2026-04-22T10:00:00.000Z',
    },
  ]);

  clientStatusSeverity(status: InstructorClientStatus): TagSeverity {
    switch (status) {
      case InstructorClientStatuses.Active:
        return TagSeverity.Success;
      case InstructorClientStatuses.Pending:
        return TagSeverity.Warn;
      default:
        return TagSeverity.Secondary;
    }
  }

  invoiceStatusSeverity(status: InvoiceStatus): TagSeverity {
    switch (status) {
      case InvoiceStatuses.Paid:
        return TagSeverity.Success;
      case InvoiceStatuses.Open:
        return TagSeverity.Info;
      case InvoiceStatuses.Uncollectible:
        return TagSeverity.Danger;
      default:
        return TagSeverity.Secondary;
    }
  }

  joinPolicySeverity(policy: JoinPolicy): TagSeverity {
    switch (policy) {
      case JoinPolicies.Open:
        return TagSeverity.Success;
      case JoinPolicies.Approval:
        return TagSeverity.Info;
      case JoinPolicies.InviteOnly:
        return TagSeverity.Warn;
      default:
        return TagSeverity.Secondary;
    }
  }

  /**
   * "May '25" … "Apr '26" — the (mock) 12-month window the growth chart
   * covers, with month names in the UI language.
   */
  private growthMonthLabels(): string[] {
    const months = monthNames('short');
    return Array.from({ length: 12 }, (_, i) => {
      const date = new Date(2025, 4 + i, 1);
      const year = String(date.getFullYear()).slice(-2);
      return `${months[date.getMonth()]} '${year}`;
    });
  }

  clientInitials(client: User): string {
    return `${client.firstName.charAt(0)}${client.lastName.charAt(0)}`.toUpperCase();
  }

  invoiceAmount(invoice: Invoice): number {
    return invoice.amountPaidCents > 0 ? invoice.amountPaidCents : invoice.amountDueCents;
  }
}
