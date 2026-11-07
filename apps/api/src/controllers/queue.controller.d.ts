import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
export declare const getWaitingRoomMonitor: (_req: AuthRequest, res: Response) => Promise<void>;
export declare const callNextPatient: (_req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateOrderQueueStatus: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=queue.controller.d.ts.map