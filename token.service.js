// ============================================================
// 🎫 src/services/token.service.js
// SUPREME Token Service — JWT Generation & Management
// ============================================================
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');

class TokenService {
    constructor() {
        this.accessTokenExpiry = '15m';
        this.refreshTokenExpiry = '7d';
        this.refreshTokenBytes = 40;
    }

    /**
     * Generate access token (JWT)
     */
    generateAccessToken(user) {
        const payload = {
            sub: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            permissions: user.permissions,
            plan: user.plan,
            iss: process.env.JWT_ISSUER || 'supreme-os',
            iat: Math.floor(Date.now() / 1000),
            type: 'access'
        };

        return jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: this.accessTokenExpiry,
            algorithm: 'HS512'
        });
    }

    /**
     * Generate refresh token (stored in database)
     */
    async generateRefreshToken(userId, deviceInfo = {}) {
        // Delete old refresh tokens for this device
        if (deviceInfo.deviceId) {
            await RefreshToken.deleteMany({
                userId,
                'device.deviceId': deviceInfo.deviceId
            });
        }

        // Create new refresh token
        const token = crypto.randomBytes(this.refreshTokenBytes).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const refreshToken = await RefreshToken.create({
            userId,
            token: crypto.createHash('sha256').update(token).digest('hex'),
            expiresAt,
            device: {
                userAgent: deviceInfo.userAgent || 'Unknown',
                ip: deviceInfo.ip || 'Unknown',
                deviceId: deviceInfo.deviceId || crypto.randomUUID(),
                platform: deviceInfo.platform || 'Unknown',
                browser: deviceInfo.browser || 'Unknown',
                location: deviceInfo.location || 'Unknown'
            }
        });

        return {
            token, // Raw token (send to client once)
            expiresAt,
            deviceId: refreshToken.device.deviceId
        };
    }

    /**
     * Verify access token
     */
    verifyAccessToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET, {
                algorithms: ['HS512']
            });

            if (decoded.type !== 'access') {
                throw new Error('Invalid token type');
            }

            return decoded;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token expired');
            }
            throw new Error('Invalid token');
        }
    }

    /**
     * Verify and consume refresh token
     */
    async verifyRefreshToken(rawToken) {
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        
        const refreshToken = await RefreshToken.findOne({
            token: hashedToken,
            isRevoked: false,
            expiresAt: { $gt: new Date() }
        });

        if (!refreshToken) {
            throw new Error('Invalid or expired refresh token');
        }

        return refreshToken;
    }

    /**
     * Revoke refresh token
     */
    async revokeRefreshToken(rawToken) {
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        
        await RefreshToken.findOneAndUpdate(
            { token: hashedToken },
            { isRevoked: true, revokedAt: new Date() }
        );
    }

    /**
     * Revoke all refresh tokens for a user
     */
    async revokeAllUserTokens(userId) {
        await RefreshToken.updateMany(
            { userId, isRevoked: false },
            { isRevoked: true, revokedAt: new Date() }
        );
    }

    /**
     * Get user's active sessions
     */
    async getUserSessions(userId) {
        const sessions = await RefreshToken.find({
            userId,
            isRevoked: false,
            expiresAt: { $gt: new Date() }
        }).select('device createdAt lastUsedAt');

        return sessions.map(s => ({
            id: s._id,
            device: s.device,
            createdAt: s.createdAt,
            lastUsedAt: s.lastUsedAt,
            isCurrentSession: false
        }));
    }

    /**
     * Revoke a specific session
     */
    async revokeSession(userId, sessionId) {
        await RefreshToken.findOneAndUpdate(
            { _id: sessionId, userId },
            { isRevoked: true, revokedAt: new Date() }
        );
    }

    /**
     * Clean up expired tokens
     */
    async cleanupExpiredTokens() {
        const result = await RefreshToken.deleteMany({
            $or: [
                { expiresAt: { $lt: new Date() } },
                { isRevoked: true, revokedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
            ]
        });
        
        return result.deletedCount;
    }
}

module.exports = new TokenService();
