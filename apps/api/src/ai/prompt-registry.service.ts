import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { PromptRunSnapshot } from './entities/prompt-run-snapshot.entity';
import { PromptTemplate } from './entities/prompt-template.entity';
import { PromptTemplateVersion } from './entities/prompt-template-version.entity';

type ListTemplateParams = {
  page?: number;
  limit?: number;
  promptType?: string;
  search?: string;
  isActive?: boolean;
};

type PageResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function makePage<T>(items: T[], total: number, page: number, limit: number): PageResponse<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

@Injectable()
export class PromptRegistryService {
  private readonly logger = new Logger(PromptRegistryService.name);

  constructor(
    @InjectRepository(PromptTemplate)
    private readonly templatesRepository: Repository<PromptTemplate>,
    @InjectRepository(PromptTemplateVersion)
    private readonly versionsRepository: Repository<PromptTemplateVersion>,
    @InjectRepository(PromptRunSnapshot)
    private readonly snapshotsRepository: Repository<PromptRunSnapshot>,
    private readonly dataSource: DataSource,
  ) {}

  async listTemplates(params: ListTemplateParams) {
    const page = Math.max(1, Number(params.page ?? 1));
    const limit = Math.max(1, Number(params.limit ?? 20));
    const offset = (page - 1) * limit;

    const where: string[] = ['pt."isDeleted" = false'];
    const values: unknown[] = [];

    if (params.promptType) {
      values.push(params.promptType);
      where.push(`pt."promptType" = $${values.length}`);
    }
    if (params.search?.trim()) {
      values.push(`%${params.search.trim()}%`);
      const idx = values.length;
      where.push(`(pt."promptKey" ILIKE $${idx} OR pt."name" ILIKE $${idx} OR COALESCE(pt."description", '') ILIKE $${idx})`);
    }
    if (typeof params.isActive === 'boolean') {
      values.push(params.isActive);
      where.push(`pt."isActive" = $${values.length}`);
    }

    values.push(limit, offset);
    const limitParam = `$${values.length - 1}`;
    const offsetParam = `$${values.length}`;
    const whereSql = where.join(' AND ');

    const rows = await this.dataSource.query(
      `
        SELECT
          pt.*,
          cv.id AS "currentVersionId",
          cv.version AS "currentVersion",
          cv.status AS "currentVersionStatus",
          COALESCE(vc."totalVersions", 0)::int AS "totalVersions"
        FROM "prompt_templates" pt
        LEFT JOIN LATERAL (
          SELECT id, version, status
          FROM "prompt_template_versions"
          WHERE "promptTemplateId" = pt.id
            AND "isCurrent" = true
            AND "isDeleted" = false
          ORDER BY "activatedAt" DESC NULLS LAST
          LIMIT 1
        ) cv ON true
        LEFT JOIN (
          SELECT "promptTemplateId", COUNT(*)::int AS "totalVersions"
          FROM "prompt_template_versions"
          WHERE "isDeleted" = false
          GROUP BY "promptTemplateId"
        ) vc ON vc."promptTemplateId" = pt.id
        WHERE ${whereSql}
        ORDER BY pt."createdAt" DESC
        LIMIT ${limitParam}
        OFFSET ${offsetParam}
      `,
      values,
    );

    const countRows = await this.dataSource.query(
      `
        SELECT COUNT(*)::int AS total
        FROM "prompt_templates" pt
        WHERE ${whereSql}
      `,
      values.slice(0, values.length - 2),
    );

    return makePage(rows, Number(countRows[0]?.total ?? 0), page, limit);
  }

  async getTemplate(id: string) {
    const template = await this.templatesRepository.findOne({
      where: { id, isDeleted: false },
      relations: { versions: true },
    });
    if (!template) {
      throw new NotFoundException('Prompt template not found');
    }

    return {
      ...template,
      versions: template.versions
        .filter((version) => !version.isDeleted)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    };
  }

  async createTemplate(dto: {
    promptKey: string;
    name: string;
    description?: string;
    promptType: string;
    provider?: string;
    defaultModel?: string;
    isSystemPrompt?: boolean;
  }) {
    const existing = await this.templatesRepository.findOne({
      where: { promptKey: dto.promptKey },
    });
    if (existing) {
      throw new ConflictException('Prompt key already exists');
    }

    const template = this.templatesRepository.create({
      promptKey: dto.promptKey,
      name: dto.name,
      description: dto.description ?? null,
      promptType: dto.promptType,
      provider: dto.provider ?? null,
      defaultModel: dto.defaultModel ?? null,
      isSystemPrompt: dto.isSystemPrompt ?? false,
    });
    return this.templatesRepository.save(template);
  }

  async updateTemplate(
    id: string,
    dto: Partial<{
      name: string;
      description: string | null;
      promptType: string;
      provider: string | null;
      defaultModel: string | null;
      isActive: boolean;
    }>,
  ) {
    const template = await this.templatesRepository.findOne({
      where: { id, isDeleted: false },
    });
    if (!template) {
      throw new NotFoundException('Prompt template not found');
    }

    Object.assign(template, dto);
    return this.templatesRepository.save(template);
  }

  async softDeleteTemplate(id: string, userId: string) {
    const template = await this.templatesRepository.findOne({
      where: { id, isDeleted: false },
    });
    if (!template) {
      throw new NotFoundException('Prompt template not found');
    }

    const deletedAt = new Date();
    await this.templatesRepository.update(id, {
      isDeleted: true,
      deletedAt,
      deletedBy: userId,
    });
    await this.versionsRepository
      .createQueryBuilder()
      .update(PromptTemplateVersion)
      .set({
        isDeleted: true,
        deletedAt,
        deletedBy: userId,
      })
      .where('"promptTemplateId" = :templateId', { templateId: id })
      .andWhere('"isDeleted" = false')
      .execute();

    return { success: true };
  }

  async getVersions(templateId: string, params: { page?: number; limit?: number }) {
    const template = await this.templatesRepository.findOne({
      where: { id: templateId, isDeleted: false },
    });
    if (!template) {
      throw new NotFoundException('Prompt template not found');
    }

    const page = Math.max(1, Number(params.page ?? 1));
    const limit = Math.max(1, Number(params.limit ?? 20));
    const [items, total] = await this.versionsRepository.findAndCount({
      where: { promptTemplateId: templateId, isDeleted: false },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return makePage(items, total, page, limit);
  }

  async getVersion(versionId: string) {
    const version = await this.versionsRepository.findOne({
      where: { id: versionId, isDeleted: false },
    });
    if (!version) {
      throw new NotFoundException('Prompt template version not found');
    }
    return version;
  }

  async createVersion(
    templateId: string,
    dto: {
      version: string;
      title?: string;
      promptText: string;
      systemInstructions?: string;
      outputSchemaJson?: object;
      variablesJson?: object;
      changeNotes?: string;
    },
    userId: string | null,
  ) {
    const template = await this.templatesRepository.findOne({
      where: { id: templateId, isDeleted: false },
    });
    if (!template) {
      throw new NotFoundException('Prompt template not found');
    }

    const existing = await this.versionsRepository.findOne({
      where: {
        promptTemplateId: templateId,
        version: dto.version,
        isDeleted: false,
      },
    });
    if (existing) {
      throw new ConflictException('Version already exists for this template');
    }

    const version = this.versionsRepository.create({
      promptTemplateId: templateId,
      version: dto.version,
      title: dto.title ?? null,
      promptText: dto.promptText,
      systemInstructions: dto.systemInstructions ?? null,
      outputSchemaJson: dto.outputSchemaJson ?? null,
      variablesJson: dto.variablesJson ?? null,
      changeNotes: dto.changeNotes ?? null,
      status: 'draft',
      isCurrent: false,
      createdByUserId: userId,
    });
    return this.versionsRepository.save(version);
  }

  async updateVersion(
    versionId: string,
    dto: Partial<{
      title: string | null;
      promptText: string;
      systemInstructions: string | null;
      outputSchemaJson: object | null;
      variablesJson: object | null;
      changeNotes: string | null;
    }>,
  ) {
    const version = await this.getVersion(versionId);
    if (version.status !== 'draft') {
      throw new BadRequestException('Only draft versions can be updated');
    }

    Object.assign(version, dto);
    return this.versionsRepository.save(version);
  }

  async activateVersion(versionId: string, userId: string | null) {
    return this.dataSource.transaction(async (manager) => {
      const versionsRepository = manager.getRepository(PromptTemplateVersion);
      const version = await versionsRepository.findOne({
        where: { id: versionId, isDeleted: false },
      });
      if (!version) {
        throw new NotFoundException('Prompt template version not found');
      }
      if (version.status === 'active' || version.isCurrent) {
        throw new BadRequestException('Version is already active');
      }
      if (version.status === 'archived') {
        throw new BadRequestException('Archived versions cannot be activated');
      }

      const now = new Date();
      await versionsRepository
        .createQueryBuilder()
        .update(PromptTemplateVersion)
        .set({
          isCurrent: false,
          status: 'inactive',
          deactivatedAt: now,
        })
        .where('"promptTemplateId" = :templateId', { templateId: version.promptTemplateId })
        .andWhere('"isCurrent" = true')
        .andWhere('"isDeleted" = false')
        .execute();

      await versionsRepository.update(version.id, {
        status: 'active',
        isCurrent: true,
        activatedAt: now,
        approvedByUserId: userId,
        approvedAt: now,
      });

      return versionsRepository.findOneByOrFail({ id: version.id });
    });
  }

  async archiveVersion(versionId: string) {
    const version = await this.getVersion(versionId);
    if (version.isCurrent) {
      throw new BadRequestException('Deactivate the active version before archiving');
    }
    version.status = 'archived';
    return this.versionsRepository.save(version);
  }

  async duplicateVersion(versionId: string, userId: string) {
    const source = await this.getVersion(versionId);
    let nextVersion = `${source.version}-copy`;
    let suffix = 2;

    while (await this.versionsRepository.findOne({
      where: {
        promptTemplateId: source.promptTemplateId,
        version: nextVersion,
        isDeleted: false,
      },
    })) {
      nextVersion = `${source.version}-copy${suffix}`;
      suffix += 1;
    }

    const duplicate = this.versionsRepository.create({
      promptTemplateId: source.promptTemplateId,
      version: nextVersion,
      title: source.title,
      promptText: source.promptText,
      systemInstructions: source.systemInstructions,
      outputSchemaJson: source.outputSchemaJson,
      variablesJson: source.variablesJson,
      changeNotes: `Duplicated from v${source.version}`,
      status: 'draft',
      isCurrent: false,
      createdByUserId: userId,
    });

    return this.versionsRepository.save(duplicate);
  }

  async rollback(versionId: string, userId: string) {
    const version = await this.activateVersion(versionId, userId);
    await this.versionsRepository.update(version.id, {
      changeNotes: `Rolled back to v${version.version}`,
    });
    return this.getVersion(version.id);
  }

  async getActivePrompt(promptKey: string): Promise<PromptTemplateVersion | null> {
    const template = await this.templatesRepository.findOne({
      where: { promptKey, isActive: true, isDeleted: false },
    });
    if (!template) return null;

    return this.versionsRepository.findOne({
      where: {
        promptTemplateId: template.id,
        isCurrent: true,
        isDeleted: false,
      },
    });
  }

  renderPrompt(templateText: string, variables: Record<string, string>): string {
    return templateText.replace(/\{\{(\w+)\}\}/g, (match, variableName: string) => {
      return Object.prototype.hasOwnProperty.call(variables, variableName)
        ? variables[variableName]
        : match;
    });
  }

  async saveRunSnapshot(dto: {
    storyGenerationRunId?: string;
    storyId?: string;
    userId?: string;
    promptTemplateId: string;
    promptTemplateVersionId: string;
    promptKey: string;
    version: string;
    provider?: string;
    model?: string;
    resolvedPromptText: string;
    resolvedVariablesJson?: object;
  }) {
    const snapshot = this.snapshotsRepository.create({
      storyGenerationRunId: dto.storyGenerationRunId ?? null,
      storyId: dto.storyId ?? null,
      userId: dto.userId ?? null,
      promptTemplateId: dto.promptTemplateId,
      promptTemplateVersionId: dto.promptTemplateVersionId,
      promptKey: dto.promptKey,
      version: dto.version,
      provider: dto.provider ?? null,
      model: dto.model ?? null,
      resolvedPromptText: dto.resolvedPromptText,
      resolvedVariablesJson: dto.resolvedVariablesJson ?? null,
    });
    return this.snapshotsRepository.save(snapshot);
  }

  async getVersionPerformance(versionId: string) {
    const version = await this.getVersion(versionId);
    const rows = await this.dataSource.query(
      `
        SELECT
          COUNT(*)::int AS "storiesGenerated",
          AVG("avgIdentityScore") AS "avgIdentityScore",
          AVG("avgStoryScore") AS "avgStoryScore",
          AVG("overallConfidence") AS "avgOverallConfidence",
          AVG("pagesRetried") AS "avgRetries",
          CASE
            WHEN COUNT(*) = 0 THEN NULL
            ELSE AVG(CASE WHEN "overallStatus" = 'passed' THEN 1.0 ELSE 0.0 END)
          END AS "passRate"
        FROM "story_qa_runs"
        WHERE "storyPromptVersion" = $1
      `,
      [version.version],
    );

    return {
      storiesGenerated: Number(rows[0]?.storiesGenerated ?? 0),
      avgIdentityScore: rows[0]?.avgIdentityScore === null ? null : Number(rows[0].avgIdentityScore),
      avgStoryScore: rows[0]?.avgStoryScore === null ? null : Number(rows[0].avgStoryScore),
      avgOverallConfidence: rows[0]?.avgOverallConfidence === null ? null : Number(rows[0].avgOverallConfidence),
      avgRetries: rows[0]?.avgRetries === null ? null : Number(rows[0].avgRetries),
      passRate: rows[0]?.passRate === null ? null : Number(rows[0].passRate),
    };
  }

  async compareVersions(leftVersionId: string, rightVersionId: string) {
    const [left, right] = await Promise.all([
      this.getVersion(leftVersionId),
      this.getVersion(rightVersionId),
    ]);
    return { left, right };
  }

  warn(message: string, error?: unknown) {
    this.logger.warn(message, error instanceof Error ? error.stack : undefined);
  }
}
