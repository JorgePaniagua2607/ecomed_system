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
export declare class PdfService {
    private static escapeHtml;
    static buildA4Html({ baseText, fields, fieldValues }: RenderReportA4Params): string;
    private static resolveExecutablePath;
    private static launchBrowser;
    static renderA4Pdf(params: RenderReportA4Params): Promise<Buffer>;
}
//# sourceMappingURL=pdf.service.d.ts.map