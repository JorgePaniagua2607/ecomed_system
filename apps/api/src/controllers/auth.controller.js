import { prisma } from '@ecomed/database';
import { loginSchema, changePasswordSchema } from '@ecomed/shared-types';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
export const login = async (req, res) => {
    try {
        const result = loginSchema.safeParse(req.body);
        if (!result.success)
            return res.status(400).json({ success: false, errors: result.error.errors });
        const { username, password } = result.data;
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user || !user.isActive) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas o usuario inactivo.' });
        }
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
        }
        const isDefaultPassword = await bcrypt.compare(user.ci, user.passwordHash);
        const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, process.env.JWT_SECRET || 'secret', { expiresIn: '12h' });
        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    fullName: user.fullName,
                    role: user.role,
                    requiresPasswordChange: isDefaultPassword
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
};
export const changePassword = async (req, res) => {
    try {
        const result = changePasswordSchema.safeParse(req.body);
        if (!result.success)
            return res.status(400).json({ success: false, errors: result.error.errors });
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ success: false, message: 'No autorizado.' });
        const newPasswordHash = await bcrypt.hash(result.data.newPassword, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newPasswordHash }
        });
        res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
};
//# sourceMappingURL=auth.controller.js.map