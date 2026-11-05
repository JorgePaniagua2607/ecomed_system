import fs from 'fs';
import puppeteer, { type Browser, type LaunchOptions } from 'puppeteer';

export interface PositionalField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date';
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  fontSize?: number;
}

export interface RenderReportA4Params {
  baseText: string;
  fields: PositionalField[];
  fieldValues: Record<string, string | number | boolean | null | undefined>;
}

export class PdfService {
  private static escapeHtml(raw: string): string {
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public static buildA4Html({ baseText, fields, fieldValues }: RenderReportA4Params): string {
    const dynamicBoxesHtml = fields
      .map((field) => {
        const rawValue = fieldValues[field.name] ?? fieldValues[field.id];
        if (rawValue === undefined || rawValue === null || rawValue === '') {
          return '';
        }

        const safeValue = this.escapeHtml(String(rawValue));
        const x = Number(field.xPercent) || 0;
        const y = Number(field.yPercent) || 0;
        const w = Number(field.widthPercent ?? (field as any).width) || 20;
        const h = Number(field.heightPercent ?? (field as any).height) || 5;
        const fontSize = Number(field.fontSize) || 11;

        return `
          <div
            class="dynamic-field"
            data-field-id="${this.escapeHtml(field.id)}"
            data-field-name="${this.escapeHtml(field.name || field.id)}"
            style="
              left: ${x}%;
              top: ${y}%;
              width: ${w}%;
              height: ${h}%;
              font-size: ${fontSize}pt;
            "
          >${safeValue}</div>
        `;
      })
      .join('\n');

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: 210mm;
            height: 297mm;
            font-family: 'Liberation Sans', Arial, Helvetica, sans-serif;
            color: #111827;
            background-color: #ffffff;
          }
          .a4-sheet {
            position: relative;
            width: 210mm;
            height: 297mm;
            overflow: hidden;
          }
          .base-text-layer {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            padding: 15mm;
            z-index: 1;
            font-size: 11pt;
            line-height: 1.45;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          .dynamic-field {
            position: absolute;
            z-index: 2;
            overflow: hidden;
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.25;
          }
        </style>
      </head>
      <body>
        <div class="a4-sheet">
          <div class="base-text-layer">${baseText}</div>
          ${dynamicBoxesHtml}
        </div>
      </body>
      </html>
    `;
  }

  private static resolveExecutablePath(): string | undefined {
    if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    const archPaths = [
      '/usr/bin/chromium',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/brave',
      '/usr/bin/brave-browser',
    ];

    for (const binPath of archPaths) {
      if (fs.existsSync(binPath)) {
        return binPath;
      }
    }

    return undefined;
  }

  private static async launchBrowser(): Promise<Browser> {
    const baseArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ];

    const executablePath = this.resolveExecutablePath();

    const options: LaunchOptions = {
      headless: true,
      args: baseArgs,
      ...(executablePath ? { executablePath } : {}),
    };

    return await puppeteer.launch(options);
  }

  public static async renderA4Pdf(params: RenderReportA4Params): Promise<Buffer> {
    const htmlContent = this.buildA4Html(params);
    let browser: Browser | null = null;

    try {
      browser = await this.launchBrowser();
      const page = await browser.newPage();

      await page.setContent(htmlContent, {
        waitUntil: 'domcontentloaded',
      });

      const pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm',
        },
      });

      return Buffer.from(pdfBytes);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
