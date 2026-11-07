import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'ecomed_super_secret_jwt_key_2026';
export const verifyToken = (req, res, next) => {
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
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            ...decoded,
            id: decoded.id || decoded.userId || '',
        };
        next();
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Token inválido o expirado.',
        });
    }
};
export const requireRole = (allowedRoles) => {
    return (req, res, next) => {
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
//# sourceMappingURL=auth.middleware.js.map