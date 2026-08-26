// ============================================================
// 🛡️ src/controllers/auth.controller.js
// SUPREME Authentication Controller
// ============================================================
const User = require('../models/User');
const tokenService = require('../services/token.service');
const emailService = require('../services/email.service');
const twoFactorService = require('../services/twoFactor.service');
const { success, created, badRequest, unauthorized, notFound, serverError } = require('../utils/responseFormatter');
const { validationResult } = require('express-validator');

class AuthController {

    // =============================================
    // 📝 SIGN UP
    // =============================================
    async signUp(req, res) {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return badRequest(res, 'Validation failed', errors.array());
            }

            const { name, email, password } = req.body;

            // Check if user exists
            const existingUser = await User.findOne({ email: email.toLowerCase() });
            if (existingUser) {
                return badRequest(res, 'Email already registered');
            }

            // Create user
            const user = await User.create({
                name,
                email: email.toLowerCase(),
                password,
                role: 'user',
                permissions: ['domain:read', 'ai:read']
            });

            // Generate email verification token
            const verificationToken = user.generateEmailVerificationToken();
            await user.save({ validateBeforeSave: false });

            // Send verification email
            await emailService.sendVerificationEmail(user.email, user.name, verificationToken);

            // Generate tokens
            const accessToken = tokenService.generateAccessToken(user);
            const refreshToken = await tokenService.generateRefreshToken(user._id, {
                userAgent: req.headers['user-agent'],
                ip: req.ip
            });

            return created(res, {
                user: user.toSafeObject(),
                accessToken,
                refreshToken: refreshToken.token,
                deviceId: refreshToken.deviceId
            }, 'Account created successfully. Please verify your email.');

        } catch (error) {
            console.error('SignUp error:', error);
            return serverError(res, 'Registration failed');
        }
    }

    // =============================================
    // 🔑 SIGN IN
    // =============================================
    async signIn(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return badRequest(res, 'Validation failed', errors.array());
            }

            const { email, password, twoFactorCode, backupCode } = req.body;

            // Find user with password
            const user = await User.findOne({ email: email.toLowerCase() }).select('+password +twoFactorSecret');

            if (!user) {
                return unauthorized(res, 'Invalid email or password');
            }

            // Check account status
            if (user.status === 'suspended') {
                return unauthorized(res, 'Account has been suspended');
            }

            if (user.status === 'deleted') {
                return unauthorized(res, 'Account not found');
            }

            // Check if account is locked
            if (user.lockedUntil && user.lockedUntil > new Date()) {
                const minutesLeft = Math.ceil((user.lockedUntil - new Date()) / 60000);
                return unauthorized(res, `Account locked. Try again in ${minutesLeft} minutes`);
            }

            // Verify password
            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                user.failedLoginAttempts += 1;

                // Lock account after 10 failed attempts
                if (user.failedLoginAttempts >= 10) {
                    user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
                }

                await user.save({ validateBeforeSave: false });
                return unauthorized(res, 'Invalid email or password');
            }

            // Check 2FA
            if (user.twoFactorEnabled) {
                if (!twoFactorCode && !backupCode) {
                    return res.json({
                        success: true,
                        requiresTwoFactor: true,
                        message: 'Please enter your 2FA code'
                    });
                }

                // Verify 2FA code
                if (twoFactorCode) {
                    const isValid = twoFactorService.verifyToken(user.twoFactorSecret, twoFactorCode);
                    if (!isValid) {
                        return unauthorized(res, 'Invalid 2FA code');
                    }
                }

                // Verify backup code
                if (backupCode) {
                    const backupCodeObj = user.twoFactorBackupCodes.find(
                        c => c.code === backupCode && !c.used
                    );
                    if (!backupCodeObj) {
                        return unauthorized(res, 'Invalid backup code');
                    }
                    backupCodeObj.used = true;
                }
            }

            // Reset failed attempts
            user.failedLoginAttempts = 0;
            user.lockedUntil = null;
            user.lastLoginAt = new Date();
            user.lastLoginIp = req.ip;
            user.loginCount += 1;
            await user.save({ validateBeforeSave: false });

            // Generate tokens
            const accessToken = tokenService.generateAccessToken(user);
            const refreshToken = await tokenService.generateRefreshToken(user._id, {
                userAgent: req.headers['user-agent'],
                ip: req.ip
            });

            // Send login notification
            if (user.loginCount > 1) {
                await emailService.sendLoginNotification(user.email, user.name, {
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                    timestamp: new Date()
                });
            }

            return success(res, {
                user: user.toSafeObject(),
                accessToken,
                refreshToken: refreshToken.token,
                deviceId: refreshToken.deviceId
            }, 'Sign in successful');

        } catch (error) {
            console.error('SignIn error:', error);
            return serverError(res, 'Sign in failed');
        }
    }

    // =============================================
    // 🔄 REFRESH TOKEN
    // =============================================
    async refreshToken(req, res) {
        try {
            const { refreshToken: rawToken } = req.body;

            if (!rawToken) {
                return badRequest(res, 'Refresh token is required');
            }

            // Verify and get refresh token document
            const tokenDoc = await tokenService.verifyRefreshToken(rawToken);
            
            // Get user
            const user = await User.findById(tokenDoc.userId);
            if (!user || user.status !== 'active') {
                return unauthorized(res, 'User not found or inactive');
            }

            // Check if password changed after token issued
            const tokenIssuedAt = Math.floor(tokenDoc.createdAt.getTime() / 1000);
            if (user.passwordChangedAfter(tokenIssuedAt)) {
                await tokenService.revokeAllUserTokens(user._id);
                return unauthorized(res, 'Password changed. Please sign in again.');
            }

            // Revoke old refresh token
            await tokenService.revokeRefreshToken(rawToken);

            // Generate new tokens
            const newAccessToken = tokenService.generateAccessToken(user);
            const newRefreshToken = await tokenService.generateRefreshToken(user._id, tokenDoc.device);

            // Update last used
            tokenDoc.lastUsedAt = new Date();
            await tokenDoc.save();

            return success(res, {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken.token,
                deviceId: newRefreshToken.deviceId
            }, 'Token refreshed');

        } catch (error) {
            console.error('RefreshToken error:', error);
            return unauthorized(res, error.message || 'Invalid refresh token');
        }
    }

    // =============================================
    // 🚪 SIGN OUT
    // =============================================
    async signOut(req, res) {
        try {
            const { refreshToken } = req.body;

            if (refreshToken) {
                await tokenService.revokeRefreshToken(refreshToken);
            }

            return success(res, null, 'Signed out successfully');
        } catch (error) {
            console.error('SignOut error:', error);
            return serverError(res, 'Sign out failed');
        }
    }

    // =============================================
    // 📧 VERIFY EMAIL
    // =============================================
    async verifyEmail(req, res) {
        try {
            const { token } = req.params;

            const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

            const user = await User.findOne({
                emailVerificationToken: hashedToken,
                emailVerificationExpires: { $gt: new Date() }
            });

            if (!user) {
                return badRequest(res, 'Invalid or expired verification link');
            }

            user.isEmailVerified = true;
            user.emailVerificationToken = undefined;
            user.emailVerificationExpires = undefined;
            await user.save({ validateBeforeSave: false });

            // Grant additional permissions after verification
            if (!user.permissions.includes('domain:write')) {
                user.permissions.push('domain:write');
                await user.save({ validateBeforeSave: false });
            }

            return success(res, null, 'Email verified successfully');
        } catch (error) {
            console.error('VerifyEmail error:', error);
            return serverError(res, 'Email verification failed');
        }
    }

    // =============================================
    // 🔑 FORGOT PASSWORD
    // =============================================
    async forgotPassword(req, res) {
        try {
            const { email } = req.body;

            const user = await User.findOne({ email: email.toLowerCase() });
            
            // Always return success (prevent email enumeration)
            if (!user) {
                return success(res, null, 'If that email exists, a reset link has been sent');
            }

            const resetToken = user.generatePasswordResetToken();
            await user.save({ validateBeforeSave: false });

            await emailService.sendPasswordResetEmail(user.email, user.name, resetToken);

            return success(res, null, 'If that email exists, a reset link has been sent');
        } catch (error) {
            console.error('ForgotPassword error:', error);
            return serverError(res, 'Failed to process request');
        }
    }

    // =============================================
    // 🔐 RESET PASSWORD
    // =============================================
    async resetPassword(req, res) {
        try {
            const { token, password } = req.body;

            const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

            const user = await User.findOne({
                passwordResetToken: hashedToken,
                passwordResetExpires: { $gt: new Date() }
            });

            if (!user) {
                return badRequest(res, 'Invalid or expired reset link');
            }

            user.password = password;
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            user.passwordChangedAt = new Date();
            user.failedLoginAttempts = 0;
            user.lockedUntil = null;

            // Revoke all existing tokens
            await tokenService.revokeAllUserTokens(user._id);

            await user.save();

            await emailService.sendPasswordChangedEmail(user.email, user.name);

            return success(res, null, 'Password reset successful. Please sign in.');
        } catch (error) {
            console.error('ResetPassword error:', error);
            return serverError(res, 'Password reset failed');
        }
    }

    // =============================================
    // 📱 ENABLE 2FA
    // =============================================
    async enableTwoFactor(req, res) {
        try {
            const user = await User.findById(req.user.sub).select('+twoFactorSecret');

            const { secret, qrCode, uri } = await twoFactorService.generateSecret(
                user.email,
                user.name
            );

            user.twoFactorSecret = secret;
            user.twoFactorEnabled = false; // Will be enabled after verification
            await user.save({ validateBeforeSave: false });

            return success(res, {
                secret,
                qrCode,
                uri
            }, '2FA setup initiated. Scan the QR code.');

        } catch (error) {
            console.error('Enable2FA error:', error);
            return serverError(res, 'Failed to setup 2FA');
        }
    }

    // =============================================
    // ✅ VERIFY 2FA SETUP
    // =============================================
    async verifyTwoFactor(req, res) {
        try {
            const { code } = req.body;
            const user = await User.findById(req.user.sub).select('+twoFactorSecret');

            const isValid = twoFactorService.verifyToken(user.twoFactorSecret, code);

            if (!isValid) {
                return badRequest(res, 'Invalid verification code');
            }

            // Generate backup codes
            const backupCodes = user.generateBackupCodes();
            user.twoFactorEnabled = true;
            await user.save({ validateBeforeSave: false });

            return success(res, {
                backupCodes
            }, '2FA enabled successfully. Save your backup codes!');

        } catch (error) {
            console.error('Verify2FA error:', error);
            return serverError(res, '2FA verification failed');
        }
    }

    // =============================================
    // 🚫 DISABLE 2FA
    // =============================================
    async disableTwoFactor(req, res) {
        try {
            const { password } = req.body;
            const user = await User.findById(req.user.sub).select('+password');

            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                return unauthorized(res, 'Invalid password');
            }

            user.twoFactorEnabled = false;
            user.twoFactorSecret = undefined;
            user.twoFactorBackupCodes = [];
            await user.save({ validateBeforeSave: false });

            return success(res, null, '2FA disabled');
        } catch (error) {
            console.error('Disable2FA error:', error);
            return serverError(res, 'Failed to disable 2FA');
        }
    }

    // =============================================
    // 📱 GET SESSIONS
    // =============================================
    async getSessions(req, res) {
        try {
            const sessions = await tokenService.getUserSessions(req.user.sub);
            
            // Mark current session
            const currentDeviceId = req.headers['x-device-id'];
            if (currentDeviceId) {
                sessions.forEach(s => {
                    if (s.device.deviceId === currentDeviceId) {
                        s.isCurrentSession = true;
                    }
                });
            }

            return success(res, sessions, 'Sessions retrieved');
        } catch (error) {
            console.error('GetSessions error:', error);
            return serverError(res, 'Failed to get sessions');
        }
    }

    // =============================================
    // 🗑️ REVOKE SESSION
    // =============================================
    async revokeSession(req, res) {
        try {
            const { sessionId } = req.params;
            await tokenService.revokeSession(req.user.sub, sessionId);
            return success(res, null, 'Session revoked');
        } catch (error) {
            console.error('RevokeSession error:', error);
            return serverError(res, 'Failed to revoke session');
        }
    }
}

module.exports = new AuthController();
