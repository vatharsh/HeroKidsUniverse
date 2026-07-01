import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { Roles } from '../auth/decorators/roles.decorator';
import { ReportFilters, ReportsService } from './reports.service';
import { ReportsExportService } from './reports-export.service';

@Controller('admin/reports')
@Roles('admin')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly exportService: ReportsExportService,
  ) {}

  @Get(':reportType')
  async getReport(
    @Param('reportType') reportType: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('universeId') universeId?: string,
    @Query('productId') productId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('sandbox') sandbox?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
  ) {
    const filters: ReportFilters = {
      dateFrom, dateTo, search, status, userId, universeId,
      productId, categoryId, paymentMethod,
      isSandbox: sandbox === 'true' ? true : sandbox === 'false' ? false : undefined,
      page: Number(page),
      limit: Number(limit),
    };
    return this.reportsService.getReport(reportType, filters);
  }

  @Get(':reportType/export/excel')
  async exportExcel(
    @Param('reportType') reportType: string,
    @Res() res: Response,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('universeId') universeId?: string,
    @Query('productId') productId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('sandbox') sandbox?: string,
  ) {
    const filters: ReportFilters = {
      dateFrom, dateTo, search, status, userId, universeId,
      productId, categoryId, paymentMethod,
      isSandbox: sandbox === 'true' ? true : sandbox === 'false' ? false : undefined,
    };
    const result = await this.reportsService.getReport(reportType, filters, true);
    return this.exportService.exportExcel(reportType, filters, result, res);
  }

  @Get(':reportType/export/pdf')
  async exportPdf(
    @Param('reportType') reportType: string,
    @Res() res: Response,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('universeId') universeId?: string,
    @Query('productId') productId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('sandbox') sandbox?: string,
  ) {
    const filters: ReportFilters = {
      dateFrom, dateTo, search, status, userId, universeId,
      productId, categoryId, paymentMethod,
      isSandbox: sandbox === 'true' ? true : sandbox === 'false' ? false : undefined,
    };
    const result = await this.reportsService.getReport(reportType, filters, true);
    return this.exportService.exportPdf(reportType, filters, result, res);
  }
}
