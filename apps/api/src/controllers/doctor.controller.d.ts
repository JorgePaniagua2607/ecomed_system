import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
export declare const getAllDoctors: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createDoctor: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateDoctor: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteDoctor: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=doctor.controller.d.ts.map