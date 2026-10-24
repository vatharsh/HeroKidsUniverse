import { HttpException } from '@nestjs/common';

import { PreviewQuotaService } from './preview-quota.service';

function setup(limit: string | null, previewsToday: number) {
  const inserted: string[] = [];
  const dataSource = {
    getRepository: () => ({ findOne: async () => (limit === null ? null : { value: limit }) }),
    query: async (sql: string, params?: string[]) => { if (sql.includes('INSERT INTO preview_waitlist')) inserted.push(params![0]); return []; },
  };
  const manager = { query: async (sql: string) => (sql.includes('COUNT(*)') ? [{ n: previewsToday }] : []) };
  const svc = new PreviewQuotaService(dataSource as never, {} as never);
  return { svc, manager, inserted };
}

describe('free-preview daily quota', () => {
  const parent = { id: 'u1', role: 'parent' } as never;

  it('does nothing when no limit is set', async () => {
    const { svc, manager } = setup(null, 9999);
    await expect(svc.assertPreviewAvailable(manager as never, parent)).resolves.toBeUndefined();
  });

  it('allows previews under the limit', async () => {
    const { svc, manager } = setup('300', 299);
    await expect(svc.assertPreviewAvailable(manager as never, parent)).resolves.toBeUndefined();
  });

  it('refuses with a try-tomorrow message and waitlists the parent once the limit is reached', async () => {
    const { svc, manager, inserted } = setup('300', 300);
    await expect(svc.assertPreviewAvailable(manager as never, parent)).rejects.toThrow(HttpException);
    await expect(svc.assertPreviewAvailable(manager as never, parent)).rejects.toThrow(/come back tomorrow/);
    expect(inserted).toContain('u1');
  });

  it('never limits admins', async () => {
    const { svc, manager } = setup('1', 50);
    await expect(svc.assertPreviewAvailable(manager as never, { id: 'a', role: 'admin' } as never)).resolves.toBeUndefined();
  });
});
