import { STAGES, FINAL_QUESTIONS, stageForDay } from "../data/site-defaults.js";
import { downloadBlob, formatDate, slugify } from "../utils/dom.js";

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const PDF_WIDTH = 595;
const PDF_HEIGHT = 842;
const MARGIN_X = 105;
const MARGIN_TOP = 105;
const MARGIN_BOTTOM = 110;

const COLORS = {
  navy: "#172B4D",
  blue: "#4169B1",
  sky: "#DCE8F7",
  ivory: "#F8F5EF",
  charcoal: "#30343B",
  muted: "#69717D",
  champagne: "#C4AB79",
  white: "#FFFFFF",
  border: "#D9D8D4",
  success: "#2C7A62"
};

function splitWords(text) {
  return String(text || "").replace(/\r/g, "").split(/(\s+)/).filter(Boolean);
}

function wrapLines(ctx, text, maxWidth) {
  const paragraphs = String(text || "").replace(/\r/g, "").split("\n");
  const lines = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    if (!paragraph.trim()) {
      lines.push("");
      return;
    }
    let current = "";
    for (const token of splitWords(paragraph)) {
      const candidate = `${current}${token}`;
      if (ctx.measureText(candidate).width <= maxWidth || !current.trim()) {
        current = candidate;
      } else {
        lines.push(current.trimEnd());
        current = token.trimStart();
      }
    }
    if (current) lines.push(current.trimEnd());
    if (paragraphIndex < paragraphs.length - 1) lines.push("");
  });
  return lines;
}

function roundedRect(ctx, x, y, width, height, radius, fill, stroke = null) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

class CanvasPdfDocument {
  constructor(title) {
    this.title = title;
    this.pages = [];
    this.page = null;
    this.ctx = null;
    this.y = 0;
    this.pageNumber = 0;
  }

  addPage(theme = "light", section = "CuriousStride") {
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("This browser could not create the PDF canvas.");
    this.pageNumber += 1;
    this.page = canvas;
    this.ctx = ctx;
    this.pages.push(canvas);
    if (theme === "dark") {
      ctx.fillStyle = COLORS.navy;
      ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    } else {
      ctx.fillStyle = COLORS.ivory;
      ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
      this.drawHeader(section);
      this.drawFooter();
    }
    this.y = MARGIN_TOP + (theme === "light" ? 52 : 0);
    return canvas;
  }

  drawHeader(section) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = COLORS.navy;
    roundedRect(ctx, MARGIN_X, 58, 38, 38, 11, COLORS.navy);
    ctx.strokeStyle = COLORS.sky;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X + 8, 81);
    ctx.lineTo(MARGIN_X + 29, 69);
    ctx.stroke();
    ctx.strokeStyle = COLORS.champagne;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X + 14, 88);
    ctx.lineTo(MARGIN_X + 31, 78);
    ctx.stroke();
    ctx.fillStyle = COLORS.navy;
    ctx.font = '600 25px "DM Sans", Arial, sans-serif';
    ctx.fillText("CuriousStride", MARGIN_X + 52, 85);
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = "right";
    ctx.font = '500 18px "DM Sans", Arial, sans-serif';
    ctx.fillText(section, PAGE_WIDTH - MARGIN_X, 83);
    ctx.restore();
  }

  drawFooter() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, PAGE_HEIGHT - 75);
    ctx.lineTo(PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 75);
    ctx.stroke();
    ctx.fillStyle = COLORS.muted;
    ctx.font = '500 16px "DM Sans", Arial, sans-serif';
    ctx.textAlign = "left";
    ctx.fillText("The participant owns their reflections.", MARGIN_X, PAGE_HEIGHT - 43);
    ctx.textAlign = "right";
    ctx.fillText(String(this.pageNumber), PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 43);
    ctx.restore();
  }

  availableHeight() {
    return PAGE_HEIGHT - MARGIN_BOTTOM - this.y;
  }

  ensureSpace(height, section = "Reflection journal") {
    if (!this.page || this.availableHeight() < height) this.addPage("light", section);
  }

  heading(text, options = {}) {
    const {
      size = 48,
      color = COLORS.navy,
      marginBottom = 25,
      maxWidth = PAGE_WIDTH - MARGIN_X * 2,
      section = "Reflection journal"
    } = options;
    let ctx = this.ctx;
    ctx.font = `600 ${size}px "Lora", Georgia, serif`;
    const lines = wrapLines(ctx, text, maxWidth);
    const lineHeight = Math.round(size * 1.22);
    this.ensureSpace(lines.length * lineHeight + marginBottom, section);
    ctx = this.ctx;
    ctx.font = `600 ${size}px "Lora", Georgia, serif`;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    lines.forEach((line) => {
      ctx.fillText(line, MARGIN_X, this.y);
      this.y += lineHeight;
    });
    this.y += marginBottom;
  }

  label(text, options = {}) {
    const { color = COLORS.blue, section = "Reflection journal" } = options;
    this.ensureSpace(45, section);
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.font = '700 18px "DM Sans", Arial, sans-serif';
    ctx.fillText(String(text).toUpperCase(), MARGIN_X, this.y);
    this.y += 38;
  }

  paragraph(text, options = {}) {
    const {
      size = 25,
      lineHeight = Math.round(size * 1.55),
      color = COLORS.charcoal,
      marginBottom = 22,
      indent = 0,
      maxWidth = PAGE_WIDTH - MARGIN_X * 2 - indent,
      font = '400',
      section = "Reflection journal"
    } = options;
    let ctx = this.ctx;
    ctx.font = `${font} ${size}px "DM Sans", Arial, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    const lines = wrapLines(ctx, text || "", maxWidth);
    for (const line of lines) {
      if (this.availableHeight() < lineHeight + marginBottom) {
        this.addPage("light", section);
        ctx = this.ctx;
        ctx.font = `${font} ${size}px "DM Sans", Arial, sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = "left";
      }
      if (line) ctx.fillText(line, MARGIN_X + indent, this.y);
      this.y += lineHeight;
    }
    this.y += marginBottom;
  }

  chip(text, options = {}) {
    const { fill = COLORS.sky, color = COLORS.navy, section = "Reflection journal" } = options;
    let ctx = this.ctx;
    ctx.font = '700 18px "DM Sans", Arial, sans-serif';
    const width = ctx.measureText(text).width + 36;
    this.ensureSpace(58, section);
    ctx = this.ctx;
    ctx.font = '700 18px "DM Sans", Arial, sans-serif';
    roundedRect(ctx, MARGIN_X, this.y - 25, width, 42, 21, fill);
    ctx.fillStyle = color;
    ctx.fillText(text, MARGIN_X + 18, this.y + 3);
    this.y += 55;
  }

  divider() {
    this.ensureSpace(35);
    const ctx = this.ctx;
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, this.y);
    ctx.lineTo(PAGE_WIDTH - MARGIN_X, this.y);
    ctx.stroke();
    this.y += 32;
  }

  responseBox(text, options = {}) {
    const { section = "Reflection journal", placeholder = "No response was saved for this day." } = options;
    const response = String(text || "").trim() || placeholder;
    let ctx = this.ctx;
    ctx.font = '400 25px "DM Sans", Arial, sans-serif';
    const maxWidth = PAGE_WIDTH - MARGIN_X * 2 - 60;
    const lines = wrapLines(ctx, response, maxWidth);
    const lineHeight = 39;
    let lineIndex = 0;
    while (lineIndex < lines.length) {
      const maxLines = Math.max(1, Math.floor((this.availableHeight() - 100) / lineHeight));
      if (maxLines < 2) {
        this.addPage("light", section);
        ctx = this.ctx;
      }
      const count = Math.min(lines.length - lineIndex, Math.max(1, Math.floor((this.availableHeight() - 85) / lineHeight)));
      const chunk = lines.slice(lineIndex, lineIndex + count);
      const boxHeight = chunk.length * lineHeight + 64;
      roundedRect(ctx, MARGIN_X, this.y - 12, PAGE_WIDTH - MARGIN_X * 2, boxHeight, 20, "#FFFDF8", COLORS.border);
      ctx.fillStyle = text?.trim() ? COLORS.charcoal : COLORS.muted;
      ctx.font = `${text?.trim() ? "400" : "500"} 25px "DM Sans", Arial, sans-serif`;
      let lineY = this.y + 34;
      chunk.forEach((line) => {
        if (line) ctx.fillText(line, MARGIN_X + 30, lineY);
        lineY += lineHeight;
      });
      this.y += boxHeight + 28;
      lineIndex += count;
      if (lineIndex < lines.length) {
        this.addPage("light", section);
        ctx = this.ctx;
      }
    }
  }
}

function drawCover(doc, profile, completedCount) {
  doc.addPage("dark");
  const ctx = doc.ctx;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.11)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(PAGE_WIDTH - 110, 280, 360, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(196,171,121,0.38)";
  ctx.beginPath();
  ctx.arc(PAGE_WIDTH - 160, 305, 220, 0, Math.PI * 2);
  ctx.stroke();

  roundedRect(ctx, MARGIN_X, 105, 68, 68, 19, COLORS.navy, "rgba(255,255,255,0.25)");
  ctx.strokeStyle = COLORS.sky;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X + 14, 148);
  ctx.lineTo(MARGIN_X + 52, 126);
  ctx.stroke();
  ctx.strokeStyle = COLORS.champagne;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X + 26, 160);
  ctx.lineTo(MARGIN_X + 55, 143);
  ctx.stroke();

  ctx.fillStyle = COLORS.white;
  ctx.font = '600 30px "DM Sans", Arial, sans-serif';
  ctx.fillText("CuriousStride", MARGIN_X + 88, 151);

  ctx.fillStyle = COLORS.champagne;
  ctx.font = '700 20px "DM Sans", Arial, sans-serif';
  ctx.fillText("PERSONAL REFLECTION JOURNAL", MARGIN_X, 370);

  ctx.fillStyle = COLORS.white;
  ctx.font = '600 88px "Lora", Georgia, serif';
  const titleLines = wrapLines(ctx, "30 days. A little more understanding.", PAGE_WIDTH - MARGIN_X * 2);
  let y = 485;
  titleLines.forEach((line) => {
    ctx.fillText(line, MARGIN_X, y);
    y += 108;
  });

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = '400 29px "DM Sans", Arial, sans-serif';
  ctx.fillText(`Prepared for ${profile.fullName || "CuriousStride participant"}`, MARGIN_X, y + 58);
  ctx.fillText(`Exported ${formatDate(new Date())}`, MARGIN_X, y + 108);

  roundedRect(ctx, MARGIN_X, PAGE_HEIGHT - 360, PAGE_WIDTH - MARGIN_X * 2, 150, 26, "rgba(255,255,255,0.08)", "rgba(255,255,255,0.15)");
  ctx.fillStyle = COLORS.white;
  ctx.font = '600 43px "Lora", Georgia, serif';
  ctx.fillText(`${completedCount} of 30 reflections completed`, MARGIN_X + 38, PAGE_HEIGHT - 290);
  ctx.fillStyle = "rgba(255,255,255,0.68)";
  ctx.font = '400 23px "DM Sans", Arial, sans-serif';
  ctx.fillText("Your responses remain yours. Keep this document somewhere that feels private.", MARGIN_X + 38, PAGE_HEIGHT - 245);
  ctx.restore();
}

function drawJourneyOverview(doc, profile, reflections) {
  doc.addPage("light", "Journey overview");
  doc.label("Journey overview", { section: "Journey overview" });
  doc.heading("Your 30-day path", { section: "Journey overview" });
  doc.paragraph(
    "This journal gathers the prompts and responses you chose to keep throughout the CuriousStride challenge. Missing days are part of real life; they do not reduce the value of what you noticed.",
    { color: COLORS.muted, size: 26, section: "Journey overview" }
  );
  doc.divider();
  doc.paragraph(`Participant: ${profile.fullName || "—"}`, { font: "600", section: "Journey overview" });
  doc.paragraph(`Challenge started: ${formatDate(profile.challengeStartDate)}`, { section: "Journey overview" });
  doc.paragraph(`Timezone: ${profile.timezone || "UTC"}`, { section: "Journey overview" });
  doc.paragraph(`Completed reflections: ${reflections.filter((item) => item.completed).length} of 30`, {
    section: "Journey overview"
  });
  doc.y += 25;
  doc.label("Five stages", { section: "Journey overview" });
  for (const stage of STAGES) {
    const count = reflections.filter(
      (item) => item.dayNumber >= stage.startDay && item.dayNumber <= stage.endDay && item.completed
    ).length;
    doc.heading(`${stage.number}. ${stage.name}`, { size: 32, marginBottom: 10, section: "Journey overview" });
    doc.paragraph(`${stage.description}  ${count} of 6 reflections marked complete.`, {
      color: COLORS.muted,
      size: 22,
      marginBottom: 22,
      section: "Journey overview"
    });
  }
}

function drawReflection(doc, prompt, reflection) {
  const stage = stageForDay(prompt.dayNumber);
  const section = `Stage ${stage.number}: ${stage.name}`;
  doc.ensureSpace(440, section);
  doc.chip(`DAY ${prompt.dayNumber} · ${stage.name}`, { section });
  doc.heading(prompt.title || `Day ${prompt.dayNumber}`, { size: 44, marginBottom: 18, section });
  if (prompt.introduction) {
    doc.paragraph(prompt.introduction, { color: COLORS.muted, size: 23, marginBottom: 22, section });
  }
  doc.label("Reflection prompt", { section });
  doc.paragraph(prompt.question, { size: 30, font: "600", lineHeight: 45, color: COLORS.navy, section });
  if (prompt.followUp) {
    doc.paragraph(`Consider: ${prompt.followUp}`, { size: 22, color: COLORS.blue, marginBottom: 28, section });
  }
  doc.label(reflection?.completed ? "Your reflection · marked complete" : "Your reflection", {
    color: reflection?.completed ? COLORS.success : COLORS.blue,
    section
  });
  doc.responseBox(reflection?.response || "", { section });
  doc.divider();
}

function drawFinalReflections(doc, finals = {}) {
  doc.addPage("light", "Closing reflections");
  doc.label("Closing reflections", { section: "Closing reflections" });
  doc.heading("A new chapter ahead", { section: "Closing reflections" });
  doc.paragraph(
    "These questions are an invitation to notice what changed, what stayed with you and what you may want to carry into whatever comes next.",
    { color: COLORS.muted, section: "Closing reflections" }
  );
  FINAL_QUESTIONS.forEach((item, index) => {
    doc.ensureSpace(320, "Closing reflections");
    doc.chip(`QUESTION ${index + 1}`, { section: "Closing reflections" });
    doc.heading(item.question, { size: 34, marginBottom: 20, section: "Closing reflections" });
    doc.responseBox(finals[item.id] || "", {
      section: "Closing reflections",
      placeholder: "No closing response was saved."
    });
  });
}

function asciiBytes(text) {
  return new TextEncoder().encode(text);
}

function concatBytes(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

async function canvasToJpegBytes(canvas) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("A PDF page could not be rendered."))), "image/jpeg", 0.9);
  });
  return new Uint8Array(await blob.arrayBuffer());
}

async function buildImagePdf(canvases) {
  const images = await Promise.all(canvases.map(canvasToJpegBytes));
  const objectCount = 2 + canvases.length * 3;
  const objects = new Array(objectCount + 1);
  const kids = [];

  canvases.forEach((canvas, index) => {
    const pageObj = 3 + index * 3;
    const imageObj = pageObj + 1;
    const contentObj = pageObj + 2;
    const imageName = `Im${index + 1}`;
    kids.push(`${pageObj} 0 R`);

    const page = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_WIDTH} ${PDF_HEIGHT}] /Resources << /XObject << /${imageName} ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>`;
    objects[pageObj] = asciiBytes(`${pageObj} 0 obj\n${page}\nendobj\n`);

    const imageHeader = asciiBytes(
      `${imageObj} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${images[index].length} >>\nstream\n`
    );
    const imageFooter = asciiBytes("\nendstream\nendobj\n");
    objects[imageObj] = concatBytes([imageHeader, images[index], imageFooter]);

    const stream = `q\n${PDF_WIDTH} 0 0 ${PDF_HEIGHT} 0 0 cm\n/${imageName} Do\nQ\n`;
    objects[contentObj] = asciiBytes(
      `${contentObj} 0 obj\n<< /Length ${asciiBytes(stream).length} >>\nstream\n${stream}endstream\nendobj\n`
    );
  });

  objects[1] = asciiBytes("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects[2] = asciiBytes(`2 0 obj\n<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${canvases.length} >>\nendobj\n`);

  const header = concatBytes([asciiBytes("%PDF-1.4\n%"), new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3]), asciiBytes("\n")]);
  const parts = [header];
  const offsets = new Array(objectCount + 1).fill(0);
  let offset = header.length;
  for (let number = 1; number <= objectCount; number += 1) {
    offsets[number] = offset;
    parts.push(objects[number]);
    offset += objects[number].length;
  }
  const xrefOffset = offset;
  let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  for (let number = 1; number <= objectCount; number += 1) {
    xref += `${String(offsets[number]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(asciiBytes(xref));
  return new Blob([concatBytes(parts)], { type: "application/pdf" });
}

export async function exportReflectionsPdf({ profile, prompts, reflections, finalReflections = {} }) {
  if (document.fonts?.ready) {
    await Promise.race([
      document.fonts.ready.catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 1800))
    ]);
  }
  const reflectionMap = new Map(reflections.map((item) => [Number(item.dayNumber), item]));
  const completedCount = reflections.filter((item) => item.completed).length;
  const doc = new CanvasPdfDocument("CuriousStride Reflection Journal");
  drawCover(doc, profile, completedCount);
  drawJourneyOverview(doc, profile, reflections);
  for (const prompt of [...prompts].sort((a, b) => a.dayNumber - b.dayNumber)) {
    drawReflection(doc, prompt, reflectionMap.get(Number(prompt.dayNumber)));
  }
  drawFinalReflections(doc, finalReflections);
  const pdf = await buildImagePdf(doc.pages);
  const name = slugify(profile.fullName || "participant") || "participant";
  downloadBlob(pdf, `curiousstride-${name}-reflection-journal.pdf`);
  return { pageCount: doc.pages.length, size: pdf.size };
}
