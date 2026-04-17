import jsPDF from 'jspdf';
import type { Quote } from './types';

function fmt(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function generateQuotePDF(quote: Quote): void {
  const version = quote.activeVersion!;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 25;
  const contentW = pageW - margin * 2;
  let y = margin + 5;

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(30, 58, 95);
  doc.text('Constru Manager', margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  const today = new Date().toLocaleDateString('pt-BR');
  doc.text(`Orçamento gerado em ${today}`, margin, y);
  y += 2;

  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Client info ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 95);
  doc.text('Dados do Cliente', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40);

  const fields: [string, string][] = [
    ['Nome', quote.client.name],
    ['Orçamento', `#${quote.id.slice(-8).toUpperCase()} — Versão ${version.version}`],
    ['Data', new Date(quote.createdAt).toLocaleDateString('pt-BR')],
  ];

  for (const [label, value] of fields) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 30, y);
    y += 6;
  }
  y += 4;

  // ── Items table ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 95);
  doc.text('Itens do Orçamento', margin, y);
  y += 6;

  // Table header
  const colWidths = [contentW - 70, 20, 25, 25];
  const colX = [margin, margin + colWidths[0], margin + colWidths[0] + colWidths[1], margin + colWidths[0] + colWidths[1] + colWidths[2]];

  doc.setFillColor(30, 58, 95);
  doc.rect(margin, y - 4, contentW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255);
  doc.text('Item', colX[0] + 2, y);
  doc.text('Qtd', colX[1] + 2, y);
  doc.text('Unit.', colX[2] + 2, y);
  doc.text('Total', colX[3] + 2, y);
  y += 5;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  version.items.forEach((item, i) => {
    const itemName = item.product
      ? `${item.product.name}${item.product.unit ? ` (${item.product.unit})` : ''}`
      : item.kit?.name ?? '—';
    const label = item.kit ? `${itemName} [kit]` : itemName;

    if (i % 2 === 1) {
      doc.setFillColor(247, 249, 252);
      doc.rect(margin, y - 4, contentW, 7, 'F');
    }
    doc.setTextColor(40);
    doc.text(doc.splitTextToSize(label, colWidths[0] - 4)[0], colX[0] + 2, y);
    doc.text(String(item.quantity), colX[1] + 2, y);
    doc.text(fmt(item.unitPrice), colX[2] + 2, y);
    doc.text(fmt(item.lineTotal), colX[3] + 2, y);

    doc.setDrawColor(230);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 3, pageW - margin, y + 3);
    y += 7;
  });

  y += 4;

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalsX = pageW - margin - 80;
  const valX = pageW - margin;

  function totalsRow(label: string, value: string, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 9);
    doc.setTextColor(bold ? 30 : 80, bold ? 58 : 80, bold ? 95 : 80);
    doc.text(label, totalsX, y);
    doc.text(value, valX, y, { align: 'right' });
    y += bold ? 0 : 5;
  }

  totalsRow('Subtotal:', fmt(version.subtotal));
  if (version.laborCost > 0) totalsRow('Mão de obra:', `+ ${fmt(version.laborCost)}`);
  if (version.discount > 0) totalsRow('Desconto:', `- ${fmt(version.discount)}`);

  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.4);
  doc.line(totalsX, y, valX, y);
  y += 5;
  totalsRow('TOTAL', fmt(version.total), true);

  // ── Footer ──────────────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160);
  doc.setDrawColor(220);
  doc.setLineWidth(0.2);
  doc.line(margin, pageH - 18, pageW - margin, pageH - 18);
  doc.text(`Constru Manager · Documento gerado automaticamente em ${today}`, pageW / 2, pageH - 13, { align: 'center' });

  // ── Save ────────────────────────────────────────────────────────────────────
  const clientSlug = quote.client.name.replace(/\s+/g, '-').toLowerCase();
  doc.save(`orcamento-${clientSlug}-v${version.version}.pdf`);
}
