import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, NgTemplateOutlet, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { DividerModule } from 'primeng/divider';
import { Select } from 'primeng/select';
import { TagModule } from 'primeng/tag';

import {
  AuthStore,
  CurrencyRonPipe,
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
  type ClientUser,
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
    TitleCasePipe,
    AvatarModule,
    ButtonModule,
    CardModule,
    ChartModule,
    DividerModule,
    Select,
    TagModule,
    CurrencyRonPipe,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  protected readonly _authStore = inject(AuthStore);

  readonly ClientStatuses = InstructorClientStatuses;
  readonly ClientStatusLabels = ClientStatusLabels;
  readonly InvoiceStatuses = InvoiceStatuses;
  readonly JoinPolicies = JoinPolicies;

  selectedLocation = 'all';
  selectedEvent = 'all';
  selectedFilter = 'none';

  readonly locationOptions = [{ label: 'All locations', value: 'all' }];
  readonly eventOptions = [{ label: 'All events', value: 'all' }];
  readonly filterOptions = [{ label: 'No filter', value: 'none' }];

  readonly recentActivities = signal<RecentActivity[]>([
    {
      id: '1',
      userName: 'Bogdan test Daniel test',
      initials: 'BD',
      description: 'signed in for the first time and completed their app setup.',
      timeAgo: '1 minute ago',
    },
    {
      id: '2',
      userName: 'Bogdan Daniel',
      initials: 'BD',
      description: 'signed in for the first time and completed their app setup.',
      timeAgo: '1 hour ago',
    },
    {
      id: '5',
      userName: 'Bogdan Daniel',
      initials: 'BD',
      description: 'signed in for the first time and completed their app setup.',
      timeAgo: '1 hour ago',
    },
    {
      id: '4',
      userName: 'Bogdan test Daniel test',
      initials: 'BD',
      description: 'signed in for the first time and completed their app setup.',
      timeAgo: '1 minute ago',
    },
    {
      id: '5',
      userName: 'Bogdan Daniel',
      initials: 'BD',
      description: 'signed in for the first time and completed their app setup.',
      timeAgo: '1 hour ago',
    },
    {
      id: '6',
      userName: 'Bogdan Daniel',
      initials: 'BD',
      description: 'signed in for the first time and completed their app setup.',
      timeAgo: '1 hour ago',
    },
  ]);

  readonly businessGrowthData = {
    labels: [
      "May '25",
      "Jun '25",
      "Jul '25",
      "Aug '25",
      "Sep '25",
      "Oct '25",
      "Nov '25",
      "Dec '25",
      "Jan '26",
      "Feb '26",
      "Mar '26",
      "Apr '26",
    ],
    datasets: [
      {
        label: 'Clients',
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

  readonly clients = signal<InstructorClient[]>([
    {
      id: '1',
      instructorId: 'inst-1',
      clientId: 'u1',
      status: InstructorClientStatuses.Active,
      initiatedBy: 'INSTRUCTOR',
      notes: null,
      startedAt: '2025-01-10T10:00:00.000Z',
      createdAt: '2025-01-10T10:00:00.000Z',
      updatedAt: '2025-01-10T10:00:00.000Z',
      invitedEmail: null,
      requestType: 'INSTRUCTOR_TO_CLIENT',
      expiresAt: null,
      client: { id: 'u1', firstName: 'Ana', lastName: 'Ionescu', email: 'ana@example.com' },
    },
    {
      id: '2',
      instructorId: 'inst-1',
      clientId: 'u2',
      status: InstructorClientStatuses.Active,
      initiatedBy: 'INSTRUCTOR',
      notes: null,
      startedAt: '2025-02-15T10:00:00.000Z',
      createdAt: '2025-02-15T10:00:00.000Z',
      updatedAt: '2025-02-15T10:00:00.000Z',
      invitedEmail: null,
      requestType: 'INSTRUCTOR_TO_CLIENT',
      expiresAt: null,
      client: { id: 'u2', firstName: 'Mihai', lastName: 'Pop', email: 'mihai@example.com' },
    },
    {
      id: '3',
      instructorId: 'inst-1',
      clientId: 'u3',
      status: InstructorClientStatuses.Pending,
      initiatedBy: 'INSTRUCTOR',
      notes: null,
      startedAt: null,
      createdAt: '2026-04-20T10:00:00.000Z',
      updatedAt: '2026-04-20T10:00:00.000Z',
      invitedEmail: 'elena@example.com',
      requestType: 'INSTRUCTOR_TO_CLIENT',
      expiresAt: '2026-05-20T10:00:00.000Z',
      client: { id: 'u3', firstName: 'Elena', lastName: 'Dumitrescu', email: 'elena@example.com' },
    },
    {
      id: '4',
      instructorId: 'inst-1',
      clientId: 'u4',
      status: InstructorClientStatuses.Active,
      initiatedBy: 'CLIENT',
      notes: 'Focused on marathon training',
      startedAt: '2025-03-01T10:00:00.000Z',
      createdAt: '2025-03-01T10:00:00.000Z',
      updatedAt: '2025-03-01T10:00:00.000Z',
      invitedEmail: null,
      requestType: 'CLIENT_TO_INSTRUCTOR',
      expiresAt: null,
      client: { id: 'u4', firstName: 'Andrei', lastName: 'Munteanu', email: 'andrei@example.com' },
    },
  ]);

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
      description: 'Personal training — April week 2',
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
      description: 'Personal training — April',
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

  joinPolicyLabel(policy: JoinPolicy): string {
    switch (policy) {
      case JoinPolicies.Open:
        return 'Open';
      case JoinPolicies.Approval:
        return 'Approval';
      case JoinPolicies.InviteOnly:
        return 'Invite only';
      default:
        return policy;
    }
  }

  clientInitials(client: ClientUser): string {
    return `${client.firstName.charAt(0)}${client.lastName.charAt(0)}`.toUpperCase();
  }

  invoiceAmount(invoice: Invoice): number {
    return invoice.amountPaidCents > 0 ? invoice.amountPaidCents : invoice.amountDueCents;
  }
}
