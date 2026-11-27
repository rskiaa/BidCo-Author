import { Document, HeadingLevel, Packer, Paragraph, TextRun, BorderStyle } from 'docx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface ExportPayload {
  title: string;
  tenderTitle: string;
  tenderReference: string;
  authority: string;
  organizationName: string;
  version: number;
  sections: Array<{ heading: string; content: string }>;
}

export async function generateProposalDocx(payload: ExportPayload): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      text: payload.title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 140 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Tender Reference: `, bold: true }),
        new TextRun(payload.tenderReference || 'N/A'),
        new TextRun({ text: `   |   Authority: `, bold: true }),
        new TextRun(payload.authority || 'N/A'),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Submitted By: `, bold: true }),
        new TextRun(payload.organizationName || 'Registered Organization'),
        new TextRun({ text: `   |   Draft Version: `, bold: true }),
        new TextRun(`v${payload.version}`),
      ],
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
      },
      spacing: { after: 280 },
    }),
  ];

  for (const section of payload.sections) {
    children.push(
      new Paragraph({
        text: section.heading,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      }),
    );

    const paragraphs = section.content.split(/\n{2,}/);
    for (const para of paragraphs) {
      const clean = para.trim();
      if (!clean) continue;
      children.push(
        new Paragraph({
          text: clean,
          spacing: { after: 120 },
        }),
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.replace(/\r/g, '').split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateProposalPdf(payload: ExportPayload): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 48;
  const minY = 56;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 54;

  const ensureSpace = (needed: number) => {
    if (y - needed < minY) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 54;
    }
  };

  // Header Block
  for (const titleLine of wrapLines(payload.title, 62)) {
    ensureSpace(20);
    page.drawText(titleLine, {
      x: marginX,
      y,
      size: 15,
      font: bold,
      color: rgb(0.13, 0.13, 0.14),
    });
    y -= 20;
  }

  y -= 4;
  page.drawText(
    `Tender Ref: ${payload.tenderReference || 'N/A'}  |  Version: v${payload.version}`,
    { x: marginX, y, size: 9, font, color: rgb(0.37, 0.39, 0.41) },
  );
  y -= 14;
  page.drawText(
    `Authority: ${payload.authority || 'N/A'}  |  Bidder: ${payload.organizationName || 'Organization'}`,
    { x: marginX, y, size: 9, font, color: rgb(0.37, 0.39, 0.41) },
  );
  y -= 14;

  page.drawLine({
    start: { x: marginX, y },
    end: { x: pageWidth - marginX, y },
    thickness: 0.75,
    color: rgb(0.85, 0.86, 0.88),
  });
  y -= 24;

  for (const section of payload.sections) {
    ensureSpace(34);
    for (const hLine of wrapLines(section.heading, 72)) {
      ensureSpace(18);
      page.drawText(hLine, {
        x: marginX,
        y,
        size: 12,
        font: bold,
        color: rgb(0.1, 0.45, 0.91),
      });
      y -= 17;
    }
    y -= 4;

    const blocks = section.content.split(/\n+/);
    for (const block of blocks) {
      const clean = block.trim();
      if (!clean) {
        y -= 8;
        continue;
      }
      const wrapped = wrapLines(clean, 86);
      for (const line of wrapped) {
        ensureSpace(15);
        // Strip non-WinAnsi characters safely for Helvetica standard font
        const safeLine = line.replace(/[^\x20-\x7E]/g, ' ');
        page.drawText(safeLine, {
          x: marginX,
          y,
          size: 10,
          font,
          color: rgb(0.14, 0.18, 0.26),
        });
        y -= 14;
      }
      y -= 5;
    }
    y -= 10;
  }

  return pdfDoc.save();
}
