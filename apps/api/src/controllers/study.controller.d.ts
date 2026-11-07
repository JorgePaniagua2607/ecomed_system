import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
export declare const getAllStudies: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createStudy: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateStudy: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteStudy: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=study.controller.d.ts.map