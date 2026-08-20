import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

export interface BusinessResumeExportData {
  summary: {
    totalSales: number;
    totalPurchases: number;
    totalExpenses: number;
    netProfit: number;
  };
}

export interface PdfProps {
  imageUrl: string;
  businessName: string;
  businessDescription: string;
  startDate: string;
  endDate: string;
  expiringSoonCount: number;
  lowRotationCount: number;
  outOfStockCount: number;
  lowStockCount: number;
  monthlyResult: number;
  totalSales: number;
  costOfSales: number;
  totalExpenses: number;
  stockExpenses: number;
  operatingExpenses: number;
}

@Injectable()
export class ReportsExportService {
  private readonly fonts = {
    Roboto: {
      normal: path.join(__dirname, 'fonts/Roboto-Regular.ttf'),
      bold: path.join(__dirname, 'fonts/Roboto-Medium.ttf'),
      italics: path.join(__dirname, 'fonts/Roboto-Italic.ttf'),
      bolditalics: path.join(__dirname, 'fonts/Roboto-MediumItalic.ttf'),
    },
  };

  async generateResumeExcel(data: PdfProps): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Resumen de Negocio');

    // Configuración general de la hoja
    sheet.views = [{ showGridLines: true }];

    // Definición de Anchos de Columna
    sheet.columns = [
      { key: 'A', width: 5 },
      { key: 'B', width: 42 },
      { key: 'C', width: 22 },
      { key: 'D', width: 16 },
      { key: 'E', width: 5 },
    ];

    const currencyFormat = '"$"#,##0.00;[Red]-"$"#,##0.00';
    const percentFormat = '0.0%';

    // Estilos reutilizables
    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };
    const tableHeaderFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    const cardFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' },
    };

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };

    // 1. ENCABEZADO DE LA EMPRESA
    sheet.mergeCells('B2:D2');
    const titleCell = sheet.getCell('B2');
    titleCell.value = data.businessName.toUpperCase();
    titleCell.font = {
      name: 'Arial',
      size: 16,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    titleCell.fill = headerFill;
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    sheet.mergeCells('B3:D3');
    const subtitleCell = sheet.getCell('B3');
    subtitleCell.value = `${data.businessDescription} | Período: ${data.startDate} - ${data.endDate}`;
    subtitleCell.font = {
      name: 'Arial',
      size: 9,
      italic: true,
      color: { argb: 'FF94A3B8' },
    };
    subtitleCell.fill = headerFill;
    subtitleCell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      indent: 1,
    };
    sheet.getRow(2).height = 28;
    sheet.getRow(3).height = 18;

    // 2. BLOQUE DE KPIS (TARJETAS)
    sheet.getRow(5).height = 16;
    sheet.getRow(6).height = 22;

    const kpiItems = [
      { col: 'B', label: 'STOCK BAJO', val: data.lowStockCount, fmt: '#,##0' },
      { col: 'C', label: 'SIN STOCK', val: data.outOfStockCount, fmt: '#,##0' },
      {
        col: 'D',
        label: 'PRÓXIMOS A VENCER',
        val: data.expiringSoonCount,
        fmt: '#,##0',
      },
    ];

    kpiItems.forEach((kpi) => {
      const lblCell = sheet.getCell(`${kpi.col}5`);
      lblCell.value = kpi.label;
      lblCell.font = {
        name: 'Arial',
        size: 7,
        bold: true,
        color: { argb: 'FF64748B' },
      };
      lblCell.fill = cardFill;
      lblCell.alignment = { horizontal: 'center', vertical: 'middle' };
      lblCell.border = {
        top: thinBorder.top,
        left: thinBorder.left,
        right: thinBorder.right,
      };

      const valCell = sheet.getCell(`${kpi.col}6`);
      valCell.value = kpi.val;
      valCell.font = {
        name: 'Arial',
        size: 12,
        bold: true,
        color: { argb: 'FF0F172A' },
      };
      valCell.fill = cardFill;
      valCell.alignment = { horizontal: 'center', vertical: 'middle' };
      valCell.numFmt = kpi.fmt;
      valCell.border = {
        bottom: thinBorder.bottom,
        left: thinBorder.left,
        right: thinBorder.right,
      };
    });

    // Helper para armar tablas homogéneas
    let currentRow = 8;

    const buildTable = (
      title: string,
      headers: [string, string, string],
      rows: [string, number, number][],
      footerLabel: string,
      footerValue: number,
    ) => {
      // Título de Sección
      sheet.mergeCells(`B${currentRow}:D${currentRow}`);
      const sectionCell = sheet.getCell(`B${currentRow}`);
      sectionCell.value = title;
      sectionCell.font = {
        name: 'Arial',
        size: 10,
        bold: true,
        color: { argb: 'FF0F172A' },
      };
      sectionCell.fill = tableHeaderFill;
      sectionCell.border = thinBorder;
      sheet.getRow(currentRow).height = 22;
      currentRow++;

      // Encabezados de Columna
      const cols = ['B', 'C', 'D'];
      headers.forEach((h, i) => {
        const c = sheet.getCell(`${cols[i]}${currentRow}`);
        c.value = h;
        c.font = {
          name: 'Arial',
          size: 8,
          bold: true,
          color: { argb: 'FF475569' },
        };
        c.alignment = {
          horizontal: i === 0 ? 'left' : 'right',
          vertical: 'middle',
        };
        c.border = thinBorder;
      });
      sheet.getRow(currentRow).height = 18;
      currentRow++;

      // Filas de Datos
      rows.forEach(([concept, amount, pct]) => {
        const cConcept = sheet.getCell(`B${currentRow}`);
        const cAmount = sheet.getCell(`C${currentRow}`);
        const cPct = sheet.getCell(`D${currentRow}`);

        cConcept.value = concept;
        cAmount.value = amount;
        cPct.value = pct;

        cConcept.font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
        cAmount.font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
        cPct.font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };

        cAmount.numFmt = currencyFormat;
        cPct.numFmt = percentFormat;

        cConcept.alignment = { horizontal: 'left', vertical: 'middle' };
        cAmount.alignment = { horizontal: 'right', vertical: 'middle' };
        cPct.alignment = { horizontal: 'right', vertical: 'middle' };

        cConcept.border = thinBorder;
        cAmount.border = thinBorder;
        cPct.border = thinBorder;

        sheet.getRow(currentRow).height = 18;
        currentRow++;
      });

      // Pie de Tabla / Total
      const fConcept = sheet.getCell(`B${currentRow}`);
      const fAmount = sheet.getCell(`C${currentRow}`);
      const fPct = sheet.getCell(`D${currentRow}`);

      fConcept.value = footerLabel;
      fAmount.value = footerValue;
      fPct.value = '-';

      const isNegative = footerValue < 0;
      const footerColor = isNegative ? 'FFB91C1C' : 'FF1E3A8A';
      const footerBg = isNegative ? 'FFFEE2E2' : 'FFEFF6FF';

      const footerFillStyle: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: footerBg },
      };

      [fConcept, fAmount, fPct].forEach((c) => {
        c.font = {
          name: 'Arial',
          size: 9,
          bold: true,
          color: { argb: footerColor },
        };
        c.fill = footerFillStyle;
        c.border = thinBorder;
      });

      fAmount.numFmt = currencyFormat;
      fConcept.alignment = { horizontal: 'left', vertical: 'middle' };
      fAmount.alignment = { horizontal: 'right', vertical: 'middle' };
      fPct.alignment = { horizontal: 'center', vertical: 'middle' };

      sheet.getRow(currentRow).height = 20;
      currentRow += 2; // Espaciado con la siguiente tabla
    };

    // 3. TABLA 1: ESTADO DE RESULTADOS (RENTABILIDAD CONTABLE)
    const grossProfit = data.totalSales - data.costOfSales;
    const netAccountingProfit = grossProfit - data.operatingExpenses;
    const totalVolumeAcc =
      data.totalSales + data.costOfSales + data.operatingExpenses || 1;

    buildTable(
      'ESTADO DE RESULTADOS (RENTABILIDAD CONTABLE)',
      ['Concepto', 'Monto', 'Porcentaje'],
      [
        ['Ventas Totales', data.totalSales, data.totalSales / totalVolumeAcc],
        [
          'Costo de Ventas (COGS)',
          data.costOfSales,
          data.costOfSales / totalVolumeAcc,
        ],
        [
          'Gastos Operativos',
          data.operatingExpenses,
          data.operatingExpenses / totalVolumeAcc,
        ],
      ],
      'GANANCIA NETA CONTABLE',
      netAccountingProfit,
    );

    // 4. TABLA 2: DISTRIBUCIÓN DE EGRESOS (SALIDAS DE DINERO)
    const totalOutflows = data.stockExpenses + data.operatingExpenses || 1;

    buildTable(
      'DISTRIBUCIÓN DE EGRESOS (SALIDAS DE DINERO)',
      ['Categoría', 'Monto', 'Porcentaje'],
      [
        [
          'Compras de Stock (Inversión en Inventario)',
          data.stockExpenses,
          data.stockExpenses / totalOutflows,
        ],
        [
          'Gastos Operativos (Egresos Fijos/Variables)',
          data.operatingExpenses,
          data.operatingExpenses / totalOutflows,
        ],
      ],
      'TOTAL EGRESOS DE CAJA',
      data.stockExpenses + data.operatingExpenses,
    );

    // 5. TABLA 3: FLUJO DE CAJA NETO (DINERO REAL)
    const totalCashOut = data.stockExpenses + data.operatingExpenses;
    const netCashFlow = data.totalSales - totalCashOut;
    const totalCashVolume = data.totalSales + totalCashOut || 1;

    buildTable(
      'FLUJO DE CAJA (DINERO EN BOLSILLO)',
      ['Movimiento de Caja', 'Monto', 'Porcentaje'],
      [
        [
          'Ingresos de Caja (Ventas)',
          data.totalSales,
          data.totalSales / totalCashVolume,
        ],
        [
          'Salidas de Caja (Stock + Gastos Operativos)',
          totalCashOut,
          totalCashOut / totalCashVolume,
        ],
      ],
      'RESULTADO NETO DE CAJA',
      netCashFlow,
    );

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async generatePdf(data: PdfProps): Promise<PDFKit.PDFDocument> {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    // 1. Download logo and render with rounded corners
    try {
      const imageBuffer = await this.fetchImageBuffer(data.imageUrl);
      const imgX = 40;
      const imgY = 40;
      const imgSize = 45;
      const radius = 8;

      doc.save();
      doc.roundedRect(imgX, imgY, imgSize, imgSize, radius).clip();
      doc.image(imageBuffer, imgX, imgY, { width: imgSize, height: imgSize });
      doc.restore();
    } catch (error) {
      console.error('Error loading image from URL:', error);
      doc.fontSize(8).text('[Logo]', 40, 55);
    }

    // 2. Header and subtitles
    doc
      .fillColor('#0f172a')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(data.businessName, 95, 42);

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#64748b')
      .text(data.businessDescription, 95, 65);

    doc
      .fillColor('#0f172a')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('Reporte del negocio', 320, 42);

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#64748b')
      .text(`${data.startDate} - ${data.endDate}`, 320, 65);

    // Top separator line
    doc
      .moveTo(40, 95)
      .lineTo(555, 95)
      .strokeColor('#cbd5e1')
      .lineWidth(1)
      .stroke();

    // 3. KPI Cards
    const drawCard = (
      x: number,
      y: number,
      width: number,
      height: number,
      title: string,
      value: string,
      valueColor: string,
    ) => {
      doc
        .roundedRect(x, y, width, height, 6)
        .fillAndStroke('#f8fafc', '#e2e8f0');

      doc
        .fillColor('#64748b')
        .fontSize(7)
        .font('Helvetica-Bold')
        .text(title.toUpperCase(), x + 8, y + 10, { width: width - 16 });

      doc
        .fillColor(valueColor)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(value, x + 8, y + 32, { width: width - 16 });
    };

    const cardY = 105;
    const cardWidth = 93;
    const cardGap = 12;
    const cardHeight = 60;
    const startX = 40;

    drawCard(
      startX,
      cardY,
      cardWidth,
      cardHeight,
      'Stock bajo',
      `${data.lowStockCount}`,
      '#eab308',
    );
    drawCard(
      startX + (cardWidth + cardGap),
      cardY,
      cardWidth,
      cardHeight,
      'Sin stock',
      `${data.outOfStockCount}`,
      '#f63b3b',
    );
    drawCard(
      startX + (cardWidth + cardGap) * 2,
      cardY,
      cardWidth,
      cardHeight,
      'Próximos a vencer',
      `${data.expiringSoonCount}`,
      '#3b82f6',
    );
    drawCard(
      startX + (cardWidth + cardGap) * 3,
      cardY,
      cardWidth,
      cardHeight,
      'Poca rotación',
      `${data.lowRotationCount}`,
      '#3b82f6',
    );
    drawCard(
      startX + (cardWidth + cardGap) * 4,
      cardY,
      cardWidth,
      cardHeight,
      'Resultado del mes',
      this.formatCurrency(data.monthlyResult),
      data.monthlyResult < 0 ? '#b91010' : '#10b93a',
    );

    // 4. Tables Setup
    const fullTableWidth = 515;
    const columnWidths = [250, 140, 100];

    // ==========================================
    // TABLA 1: RESUMEN FINANCIERO (RENTABILIDAD)
    // ==========================================
    const accountingExpenses = data.operatingExpenses || data.totalExpenses;
    const accountingProfit =
      data.totalSales - data.costOfSales - accountingExpenses;
    const isAccountingLoss = accountingProfit < 0;

    const volumeAccounting =
      data.totalSales + data.costOfSales + accountingExpenses;
    const salesPctAcc = this.calculatePercentage(
      data.totalSales,
      volumeAccounting,
    );
    const costPctAcc = this.calculatePercentage(
      data.costOfSales,
      volumeAccounting,
    );
    const expPctAcc = this.calculatePercentage(
      accountingExpenses,
      volumeAccounting,
    );

    const tableOneY = 178;
    const tableOneHeight = this.drawCustomTable(doc, {
      x: 40,
      y: tableOneY,
      width: fullTableWidth,
      title: 'ESTADO DE RESULTADOS (RENTABILIDAD CONTABLE)',
      headers: ['Concepto', 'Monto', 'Porcentaje'],
      colWidths: columnWidths,
      rows: [
        ['Ventas Totales', this.formatCurrency(data.totalSales), salesPctAcc],
        [
          'Costo de Ventas (COGS)',
          this.formatCurrency(data.costOfSales),
          costPctAcc,
        ],
        [
          'Gastos Operativos',
          this.formatCurrency(accountingExpenses),
          expPctAcc,
        ],
      ],
      footer: [
        'GANANCIA NETA CONTABLE',
        this.formatCurrency(accountingProfit),
        '-',
      ],
      footerStyle: isAccountingLoss ? 'red' : 'blue',
    });

    // ==========================================
    // TABLA 2: DISTRIBUCIÓN DE EGRESOS DE CAJA
    // ==========================================
    const totalOutflows = data.stockExpenses + data.operatingExpenses;
    const baseExpenses = totalOutflows || data.totalExpenses;

    const stockExpPct = this.calculatePercentage(
      data.stockExpenses,
      baseExpenses,
    );
    const operatingExpPct = this.calculatePercentage(
      data.operatingExpenses,
      baseExpenses,
    );

    const tableTwoY = tableOneY + tableOneHeight + 12;
    const tableTwoHeight = this.drawCustomTable(doc, {
      x: 40,
      y: tableTwoY,
      width: fullTableWidth,
      title: 'DISTRIBUCIÓN DE EGRESOS (SALIDAS DE DINERO)',
      headers: ['Categoría', 'Monto', 'Porcentaje'],
      colWidths: columnWidths,
      rows: [
        [
          'Compras de Stock (Inversión en Inventario)',
          this.formatCurrency(data.stockExpenses),
          stockExpPct,
        ],
        [
          'Gastos Operativos (Egresos Fijos/Variables)',
          this.formatCurrency(data.operatingExpenses),
          operatingExpPct,
        ],
      ],
      footer: [
        'TOTAL EGRESOS DE CAJA',
        this.formatCurrency(baseExpenses),
        '100%',
      ],
      footerStyle: 'blue',
    });

    // ==========================================
    // TABLA 3: FLUJO DE CAJA NETO (DINERO REAL)
    // ==========================================
    const netCashFlow = data.totalSales - baseExpenses;
    const isCashLoss = netCashFlow < 0;

    const cashVolume = data.totalSales + baseExpenses;
    const cashInPct = this.calculatePercentage(data.totalSales, cashVolume);
    const cashOutPct = this.calculatePercentage(baseExpenses, cashVolume);

    const tableThreeY = tableTwoY + tableTwoHeight + 12;
    const tableThreeHeight = this.drawCustomTable(doc, {
      x: 40,
      y: tableThreeY,
      width: fullTableWidth,
      title: 'FLUJO DE CAJA (DINERO EN BOLSILLO)',
      headers: ['Movimiento de Caja', 'Monto', 'Porcentaje'],
      colWidths: columnWidths,
      rows: [
        [
          'Ingresos de Caja (Ventas)',
          this.formatCurrency(data.totalSales),
          cashInPct,
        ],
        [
          'Salidas de Caja (Stock + Gastos Operativos)',
          this.formatCurrency(baseExpenses),
          cashOutPct,
        ],
      ],
      footer: ['RESULTADO NETO DE CAJA', this.formatCurrency(netCashFlow), '-'],
      footerStyle: isCashLoss ? 'red' : 'blue',
    });

    // 5. Institutional Footer
    const footerY = tableThreeY + tableThreeHeight + 15;
    const footerWidth = 515;
    const footerHeight = 40;

    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const formattedTime = currentDate.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const generationText = `Reporte generado el ${formattedDate} a las ${formattedTime} hs.`;

    doc
      .roundedRect(40, footerY, footerWidth, footerHeight, 6)
      .fillAndStroke('#f8fafc', '#cbd5e1');

    const circleX = 55;
    const circleY = footerY + footerHeight / 2;
    doc.circle(circleX, circleY, 8).fill('#1e40af');

    doc
      .fillColor('#ffffff')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('i', circleX - 2, circleY - 5);

    doc
      .fillColor('#1e3a8a')
      .fontSize(7)
      .font('Helvetica-Bold')
      .text(
        'Los datos presentados corresponden al período seleccionado.',
        75,
        footerY + 9,
      );

    doc
      .fillColor('#475569')
      .fontSize(7)
      .font('Helvetica')
      .text(
        'Para más detalles, consulta el sistema de gestión.',
        75,
        footerY + 20,
      );

    doc
      .fillColor('#334155')
      .fontSize(7)
      .font('Helvetica')
      .text(generationText, 40, footerY + 15, {
        width: footerWidth - 15,
        align: 'right',
      });

    doc.end();
    return doc;
  }

  private calculatePercentage(value: number, total: number): string {
    if (!total || total === 0) return '0%';
    const percentage = Math.round((value / total) * 100);
    return `${percentage}%`;
  }

  private formatCurrency(amount: number): string {
    const formatted = Math.abs(amount).toLocaleString('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return amount < 0 ? `-$ ${formatted}` : `$ ${formatted}`;
  }

  private drawCustomTable(
    doc: PDFKit.PDFDocument,
    config: {
      x: number;
      y: number;
      width: number;
      title: string;
      headers: string[];
      colWidths: number[];
      rows: string[][];
      footer: string[];
      footerStyle: 'blue' | 'red';
    },
  ): number {
    const {
      x,
      y,
      width,
      title,
      headers,
      colWidths,
      rows,
      footer,
      footerStyle,
    } = config;
    const headerHeight = 22;
    const rowHeight = 20;
    const totalRows = rows.length + 1;
    const totalHeight = headerHeight + totalRows * rowHeight + 25;

    doc
      .roundedRect(x, y, width, totalHeight, 6)
      .fillAndStroke('#ffffff', '#cbd5e1');

    doc.roundedRect(x, y, width, 25, 6).fill('#f8fafc');
    doc.rect(x, y + 15, width, 10).fill('#f8fafc');

    doc
      .fillColor('#0f172a')
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(title, x + 10, y + 8);

    doc
      .moveTo(x, y + 25)
      .lineTo(x + width, y + 25)
      .strokeColor('#cbd5e1')
      .lineWidth(0.5)
      .stroke();

    let currentY = y + 29;
    doc.fillColor('#0f172a').fontSize(7).font('Helvetica-Bold');

    let currentX = x + 8;
    headers.forEach((header, i) => {
      doc.text(header, currentX, currentY, {
        width: colWidths[i],
        align: i > 0 ? 'right' : 'left',
      });
      currentX += colWidths[i];
    });

    currentY += 15;
    doc
      .moveTo(x, currentY - 4)
      .lineTo(x + width, currentY - 4)
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .stroke();

    doc.font('Helvetica').fontSize(7);
    rows.forEach((row) => {
      currentX = x + 8;
      doc.fillColor('#334155');

      row.forEach((cell, cellIndex) => {
        doc.text(cell, currentX, currentY, {
          width: colWidths[cellIndex],
          align: cellIndex > 0 ? 'right' : 'left',
        });
        currentX += colWidths[cellIndex];
      });

      currentY += rowHeight;
      doc
        .moveTo(x, currentY - 4)
        .lineTo(x + width, currentY - 4)
        .strokeColor('#f1f5f9')
        .lineWidth(0.5)
        .stroke();
    });

    const footerBg = footerStyle === 'red' ? '#fee2e2' : '#eff6ff';
    const footerTextColor = footerStyle === 'red' ? '#b91c1c' : '#1e3a8a';

    doc.rect(x + 0.5, currentY - 6, width - 1, rowHeight + 2).fill(footerBg);

    currentX = x + 8;
    doc.font('Helvetica-Bold').fontSize(7).fillColor(footerTextColor);

    footer.forEach((cell, cellIndex) => {
      doc.text(cell, currentX, currentY, {
        width: colWidths[cellIndex],
        align: cellIndex > 0 ? 'right' : 'left',
      });
      currentX += colWidths[cellIndex];
    });

    return totalHeight;
  }

  private async fetchImageBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
