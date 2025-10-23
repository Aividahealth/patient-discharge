import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { UserSession, AuthType, AuthTokens } from './types/auth.types';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private sessions = new Map<string, UserSession>();

  /**
   * Create a new user session
   */
  createSession(
    userId: string,
    tenantId: string,
    authType: AuthType,
    tokens: AuthTokens,
  ): UserSession {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (tokens.expires_in * 1000));

    const session: UserSession = {
      id: sessionId,
      userId,
      tenantId,
      authType,
      tokens,
      expiresAt,
      createdAt: now,
      lastAccessedAt: now,
    };

    this.sessions.set(sessionId, session);
    this.logger.log(`Created session ${sessionId} for user ${userId} (${authType})`);
    
    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): UserSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Update last accessed time
    session.lastAccessedAt = new Date();
    return session;
  }

  /**
   * Get all active sessions for a tenant
   */
  getActiveSessions(tenantId: string, authType?: AuthType): UserSession[] {
    const now = new Date();
    const activeSessions: UserSession[] = [];

    for (const session of this.sessions.values()) {
      if (session.tenantId === tenantId && 
          session.expiresAt > now &&
          (!authType || session.authType === authType)) {
        activeSessions.push(session);
      }
    }

    return activeSessions;
  }

  /**
   * Get sessions for a specific user
   */
  getUserSessions(userId: string, tenantId: string): UserSession[] {
    const now = new Date();
    const userSessions: UserSession[] = [];

    for (const session of this.sessions.values()) {
      if (session.userId === userId && 
          session.tenantId === tenantId &&
          session.expiresAt > now) {
        userSessions.push(session);
      }
    }

    return userSessions;
  }

  /**
   * Update session tokens
   */
  updateSessionTokens(sessionId: string, tokens: AuthTokens): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.tokens = tokens;
    session.expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));
    session.lastAccessedAt = new Date();

    this.logger.log(`Updated tokens for session ${sessionId}`);
    return true;
  }

  /**
   * Check if a session is valid and not expired
   */
  isSessionValid(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const now = new Date();
    return session.expiresAt > now;
  }

  /**
   * Refresh a session if it's close to expiring
   */
  shouldRefreshSession(sessionId: string, bufferMinutes: number = 5): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const now = new Date();
    const bufferTime = bufferMinutes * 60 * 1000;
    return (session.expiresAt.getTime() - now.getTime()) < bufferTime;
  }

  /**
   * Remove a session
   */
  removeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.logger.log(`Removed session ${sessionId} for user ${session.userId}`);
      return true;
    }
    return false;
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): number {
    const now = new Date();
    let removedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(sessionId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.log(`Cleaned up ${removedCount} expired sessions`);
    }

    return removedCount;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    total: number;
    active: number;
    expired: number;
    byAuthType: Record<AuthType, number>;
  } {
    const now = new Date();
    let active = 0;
    let expired = 0;
    const byAuthType: Record<AuthType, number> = {
      [AuthType.SYSTEM]: 0,
      [AuthType.PROVIDER]: 0,
    };

    for (const session of this.sessions.values()) {
      if (session.expiresAt > now) {
        active++;
      } else {
        expired++;
      }
      byAuthType[session.authType]++;
    }

    return {
      total: this.sessions.size,
      active,
      expired,
      byAuthType,
    };
  }
}
