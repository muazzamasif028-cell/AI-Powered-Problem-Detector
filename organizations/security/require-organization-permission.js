'use strict';

// ============================================
// SUPREME Organization Permission Middleware
// ============================================

const {
    hasPermission
} = require('../roles/organization-roles');

function requireOrganizationPermission(permission) {

    if (!permission) {
        throw new Error(
            'ORGANIZATION_PERMISSION_REQUIRED'
        );
    }

    return (req, res, next) => {

        const member =
            req.organizationMember;

        if (!member) {
            return res.status(403).json({
                error:
                    'ORGANIZATION_MEMBERSHIP_REQUIRED'
            });
        }

        const allowed =
            hasPermission(
                member.role,
                permission
            );

        if (!allowed) {
            return res.status(403).json({
                error:
                    'ORGANIZATION_PERMISSION_DENIED',

                permission,

                currentRole:
                    member.role
            });
        }

        req.organizationPermission =
            permission;

        next();

    };

}

module.exports = {
    requireOrganizationPermission
};
