'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET =
    process.env.JWT_SECRET ||
    'development-only-change-this-secret';

function extractToken(req) {

    const authorization =
        req.headers.authorization;

    if (!authorization) {
        return null;
    }

    const parts =
        authorization.split(' ');

    if (
        parts.length !== 2 ||
        parts[0] !== 'Bearer'
    ) {
        return null;
    }

    return parts[1];
}

function authenticateToken(req, res, next) {

    const token =
        extractToken(req);

    if (!token) {

        return res.status(401).json({
            error: 'AUTHENTICATION_REQUIRED',
            message:
                'A valid Bearer token is required.'
        });

    }

    try {

        const payload =
            jwt.verify(
                token,
                JWT_SECRET
            );

        req.auth = {
            userId: payload.sub,
            organization: payload.organization,
            role: payload.role
        };

        next();

    } catch (error) {

        return res.status(401).json({
            error: 'INVALID_OR_EXPIRED_TOKEN',
            message:
                'The authentication token is invalid or expired.'
        });

    }
}

function verifyToken(token) {

    if (!token) {
        throw new Error("TOKEN_REQUIRED");
    }

    return jwt.verify(
        token,
        JWT_SECRET
    );

}

function createToken({
    userId,
    organization,
    role = 'USER'
}) {

    return jwt.sign(

        {
            organization,
            role
        },

        JWT_SECRET,

        {
            subject: String(userId),

            expiresIn:
                process.env.JWT_EXPIRES_IN ||
                '1h',

            issuer:
                'SUPREME-PLATFORM'
        }

    );
}

module.exports = {

    authenticateToken,

    createToken,

    extractToken,
    verifyToken


};
