import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@ecomed/database';
import { loginSchema, changePasswordSchema } from '@ecomed/shared-types';
const JWT_SECRET = process.env.JWT_SECRET || 'ecomed_super_secret_jwt_key_2026';
const JWT_EXPIRES_IN = '12h';
// Inicio de sesión y emisión de token JWT con rol y permiso canApplyPromotions
export const login = async (req, res) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: 'Datos de inicio de sesión inválidos.',
                errors: parsed.error.errors,
            });
        }
        const { username, password } = parsed.data;
        const user = await prisma.user.findUnique({
            where: { username },
        });
        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no encontrado o cuenta inactiva.',
            });
        }
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales incorrectas.',
            });
        }
        const tokenPayload = {
            id: user.id,
            userId: user.id,
            username: user.username,
            role: user.role,
            shift: user.shift,
            canApplyPromotions: user.role === 'ADMIN' ? true : Boolean(user.canApplyPromotions),
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
        });
        res.json({
            success: true,
            message: `Bienvenido(a) ${user.fullName}`,
            token,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                ci: user.ci,
                phone: user.phone,
                email: user.email,
                role: user.role,
                shift: user.shift,
                canApplyPromotions: user.role === 'ADMIN' ? true : Boolean(user.canApplyPromotions),
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error interno al procesar el inicio de sesión.',
        });
    }
};
// Cambio de contraseña propia del usuario autenticado
export const changePassword = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado.',
            });
        }
        const parsed = changePasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: parsed.error.errors[0]?.message ||
                    'La nueva contraseña debe tener al menos 6 caracteres.',
                errors: parsed.error.errors,
            });
        }
        const { newPassword } = parsed.data;
        const currentPassword = req.body.currentPassword;
        const existingUser = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado.',
            });
        }
        // Si el cliente envía su contraseña actual, la verificamos
        if (currentPassword && currentPassword.trim().length > 0) {
            const matches = await bcrypt.compare(currentPassword, existingUser.passwordHash);
            if (!matches) {
                return res.status(400).json({
                    success: false,
                    message: 'La contraseña actual ingresada no es correcta.',
                });
            }
        }
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash },
        });
        res.json({
            success: true,
            message: 'Contraseña actualizada exitosamente.',
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error interno al actualizar la contraseña.',
        });
    }
};
//# sourceMappingURL=auth.controller.js.map