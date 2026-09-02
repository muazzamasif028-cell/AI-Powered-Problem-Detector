'use strict';

// ============================================
// SUPREME Role Escalation Protection
// ============================================

const {
    getRoleLevel,
    roleExists,
    normalizeRole
} = require('../roles/organization-roles');

function preventRoleEscalation(
    options = {}
) {

    const {
        roleField = 'role'
    } = options;

    return (req, res, next) => {

        const actor =
            req.organizationMember;

        if (!actor) {
            return res.status(403).json({
                error:
                    'ORGANIZATION_MEMBERSHIP_REQUIRED'
            });
        }

        const targetRole =
            normalizeRole(
                req.body?.[roleField] || 'USER'
            );

        if (!roleExists(targetRole)) {
            return res.status(400).json({
                error: 'INVALID_ORGANIZATION_ROLE',
                role: targetRole
            });
        }

        const actorRole =
            normalizeRole(actor.role);

        const actorLevel =
            getRoleLevel(actorRole);

        const targetLevel =
            getRoleLevel(targetRole);

        // Cannot create same or higher role
        if (targetLevel >= actorLevel) {
            return res.status(403).json({
                error: 'ROLE_ESCALATION_DENIED',

                actorRole,

                targetRole,

                message:
                    'You cannot create a member with an equal or higher role.'
            });
        }

        req.targetOrganizationRole =
            targetRole;

        next();

    };

}

module.exports = {
    preventRoleEscalation
};
