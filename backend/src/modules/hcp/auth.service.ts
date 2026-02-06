import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { getDatabase } from '../../database/connection';
import { config } from '../../config';
import { UnauthorizedError, ValidationError } from '../../utils/errors';
import { JWTPayload, UserRole, UUID } from '../../types';
import { logger } from '../../utils/logger';

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  territoryIds?: UUID[];
}

export interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  private db: Knex;

  constructor() {
    this.db = getDatabase();
  }

  async register(input: RegisterInput): Promise<{ user: Record<string, unknown>; token: string }> {
    const existing = await this.db('users').where('email', input.email).first();
    if (existing) {
      throw new ValidationError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const id = uuidv4();

    await this.db('users').insert({
      id,
      email: input.email,
      password_hash: passwordHash,
      first_name: input.firstName,
      last_name: input.lastName,
      role: input.role,
      is_active: true,
    });

    // Assign territories if provided
    if (input.territoryIds?.length) {
      const territoryRecords = input.territoryIds.map((tid, index) => ({
        id: uuidv4(),
        user_id: id,
        territory_id: tid,
        is_primary: index === 0,
      }));
      await this.db('user_territories').insert(territoryRecords);
    }

    const user = await this.db('users')
      .where({ id })
      .select('id', 'email', 'first_name', 'last_name', 'role', 'is_active', 'created_at')
      .first();

    const token = this.generateToken(id, input.email, input.role, input.territoryIds || []);

    logger.info('User registered', { userId: id, role: input.role });
    return { user, token };
  }

  async login(input: LoginInput): Promise<{
    user: Record<string, unknown>;
    token: string;
    refreshToken: string;
  }> {
    const user = await this.db('users').where('email', input.email).first();
    if (!user || !user.is_active) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const validPassword = await bcrypt.compare(input.password, user.password_hash);
    if (!validPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Get user territories
    const territories = await this.db('user_territories')
      .where('user_id', user.id)
      .pluck('territory_id');

    const token = this.generateToken(user.id, user.email, user.role, territories);
    const refreshToken = this.generateRefreshToken(user.id);

    // Update last login
    await this.db('users').where({ id: user.id }).update({ last_login_at: new Date() });

    logger.info('User logged in', { userId: user.id });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        territoryIds: territories,
      },
      token,
      refreshToken,
    };
  }

  async refreshToken(refreshTokenStr: string): Promise<{ token: string }> {
    try {
      const payload = jwt.verify(refreshTokenStr, config.jwt.secret) as { userId: string; type: string };
      if (payload.type !== 'refresh') {
        throw new UnauthorizedError('Invalid refresh token');
      }

      const user = await this.db('users').where({ id: payload.userId, is_active: true }).first();
      if (!user) {
        throw new UnauthorizedError('User not found or inactive');
      }

      const territories = await this.db('user_territories')
        .where('user_id', user.id)
        .pluck('territory_id');

      const token = this.generateToken(user.id, user.email, user.role, territories);
      return { token };
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  private generateToken(userId: UUID, email: string, role: UserRole, territoryIds: UUID[]): string {
    const payload: JWTPayload = {
      userId,
      email,
      role,
      territoryIds,
    };
    return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiry });
  }

  private generateRefreshToken(userId: UUID): string {
    return jwt.sign(
      { userId, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpiry }
    );
  }
}
