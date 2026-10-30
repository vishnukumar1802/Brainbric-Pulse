// Brainbric corporate document generator: turns a JSON spec into a branded Word document.
// Used by the Business Analyst agent for SRS, project plans, progress, test and final reports.
//
//   node brainbric-doc.mjs spec.json out.docx
//
// Spec: { doc_type, title, project, client, version, date, status, prepared_by, reviewed_by, approved_by,
//         confidentiality, history: [{version, date, author, changes}], sections: [Section] }
// Section: { heading, level (1|2|3, default 1), blocks: [Block] }
// Block: {type:"p", text} | {type:"bullets", items} | {type:"numbered", items} | {type:"note", text}
//        | {type:"table", columns, rows, widths?} | {type:"image", path, width?, caption?} | {type:"kv", rows: [[label, value]]}
// Inline **bold** is supported in any text.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, LevelFormat, Packer, PageBreak,
  PageNumber, Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow, TextRun, WidthType,
} from 'docx';

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , specPath, outPath] = process.argv;
if (!specPath || !outPath) {
  console.error('Usage: node brainbric-doc.mjs spec.json out.docx');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const logoPath = [path.join(here, 'brainbric-logo.png'), path.join(here, '../../public/brainbric-logo.png')].find((p) => fs.existsSync(p));
const logo = logoPath ? fs.readFileSync(logoPath) : null;

const BRAND = 'E8571E';
const INK = '1D1A1E';
const MUTED = '6B6670';
const RULE = 'E6E1DC';
const TINT = 'FFF3EC';
const FONT = 'Calibri';
const PAGE_W = 11906; // A4
const MARGIN = 1300;
const BODY_W = PAGE_W - 2 * MARGIN;

/** Text with **bold** spans. */
function runs(text, opts = {}) {
  return String(text ?? '')
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) => (part.startsWith('**') && part.endsWith('**') ? new TextRun({ ...opts, text: part.slice(2, -2), bold: true }) : new TextRun({ ...opts, text: part })));
}

const p = (text, opts = {}) => new Paragraph({ spacing: { after: 120, line: 300 }, ...opts, children: runs(text) });
const border = { style: BorderStyle.SINGLE, size: 4, color: RULE };
const cellBorders = { top: border, bottom: border, left: border, right: border };

function table(columns, rows, widths) {
  const n = columns.length;
  const w = widths && widths.length === n ? widths : Array(n).fill(1);
  const total = w.reduce((a, b) => a + b, 0);
  const cols = w.map((x) => Math.round((x / total) * BODY_W));
  cols[n - 1] += BODY_W - cols.reduce((a, b) => a + b, 0);
  const cell = (text, i, head) =>
    new TableCell({
      width: { size: cols[i], type: WidthType.DXA },
      borders: cellBorders,
      shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: BRAND } : undefined,
      margins: { top: 80, bottom: 80, left: 110, right: 110 },
      children: String(text ?? '')
        .split('\n')
        .map((line) => new Paragraph({ spacing: { after: 40 }, children: runs(line, head ? { bold: true, color: 'FFFFFF', size: 19 } : { size: 19, color: INK }) })),
    });
  return new Table({
    width: { size: BODY_W, type: WidthType.DXA },
    columnWidths: cols,
    rows: [
      new TableRow({ tableHeader: true, children: columns.map((c, i) => cell(c, i, true)) }),
      ...rows.map((r) => new TableRow({ children: columns.map((_, i) => cell(r[i], i, false)) })),
    ],
  });
}

function kv(rows) {
  const cols = [Math.round(BODY_W * 0.3), BODY_W - Math.round(BODY_W * 0.3)];
  return new Table({
    width: { size: BODY_W, type: WidthType.DXA },
    columnWidths: cols,
    rows: rows.map(([k, v]) =>
      new TableRow({
        children: [
          new TableCell({ width: { size: cols[0], type: WidthType.DXA }, borders: cellBorders, shading: { type: ShadingType.CLEAR, color: 'auto', fill: TINT }, margins: { top: 80, bottom: 80, left: 110, right: 110 }, children: [new Paragraph({ children: runs(k, { bold: true, size: 19 }) })] }),
          new TableCell({ width: { size: cols[1], type: WidthType.DXA }, borders: cellBorders, margins: { top: 80, bottom: 80, left: 110, right: 110 }, children: [new Paragraph({ children: runs(v, { size: 19 }) })] }),
        ],
      }),
    ),
  });
}

function block(b) {
  switch (b.type) {
    case 'p':
      return [p(b.text)];
    case 'bullets':
      return b.items.map((t) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 60, line: 288 }, children: runs(t) }));
    case 'numbered':
      return b.items.map((t) => new Paragraph({ numbering: { reference: `num-${b._id}`, level: 0 }, spacing: { after: 60, line: 288 }, children: runs(t) }));
    case 'note':
      return [new Paragraph({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: TINT }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: BRAND, space: 8 } }, spacing: { before: 80, after: 160 }, indent: { left: 160 }, children: runs(b.text, { color: INK }) })];
    case 'table':
      return [table(b.columns, b.rows, b.widths), new Paragraph({ spacing: { after: 160 }, children: [] })];
    case 'kv':
      return [kv(b.rows), new Paragraph({ spacing: { after: 160 }, children: [] })];
    case 'image': {
      if (!fs.existsSync(b.path)) return [p(`[image missing: ${path.basename(b.path)}]`)];
      const w = b.width ?? 600;
      const h = b.height ?? Math.round(w * 0.5);
      const out = [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: b.path.endsWith('.jpg') ? 'jpg' : 'png', data: fs.readFileSync(b.path), transformation: { width: w, height: h } })] })];
      if (b.caption) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: b.caption, italics: true, size: 18, color: MUTED })] }));
      return out;
    }
    default:
      return [];
  }
}

// Every numbered list restarts at 1.
let listId = 0;
const numberedRefs = [];
for (const s of spec.sections) for (const b of s.blocks ?? []) if (b.type === 'numbered') {
  b._id = ++listId;
  numberedRefs.push({ reference: `num-${b._id}`, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] });
}

const HEAD = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 };

// ----- Cover -----
const cover = [
  new Paragraph({ spacing: { before: 600, after: 600 }, children: logo ? [new ImageRun({ type: 'png', data: logo, transformation: { width: 90, height: 94 } })] : [] }),
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'BRAINBRIC INNOVATIONS', bold: true, size: 22, color: BRAND, characterSpacing: 40 })] }),
  new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: spec.doc_type, size: 30, color: MUTED })] }),
  new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: spec.title, bold: true, size: 52, color: INK })] }),
  new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: BRAND, space: 6 } }, spacing: { after: 600 }, children: [] }),
  kv([
    ['Project', spec.project ?? ''],
    ['Client', spec.client ?? ''],
    ['Document version', spec.version ?? '1.0'],
    ['Date', spec.date ?? ''],
    ['Status', spec.status ?? 'Draft for review'],
    ['Prepared by', spec.prepared_by ?? 'Brainbric Innovations'],
  ]),
  new Paragraph({ spacing: { before: 1400 }, children: [new TextRun({ text: spec.confidentiality ?? 'Confidential. Prepared by Brainbric Innovations for the named client. Not for distribution without written consent.', italics: true, size: 17, color: MUTED })] }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ----- Document control and contents -----
const control = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Document control')] }),
  kv([
    ['Prepared by', spec.prepared_by ?? 'Brainbric Innovations'],
    ['Reviewed by', spec.reviewed_by ?? 'To be reviewed'],
    ['Approved by', spec.approved_by ?? 'Pending client approval'],
  ]),
  new Paragraph({ spacing: { before: 200, after: 120 }, children: [new TextRun({ text: 'Revision history', bold: true, size: 22, color: INK })] }),
  table(['Version', 'Date', 'Author', 'Changes'], (spec.history ?? [{ version: spec.version ?? '1.0', date: spec.date ?? '', author: spec.prepared_by ?? '', changes: 'First issue' }]).map((h) => [h.version, h.date, h.author, h.changes]), [1, 1.4, 1.8, 4]),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Contents', bold: true, size: 32, color: INK })] }),
  new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ children: [new PageBreak()] }),
];

const body = spec.sections.flatMap((s) => [new Paragraph({ heading: HEAD[s.level ?? 1], children: [new TextRun(s.heading)] }), ...(s.blocks ?? []).flatMap(block)]);

const header = new Header({
  children: [
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 4 } },
      children: [
        ...(logo ? [new ImageRun({ type: 'png', data: logo, transformation: { width: 14, height: 15 } })] : []),
        new TextRun({ text: `  Brainbric Innovations  |  ${spec.doc_type}  |  ${spec.project ?? spec.title}`, size: 16, color: MUTED }),
      ],
    }),
  ],
});
const footer = new Footer({
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `Version ${spec.version ?? '1.0'}  |  Confidential  |  Page `, size: 16, color: MUTED }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED }),
        new TextRun({ text: ' of ', size: 16, color: MUTED }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: MUTED }),
      ],
    }),
  ],
});

const doc = new Document({
  creator: 'Brainbric Innovations',
  title: `${spec.doc_type}: ${spec.title}`,
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 21, color: INK } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, color: BRAND, font: FONT }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0, keepNext: true, keepLines: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 25, bold: true, color: INK, font: FONT }, paragraph: { spacing: { before: 260, after: 120 }, outlineLevel: 1, keepNext: true, keepLines: true } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, color: MUTED, font: FONT }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2, keepNext: true, keepLines: true } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
      ...numberedRefs,
    ],
  },
  sections: [
    { properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } }, titlePage: true }, headers: { default: header, first: new Header({ children: [] }) }, footers: { default: footer, first: new Footer({ children: [] }) }, children: [...cover, ...control, ...body] },
  ],
});

fs.writeFileSync(outPath, await Packer.toBuffer(doc));
console.log(`Wrote ${outPath}`);
