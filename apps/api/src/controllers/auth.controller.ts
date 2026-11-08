import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@ecomed/database';
import { loginSchema, changePasswordSchema } from '@ecomed/shared-types';
import type { AuthRequest } from '../middlewares/auth.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'ecomed_super_secret_jwt_key_2026';
const JWT_EXPIRES_IN = '12h';

// Inicio de sesión con detección automática de contraseña inicial igual al CI
export const login = async (req: AuthRequest, res: Response) => {
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

    // Regla Fase 1 y 2.1: Detectar si el usuario ingresó usando su CI como contraseña
    const isUsingCiAsPassword =
      password.trim() === user.ci.trim() ||
      (await bcrypt.compare(user.ci, user.passwordHash));

    const canApplyPromotions =
      user.role === 'ADMIN' ? true : Boolean(user.canApplyPromotions);

    const tokenPayload = {
      id: user.id,
      userId: user.id,
      username: user.username,
      role: user.role,
      shift: user.shift,
      canApplyPromotions,
      mustChangePassword: isUsingCiAsPassword,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    const securityAlertMessage = isUsingCiAsPassword
      ? 'Estás utilizando tu Carnet de Identidad (CI) como contraseña. Por seguridad, debes cambiarla.'
      : null;

    const userResponse = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      ci: user.ci,
      phone: user.phone,
      email: user.email,
      role: user.role,
      shift: user.shift,
      canApplyPromotions,
      mustChangePassword: isUsingCiAsPassword,
      requiresPasswordChange: isUsingCiAsPassword,
      isDefaultPassword: isUsingCiAsPassword,
      isInitialPassword: isUsingCiAsPassword,
    };

    res.json({
      success: true,
      message: isUsingCiAsPassword
        ? `Bienvenido(a) ${user.fullName}. Se detectó el uso de su CI como contraseña inicial; se recomienda cambiarla.`
        : `Bienvenido(a) ${user.fullName}`,
      token,
      mustChangePassword: isUsingCiAsPassword,
      requiresPasswordChange: isUsingCiAsPassword,
      isDefaultPassword: isUsingCiAsPassword,
      isInitialPassword: isUsingCiAsPassword,
      securityAlert: securityAlertMessage,
      warning: securityAlertMessage,
      user: userResponse,
      data: {
        token,
        mustChangePassword: isUsingCiAsPassword,
        requiresPasswordChange: isUsingCiAsPassword,
        isDefaultPassword: isUsingCiAsPassword,
        isInitialPassword: isUsingCiAsPassword,
        securityAlert: securityAlertMessage,
        warning: securityAlertMessage,
        user: userResponse,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno al procesar el inicio de sesión.',
    });
  }
};

// Cambio de contraseña propia del usuario autenticado
export const changePassword = async (req: AuthRequest, res: Response) => {
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
        message:
          parsed.error.errors[0]?.message ||
          'La nueva contraseña debe tener al menos 6 caracteres.',
        errors: parsed.error.errors,
      });
    }

    const { newPassword } = parsed.data;
    const currentPassword = req.body.currentPassword as string | undefined;

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado.',
      });
    }

    if (currentPassword && currentPassword.trim().length > 0) {
      const matches = await bcrypt.compare(
        currentPassword,
        existingUser.passwordHash
      );
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
      data: {
        mustChangePassword: false,
        requiresPasswordChange: false,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno al actualizar la contraseña.',
    });
  }
};

// Perfil del usuario autenticado (GET /me)
export const getMe = async (req: AuthRequest, res: Response) => {
  return res.json({
    success: true,
    data: req.user,
    user: req.user,
  });
};
