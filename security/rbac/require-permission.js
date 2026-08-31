'use strict';

const {
    normalizeRole,
    hasPermission
} = require('./permissions');

function requirePermission(permission) {

    return (req, res, next) => {

        if (!req.auth) {

            return res.status(401).json({
                error: 'AUTHENTICATION_REQUIRED',
                message:
                    'Authentication is required to access this resource.'
            });

        }

        const role =
            normalizeRole(req.auth.role);

        if (!role) {

            return res.status(403).json({
                error: 'ROLE_REQUIRED',
                message:
                    'A valid role is required to access this resource.'
            });

        }

        if (!hasPermission(
            role,
            permission
        )) {

            return res.status(403).json({
                error: 'PERMISSION_DENIED',
                message:
                    'Your role does not have permission to perform this action.',
                requiredPermission:
                    permission,
                currentRole:
                    role
            });

        }

        req.permission = permission;
        req.role = role;

        next();

    };

}

module.exports = {
    requirePermission
};
