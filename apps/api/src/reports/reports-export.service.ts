import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';

import { ReportFilters, PagedResult } from './reports.service';

const REPORT_LABELS: Record<string, string> = {
  'sales-revenue':    'Sales & Revenue',
  'orders':           'Orders',
  'merchandise':      'Merchandise',
  'ai-usage':         'AI Usage & Cost',
  'stories':          'Stories',
  'universes':        'Universes',
  'users':            'Users',
  'influencers':      'Influencers',
  'payments-refunds': 'Payments & Refunds',
  'generation-jobs':  'Generation Jobs',
  'profitability':    'Profitability',
};

@Injectable()
export class ReportsExportService {
  async exportPdf(
    reportType: string,
    filters: ReportFilters,
    result: PagedResult<Record<string, unknown>>,
    res: Response,
  ): Promise<void> {
    const label = REPORT_LABELS[reportType] ?? reportType;
    const filename = `herokids_${label.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000');
    doc.text(`HeroKids Universe - ${label} Report`, { align: 'left' });
    doc.fontSize(9).font('Helvetica').fillColor('#666666');
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`);
    doc.text(`Date Range: ${filters.dateFrom ?? 'Start of Month'} - ${filters.dateTo ?? 'Today'}`);
    doc.text(`Mode: ${filters.isSandbox === true ? 'Sandbox' : filters.isSandbox === false ? 'Live' : 'All'}`);
    doc.text(`Total Records: ${result.total}`);
    doc.moveDown();

    if (Object.keys(result.summary).length > 0) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('Summary', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica');
      for (const [key, value] of Object.entries(result.summary)) {
        doc.fillColor('#333333').text(`${this.formatKey(key)}: `, { continued: true });
        doc.fillColor('#000000').text(String(value));
      }
      doc.moveDown();
    }

    if (result.items.length > 0) {
      const columns = Object.keys(result.items[0]);
      const pageWidth = doc.page.width - 80;
      const colWidth = Math.min(pageWidth / columns.length, 120);

      let headerY = doc.y;
      this.drawPdfHeaderRow(doc, columns, pageWidth, colWidth, headerY);
      doc.y = headerY + 18;

      doc.font('Helvetica').fontSize(7).fillColor('#333333');
      result.items.forEach((row, index) => {
        if (doc.y > doc.page.height - 60) {
          doc.addPage();
          headerY = doc.y;
          this.drawPdfHeaderRow(doc, columns, pageWidth, colWidth, headerY);
          doc.y = headerY + 18;
          doc.font('Helvetica').fontSize(7).fillColor('#333333');
        }

        const rowY = doc.y;
        if (index % 2 === 0) {
          doc.rect(40, rowY, pageWidth, 14).fill('#F5F0FF');
        }

        let x = 40;
        columns.forEach((col) => {
          const value = row[col];
          let text = value === null || value === undefined ? '' : String(value);
          if (text.length > 20) text = `${text.substring(0, 17)}...`;
          doc.fillColor('#333333').text(text, x + 2, rowY + 3, { width: colWidth - 4, lineBreak: false });
          x += colWidth;
        });
        doc.y = rowY + 16;
      });
    }

    doc.end();
  }

  async exportExcel(
    reportType: string,
    filters: ReportFilters,
    result: PagedResult<Record<string, unknown>>,
    res: Response,
  ): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'HeroKids Admin';
    wb.created = new Date();

    const label = REPORT_LABELS[reportType] ?? reportType;
    const dataSheet = wb.addWorksheet('Data');
    const summarySheet = wb.addWorksheet('Summary');

    // ── Summary sheet ────────────────────────────────────────────────────
    const titleStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 14, color: { argb: 'FF1D1D1D' } },
    };
    const labelStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E0FF' } },
    };

    summarySheet.getCell('A1').value = `HeroKids Universe — ${label} Report`;
    summarySheet.getCell('A1').style = titleStyle;
    summarySheet.getCell('A2').value = `Generated: ${new Date().toLocaleString('en-IN')}`;
    summarySheet.getCell('A3').value = `Date Range: ${filters.dateFrom ?? 'Start of Month'} — ${filters.dateTo ?? 'Today'}`;
    summarySheet.getCell('A4').value = `Mode: ${filters.isSandbox === true ? 'Sandbox' : filters.isSandbox === false ? 'Live' : 'All'}`;
    summarySheet.getCell('A5').value = `Total Records: ${result.total}`;

    summarySheet.getRow(7).values = ['Metric', 'Value'];
    summarySheet.getRow(7).eachCell(c => { c.style = labelStyle; });

    let summaryRow = 8;
    for (const [k, v] of Object.entries(result.summary)) {
      summarySheet.getRow(summaryRow).values = [this.formatKey(k), v];
      summaryRow++;
    }

    summarySheet.getColumn(1).width = 35;
    summarySheet.getColumn(2).width = 20;

    // ── Data sheet ───────────────────────────────────────────────────────
    if (result.items.length === 0) {
      dataSheet.getCell('A1').value = 'No data for selected filters';
      this.sendExcel(wb, label, res);
      return;
    }

    const columns = Object.keys(result.items[0]);
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } },
      alignment: { horizontal: 'center' },
    };

    dataSheet.getRow(1).values = columns.map(c => this.formatKey(c));
    dataSheet.getRow(1).eachCell(c => { c.style = headerStyle; });

    result.items.forEach((item, i) => {
      const row = dataSheet.getRow(i + 2);
      columns.forEach((col, j) => {
        const cell = row.getCell(j + 1);
        const val = item[col];
        if (val instanceof Date) {
          cell.value = val;
          cell.numFmt = 'dd/mm/yyyy hh:mm';
        } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
          cell.value = new Date(val);
          cell.numFmt = 'dd/mm/yyyy hh:mm';
        } else {
          cell.value = val as ExcelJS.CellValue;
        }
      });
    });

    // auto-width columns
    columns.forEach((col, idx) => {
      const maxLen = Math.max(
        this.formatKey(col).length,
        ...result.items.slice(0, 100).map(r => String(r[col] ?? '').length),
      );
      dataSheet.getColumn(idx + 1).width = Math.min(Math.max(maxLen + 2, 10), 40);
    });

    // alternating row colors
    for (let i = 2; i <= result.items.length + 1; i++) {
      if (i % 2 === 0) {
        dataSheet.getRow(i).eachCell(c => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F0FF' } };
        });
      }
    }

    await this.sendExcel(wb, label, res);
  }

  private async sendExcel(wb: ExcelJS.Workbook, label: string, res: Response): Promise<void> {
    const filename = `herokids_${label.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  }

  private drawPdfHeaderRow(
    doc: PDFKit.PDFDocument,
    columns: string[],
    pageWidth: number,
    colWidth: number,
    headerY: number,
  ): void {
    doc.rect(40, headerY, pageWidth, 16).fill('#7C3AED');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');

    let x = 40;
    columns.forEach((col) => {
      doc.text(this.formatKey(col), x + 2, headerY + 4, { width: colWidth - 4, ellipsis: true, lineBreak: false });
      x += colWidth;
    });
  }

  private formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .replace(/Usd$/, '(USD)')
      .replace(/Inr$/, '(INR)')
      .replace(/Pct$/, '(%)')
      .trim();
  }
}
