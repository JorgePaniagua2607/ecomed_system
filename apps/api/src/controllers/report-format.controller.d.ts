import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
export declare const getAllReportFormats: (_req: AuthRequest, res: Response) => Promise<void>;
export declare const getReportFormatByStudy: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const upsertReportFormat: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteReportFormat: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const generateReportPdf: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getEmittedReportsHistory: (_req: AuthRequest, res: Response) => Promise<void>;
export declare const regenerateHistoricalReportPdf: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=report-format.controller.d.ts.map