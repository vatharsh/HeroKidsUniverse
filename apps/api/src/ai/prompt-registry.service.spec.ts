import { BadRequestException, ConflictException } from '@nestjs/common';

import { PromptRegistryService } from './prompt-registry.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: value.id ?? 'saved-id', ...value })),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    })),
    ...overrides,
  };
}

function serviceWith(overrides: {
  templates?: Record<string, jest.Mock>;
  versions?: Record<string, jest.Mock>;
  snapshots?: Record<string, jest.Mock>;
  dataSource?: Record<string, jest.Mock>;
} = {}) {
  const templates = repo(overrides.templates);
  const versions = repo(overrides.versions);
  const snapshots = repo(overrides.snapshots);
  const dataSource = {
    query: jest.fn(),
    transaction: jest.fn(async (callback) => callback({ getRepository: () => versions })),
    ...overrides.dataSource,
  };
  const service = new PromptRegistryService(templates as any, versions as any, snapshots as any, dataSource as any);
  return { service, templates, versions, snapshots, dataSource };
}

describe('PromptRegistryService', () => {
  it('returns null when active prompt template is disabled or missing', async () => {
    const { service, templates, versions } = serviceWith({
      templates: { findOne: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.getActivePrompt('story_generation')).resolves.toBeNull();
    expect(templates.findOne).toHaveBeenCalledWith({
      where: { promptKey: 'story_generation', isActive: true, isDeleted: false },
    });
    expect(versions.findOne).not.toHaveBeenCalled();
  });

  it('returns the current non-deleted version for an active template', async () => {
    const current = { id: 'version-1', version: 'v1.0.0' };
    const { service, versions } = serviceWith({
      templates: { findOne: jest.fn().mockResolvedValue({ id: 'template-1', isActive: true }) },
      versions: { findOne: jest.fn().mockResolvedValue(current) },
    });

    await expect(service.getActivePrompt('story_generation')).resolves.toBe(current);
    expect(versions.findOne).toHaveBeenCalledWith({
      where: { promptTemplateId: 'template-1', isCurrent: true, isDeleted: false },
    });
  });

  it('does not allow duplicate template keys', async () => {
    const { service } = serviceWith({
      templates: { findOne: jest.fn().mockResolvedValue({ id: 'existing-template' }) },
    });

    await expect(service.createTemplate({
      promptKey: 'story_generation',
      name: 'Story',
      promptType: 'story_generation',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('only allows draft versions to be edited', async () => {
    const { service } = serviceWith({
      versions: { findOne: jest.fn().mockResolvedValue({ id: 'version-1', status: 'active', isDeleted: false }) },
    });

    await expect(service.updateVersion('version-1', { promptText: 'new text' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('renders variables and leaves unmatched placeholders intact', () => {
    const { service } = serviceWith();

    expect(service.renderPrompt('Hello {{heroName}} in {{universe}}', { heroName: 'Siddhant' }))
      .toBe('Hello Siddhant in {{universe}}');
  });

  it('activates one version and deactivates existing current versions transactionally', async () => {
    const version = {
      id: 'version-2',
      promptTemplateId: 'template-1',
      status: 'draft',
      isCurrent: false,
      isDeleted: false,
    };
    const { service, versions } = serviceWith({
      versions: {
        findOne: jest.fn().mockResolvedValue(version),
        findOneByOrFail: jest.fn().mockResolvedValue({ ...version, status: 'active', isCurrent: true }),
      },
    });

    const result = await service.activateVersion('version-2', 'admin-1');

    expect(result.status).toBe('active');
    expect(versions.update).toHaveBeenCalledWith('version-2', expect.objectContaining({
      status: 'active',
      isCurrent: true,
      approvedByUserId: 'admin-1',
    }));
  });
});
