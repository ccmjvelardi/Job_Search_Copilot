import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import type { StructuredResume } from "@/types/resume";

function contactLine(structured: StructuredResume): string {
  const c = structured.contact;
  if (!c) return "";
  return [c.email, c.phone, c.location, ...(c.links ?? [])].filter(Boolean).join(" | ");
}

function educationLine(edu: { credential: string; field?: string | null }): string {
  const field = edu.field?.trim();
  const credentialIncludesField = field && edu.credential.toLowerCase().includes(field.toLowerCase());
  return [edu.credential, credentialIncludesField ? null : field].filter(Boolean).join(", ");
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24 })],
    spacing: { before: 200, after: 100 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999", space: 1 },
    },
  });
}

export async function buildResumeDocx(structured: StructuredResume): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      children: [new TextRun({ text: structured.fullName ?? "Resume", bold: true, size: 32 })],
      spacing: { after: 80 },
    }),
  );

  const contact = contactLine(structured);
  if (contact) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: contact, size: 20 })],
        spacing: { after: 200 },
      }),
    );
  }

  if (structured.summary) {
    children.push(sectionHeading("SUMMARY"));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: structured.summary, size: 21 })],
        spacing: { after: 200 },
      }),
    );
  }

  if (structured.workHistory?.length) {
    children.push(sectionHeading("EXPERIENCE"));
    for (const job of structured.workHistory) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${job.title}, ${job.company}`, bold: true, size: 22 })],
          spacing: { before: 160, after: 20 },
        }),
      );
      const dateLoc = [`${job.startDate} - ${job.endDate}`, job.location].filter(Boolean).join(" | ");
      children.push(
        new Paragraph({
          children: [new TextRun({ text: dateLoc, italics: true, size: 20 })],
          spacing: { after: 60 },
        }),
      );
      for (const bullet of job.bullets ?? []) {
        children.push(
          new Paragraph({
            numbering: { reference: "bullets", level: 0 },
            children: [new TextRun({ text: bullet, size: 21 })],
          }),
        );
      }
    }
  }

  if (structured.skills?.length) {
    children.push(sectionHeading("SKILLS"));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: structured.skills.join(", "), size: 21 })],
        spacing: { after: 200 },
      }),
    );
  }

  if (structured.education?.length) {
    children.push(sectionHeading("EDUCATION"));
    for (const edu of structured.education) {
      const line = educationLine(edu);
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${line ? line + ", " : ""}${edu.institution}`, size: 21 }),
          ],
        }),
      );
      if (edu.graduationDate) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: edu.graduationDate, italics: true, size: 20 })],
            spacing: { after: 120 },
          }),
        );
      }
    }
  }

  if (structured.awards?.length) {
    children.push(sectionHeading("AWARDS"));
    for (const award of structured.awards) {
      children.push(
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun({ text: award, size: 21 })],
        }),
      );
    }
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

interface DrawLineOptions {
  size?: number;
  bold?: boolean;
  italic?: boolean;
  indent?: number;
  gapAfter?: number;
}

export async function buildResumePdf(structured: StructuredResume): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 54;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function pickFont(bold?: boolean, italic?: boolean): PDFFont {
    if (bold) return boldFont;
    if (italic) return italicFont;
    return font;
  }

  function wrapText(text: string, useFont: PDFFont, size: number, availableWidth: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (useFont.widthOfTextAtSize(test, size) > availableWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function drawLine(text: string, options: DrawLineOptions = {}) {
    const { size = 10, bold = false, italic = false, indent = 0, gapAfter = 4 } = options;
    const useFont = pickFont(bold, italic);
    const availableWidth = pageWidth - margin * 2 - indent;
    const lines = wrapText(text, useFont, size, availableWidth);
    for (const line of lines) {
      if (y - size < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin + indent, y, size, font: useFont, color: rgb(0, 0, 0) });
      y -= size + 4;
    }
    y -= gapAfter;
  }

  function drawSectionHeading(text: string) {
    if (y - 24 < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    y -= 6;
    drawLine(text, { size: 12, bold: true, gapAfter: 2 });
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });
    y -= 8;
  }

  drawLine(structured.fullName ?? "Resume", { size: 18, bold: true, gapAfter: 2 });
  const contact = contactLine(structured);
  if (contact) drawLine(contact, { size: 10, gapAfter: 10 });

  if (structured.summary) {
    drawSectionHeading("SUMMARY");
    drawLine(structured.summary, { size: 10, gapAfter: 10 });
  }

  if (structured.workHistory?.length) {
    drawSectionHeading("EXPERIENCE");
    for (const job of structured.workHistory) {
      drawLine(`${job.title}, ${job.company}`, { size: 11, bold: true, gapAfter: 1 });
      const dateLoc = [`${job.startDate} - ${job.endDate}`, job.location].filter(Boolean).join(" | ");
      drawLine(dateLoc, { size: 9, italic: true, gapAfter: 3 });
      for (const bullet of job.bullets ?? []) {
        drawLine(`•  ${bullet}`, { size: 10, indent: 10, gapAfter: 2 });
      }
      y -= 6;
    }
  }

  if (structured.skills?.length) {
    drawSectionHeading("SKILLS");
    drawLine(structured.skills.join(", "), { size: 10, gapAfter: 10 });
  }

  if (structured.education?.length) {
    drawSectionHeading("EDUCATION");
    for (const edu of structured.education) {
      const line = educationLine(edu);
      drawLine(`${line ? line + ", " : ""}${edu.institution}`, { size: 10, gapAfter: 1 });
      if (edu.graduationDate) drawLine(edu.graduationDate, { size: 9, italic: true, gapAfter: 6 });
    }
  }

  if (structured.awards?.length) {
    drawSectionHeading("AWARDS");
    for (const award of structured.awards) {
      drawLine(`•  ${award}`, { size: 10, indent: 10, gapAfter: 2 });
    }
  }

  return pdfDoc.save();
}
