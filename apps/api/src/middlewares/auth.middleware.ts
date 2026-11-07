import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ecomed_super_secret_jwt_key_2026';

export interface AuthUserPayload {
  id: string;
  userId?: string;
  username: string;
  role: 'ADMIN' | 'PERSONAL';
  shift?: string;
  canApplyPromotions?: boolean;
}

export interface AuthRequest extends Request<any, any, any, any> {
  user?: AuthUserPayload;
}

export const verifyToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Acceso denegado. Token no proporcionado o formato inválido.',
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token vacío.',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    req.user = {
      ...decoded,
      id: decoded.id || decoded.userId || '',
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido o expirado.',
    });
  }
};

export const requireRole = (allowedRoles: Array<'ADMIN' | 'PERSONAL'>) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `No tienes permisos suficientes. Se requiere rol: ${allowedRoles.join(' o ')}.`,
      });
    }

    next();
  };
};
