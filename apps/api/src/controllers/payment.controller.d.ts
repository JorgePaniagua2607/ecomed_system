import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
export declare const getCommitmentsCounter: (req: AuthRequest, res: Response) => Promise<void>;
export declare const settleCommitmentOrder: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getCashLedgerSummary: (req: AuthRequest, res: Response) => Promise<void>;
export declare const settleDoctorCommission: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=payment.controller.d.ts.map