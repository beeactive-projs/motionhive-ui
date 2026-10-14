import { CoachStacks, clientPath, clientUrl, coachStackOf } from './client-paths';

describe('client paths', () => {
  it('stays in Programs when opened from a plan, Clients otherwise', () => {
    expect(coachStackOf('/tabs/programs/program/p-1/assignments')).toBe(CoachStacks.Programs);
    expect(coachStackOf('/tabs/programs/client/user-1/progress')).toBe(CoachStacks.Programs);
    expect(coachStackOf('/tabs/clients/user-1')).toBe(CoachStacks.Clients);
    // A cold load from anywhere else lands on the client's home tab.
    expect(coachStackOf('/tabs/home')).toBe(CoachStacks.Clients);
  });

  it('builds the client page path each stack mounts', () => {
    expect(clientPath(CoachStacks.Clients, 'user-1')).toEqual(['/tabs/clients', 'user-1']);
    expect(clientPath(CoachStacks.Programs, 'user-1')).toEqual([
      '/tabs/programs',
      'client',
      'user-1',
    ]);
    expect(clientUrl(CoachStacks.Clients, 'user-1')).toBe('/tabs/clients/user-1');
    expect(clientUrl(CoachStacks.Programs, 'user-1')).toBe('/tabs/programs/client/user-1');
  });
});
