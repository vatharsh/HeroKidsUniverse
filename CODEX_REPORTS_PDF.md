# CODEX TASK: Add PDF Export to Admin Reports

## Single-line prompt
Add PDF export to the admin reports system using `pdfkit`: install `pdfkit` + `@types/pdfkit` in `apps/api`, add a `exportPdf(reportType, filters, result, res)` method to `apps/api/src/reports/reports-export.service.ts`, and add a `GET /admin/reports/:reportType/export/pdf` endpoint in `apps/api/src/reports/reports.controller.ts`.

---

## Context

### What already exists

The reporting system is fully functional at `apps/api/src/reports/`:

- `reports.module.ts` – NestJS module
- `reports.service.ts` – All 11 report queries, returns `PagedResult<Record<string, unknown>>`
- `reports-export.service.ts` – Excel export using `exceljs` (already working)
- `reports.controller.ts` – GET + Excel export endpoints

The Excel export endpoint pattern to follow:

```typescript
// reports.controller.ts
@Get(':reportType/export/excel')
async exportExcel(
  @Param('reportType') reportType: string,
  @Res() res: Response,
  @Query('dateFrom') dateFrom?: string,
  // ... other query params
) {
  const filters: ReportFilters = { dateFrom, ... };
  const result = await this.reportsService.getReport(reportType, filters, true); // exportAll=true
  return this.exportService.exportExcel(reportType, filters, result, res);
}
```

### `PagedResult` interface (from reports.service.ts)

```typescript
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: Record<string, number | string>;
}
```

### `ReportFilters` interface (from reports.service.ts)

```typescript
export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  status?: string;
  userId?: string;
  universeId?: string;
  productId?: string;
  categoryId?: string;
  paymentMethod?: string;
  isSandbox?: boolean;
  page?: number;
  limit?: number;
}
```

---

## What to build

### 1. Install packages

```bash
cd apps/api && npm install pdfkit @types/pdfkit
```

### 2. Add `exportPdf` to `reports-export.service.ts`

```typescript
import PDFDocument from 'pdfkit';

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

  // Title & metadata
  doc.fontSize(16).font('Helvetica-Bold').text(`HeroKids Universe — ${label} Report`, { align: 'left' });
  doc.fontSize(9).font('Helvetica').fillColor('#666666');
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`);
  doc.text(`Date Range: ${filters.dateFrom ?? 'Start of Month'} — ${filters.dateTo ?? 'Today'}`);
  doc.text(`Mode: ${filters.isSandbox === true ? 'Sandbox' : filters.isSandbox === false ? 'Live' : 'All'}`);
  doc.text(`Total Records: ${result.total}`);
  doc.moveDown();

  // Summary section
  if (Object.keys(result.summary).length > 0) {
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('Summary', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');
    for (const [k, v] of Object.entries(result.summary)) {
      const key = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
      doc.fillColor('#333333').text(`${key}: `, { continued: true });
      doc.fillColor('#000000').text(String(v));
    }
    doc.moveDown();
  }

  // Table
  if (result.items.length > 0) {
    const columns = Object.keys(result.items[0]);
    const pageWidth = doc.page.width - 80; // margins
    const colWidth = Math.min(pageWidth / columns.length, 120);

    // Header row
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
    let x = 40;
    const headerY = doc.y;
    doc.rect(40, headerY, pageWidth, 16).fill('#7C3AED');
    columns.forEach(col => {
      const label = col.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
      doc.fillColor('#FFFFFF').text(label, x + 2, headerY + 4, { width: colWidth - 4, ellipsis: true, lineBreak: false });
      x += colWidth;
    });
    doc.y = headerY + 18;

    // Data rows
    doc.font('Helvetica').fontSize(7).fillColor('#333333');
    result.items.forEach((row, i) => {
      if (doc.y > doc.page.height - 60) {
        doc.addPage();
      }
      const rowY = doc.y;
      if (i % 2 === 0) {
        doc.rect(40, rowY, pageWidth, 14).fill('#F5F0FF');
      }
      let rx = 40;
      columns.forEach(col => {
        const val = row[col];
        let text = val === null || val === undefined ? '' : String(val);
        if (text.length > 20) text = text.substring(0, 17) + '…';
        doc.fillColor('#333333').text(text, rx + 2, rowY + 3, { width: colWidth - 4, lineBreak: false });
        rx += colWidth;
      });
      doc.y = rowY + 16;
    });
  }

  doc.end();
}
```

### 3. Add PDF endpoint to `reports.controller.ts`

```typescript
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
```

### 4. Update frontend PDF button in `apps/web/src/app/admin/reports/page.tsx`

Replace the `handlePrintPdf` function (currently uses `window.print()`) with a real PDF download:

```typescript
async function handlePdfExport() {
  const token = getAccessToken();
  const params = new URLSearchParams(buildQuery(1, true));
  const sandbox = sandboxFilter === "sandbox" ? "true" : sandboxFilter === "live" ? "false" : "";
  if (sandbox) params.set("sandbox", sandbox); else params.delete("sandbox");
  const url = `${BASE}/admin/reports/${activeReport}/export/pdf?${params.toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `herokids_${activeReport}_${Date.now()}.pdf`;
  a.click();
}
```

Then update the PDF button's `onClick` to call `handlePdfExport`.

---

## Acceptance criteria

- `npx tsc --noEmit` in `apps/api` passes cleanly.
- `GET /admin/reports/orders/export/pdf?sandbox=true` returns a valid PDF file.
- PDF includes: title, date range, mode, summary section, and a data table with column headers and rows.
- Long text values are truncated with ellipsis.
- PDF respects filters (same as Excel export).
- All column types (currency, date, badge) render as plain text values.
- Frontend PDF button triggers a real download (not browser print).
