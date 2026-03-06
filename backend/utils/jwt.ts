// JWT Service for token management

import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export class JWTService {
  private static readonly ACCESS_SECRET = process.env.JWT_SECRET || 'access-secret-key';
  private static readonly REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret-key';
  private static readonly ACCESS_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';
  private static readonly REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  // Generate access token
  static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.ACCESS_SECRET, {
      expiresIn: this.ACCESS_EXPIRES_IN,
      issuer: 'afyadx-api',
      audience: 'afyadx-client',
    } as jwt.SignOptions);
  }

  // Generate refresh token
  static generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.REFRESH_SECRET, {
      expiresIn: this.REFRESH_EXPIRES_IN,
      issuer: 'afyadx-api',
      audience: 'afyadx-client',
    } as jwt.SignOptions);
  }

  // Verify access token
  static verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.ACCESS_SECRET, {
        issuer: 'afyadx-api',
        audience: 'afyadx-client',
      }) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  // Verify refresh token
  static verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.REFRESH_SECRET, {
        issuer: 'afyadx-api',
        audience: 'afyadx-client',
      }) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // Store refresh token in database
  static async storeRefreshToken(userId: string, token: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });
  }

  // Remove refresh token from database
  static async removeRefreshToken(token: string): Promise<void> {
    await prisma.refreshToken.delete({
      where: { token },
    });
  }

  // Clean expired refresh tokens
  static async cleanExpiredTokens(): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }

  // Verify refresh token exists in database
  static async verifyRefreshTokenInDB(token: string): Promise<boolean> {
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token },
    });

    return refreshToken !== null && refreshToken.expiresAt > new Date();
  }
}