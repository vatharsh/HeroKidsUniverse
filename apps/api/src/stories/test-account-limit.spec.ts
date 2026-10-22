import { HttpException } from '@nestjs/common';

import { User, UserRole } from '../users/user.entity';
import { StoriesService } from './stories.service';

function check(user: Partial<User>, used: number, limitSetting?: string) {
  const svc = Object.create(StoriesService.prototype) as StoriesService;
  const manager = {
    findOne: async () => (limitSetting === undefined ? null : { value: limitSetting }),
    query: async () => [{ used }],
  };
  return (svc as unknown as { assertTestAccountAllowance: (m: unknown, u: Partial<User>) => Promise<void> })
    .assertTestAccountAllowance(manager, { id: 'u1', role: UserRole.Parent, isTestAccount: true, ...user });
}

describe('test account story limit', () => {
  it('allows a test account its first 2 stories', async () => {
    await expect(check({}, 0)).resolves.toBeUndefined();
    await expect(check({}, 1)).resolves.toBeUndefined();
  });

  it('refuses the 3rd story with a clear message', async () => {
    await expect(check({}, 2)).rejects.toThrow(HttpException);
    await expect(check({}, 2)).rejects.toThrow(/test accounts can create only 2 stories/);
  });

  it('follows the setting and ignores real and admin accounts', async () => {
    await expect(check({}, 2, '5')).resolves.toBeUndefined();
    await expect(check({ isTestAccount: false }, 50)).resolves.toBeUndefined();
    await expect(check({ role: UserRole.Admin }, 50)).resolves.toBeUndefined();
  });
});
