import fs from 'fs';
import puppeteer from 'puppeteer';
export class PdfService {
    static escapeHtml(raw) {
        return raw
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    static buildA4Html({ baseText, fields, fieldValues }) {
        const dynamicBoxesHtml = fields
            .map((field) => {
            const rawValue = fieldValues[field.name] ?? fieldValues[field.id];
            if (rawValue === undefined || rawValue === null || rawValue === '') {
                return '';
            }
            const safeValue = this.escapeHtml(String(rawValue));
            const x = Number(field.xPercent) || 0;
            const y = Number(field.yPercent) || 0;
            const w = Number(field.widthPercent ?? field.width) || 20;
            const h = Number(field.heightPercent ?? field.height) || 5;
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
    static resolveExecutablePath() {
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
    static async launchBrowser() {
        const baseArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--font-render-hinting=none',
        ];
        const executablePath = this.resolveExecutablePath();
        const options = {
            headless: true,
            args: baseArgs,
            ...(executablePath ? { executablePath } : {}),
        };
        return await puppeteer.launch(options);
    }
    static async renderA4Pdf(params) {
        const htmlContent = this.buildA4Html(params);
        let browser = null;
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
        }
        finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}
//# sourceMappingURL=pdf.service.js.map