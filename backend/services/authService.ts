// Authentication Service

import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { JWTService } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResult {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string | null;
    licenseNumber: string | null;
    avatarInitials: string | null;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  licenseNumber: string | null;
  avatarInitials: string | null;
  isActive: boolean;
  createdAt: Date;
  lastLogin: Date | null;
}

export class AuthService {
  private static readonly SALT_ROUNDS = 12;

  // Hash password for storage
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  // Verify password against hash
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Login user
  static async login(credentials: LoginCredentials): Promise<AuthResult> {
    const { email, password } = credentials;

    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user || !user.isActive) {
        throw new Error('Invalid credentials or inactive account');
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = JWTService.generateAccessToken(tokenPayload);
      const refreshToken = JWTService.generateRefreshToken(tokenPayload);

      // Store refresh token
      await JWTService.storeRefreshToken(user.id, refreshToken);

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      logger.info(`User ${user.email} logged in successfully`);

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          licenseNumber: user.licenseNumber,
          avatarInitials: user.avatarInitials,
        },
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes
      };
    } catch (error) {
      logger.error({ err: error }, 'Login failed');
      throw error;
    }
  }

  // Refresh access token
  static async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      // Verify refresh token
      const payload = JWTService.verifyRefreshToken(refreshToken);

      // Check if token exists in database
      const isTokenValid = await JWTService.verifyRefreshTokenInDB(refreshToken);
      if (!isTokenValid) {
        throw new Error('Invalid refresh token');
      }

      // Generate new access token
      const accessToken = JWTService.generateAccessToken({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      });

      return {
        accessToken,
        expiresIn: 900, // 15 minutes
      };
    } catch (error) {
      logger.error({ err: error }, 'Token refresh failed');
      throw error;
    }
  }

  // Get user profile
  static async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        licenseNumber: user.licenseNumber,
        avatarInitials: user.avatarInitials,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to get user profile');
      throw error;
    }
  }

  // Logout user
  static async logout(refreshToken: string): Promise<void> {
    try {
      await JWTService.removeRefreshToken(refreshToken);
      logger.info('User logged out successfully');
    } catch (error) {
      logger.error({ err: error }, 'Logout failed');
      throw error;
    }
  }

  // Create new user (for admin registration)
  static async createUser(userData: {
    name: string;
    email: string;
    password: string;
    role: 'ADMIN' | 'RADIOLOGIST' | 'TECHNOLOGIST' | 'REFERRING_PHYSICIAN';
    department?: string;
    licenseNumber?: string;
  }) {
    try {
      const { name, email, password, role, department, licenseNumber } = userData;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Generate avatar initials
      const avatarInitials = name
        .split(' ')
        .slice(0, 2)
        .map(n => n.charAt(0).toUpperCase())
        .join('');

      // Create user
      const user = await prisma.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          passwordHash,
          role,
          department,
          licenseNumber,
          avatarInitials,
        },
      });

      logger.info(`User ${user.email} created successfully`);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        licenseNumber: user.licenseNumber,
        avatarInitials: user.avatarInitials,
        createdAt: user.createdAt,
      };
    } catch (error) {
      logger.error({ err: error }, 'User creation failed');
      throw error;
    }
  }
}