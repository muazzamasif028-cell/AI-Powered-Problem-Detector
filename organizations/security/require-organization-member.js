'use strict';

// ============================================
// SUPREME Organization Authorization Middleware
// ============================================

const members =
    require('../members/member-registry');

function requireOrganizationMember(options = {}) {

    const {
        organizationIdParam = 'organizationId',
        allowedRoles = null
    } = options;

    return (req, res, next) => {

        if (!req.auth) {
            return res.status(401).json({
                error: 'AUTHENTICATION_REQUIRED',
                message:
                    'Authentication is required.'
            });
        }

        const organizationId =
            req.params[organizationIdParam] ||
            req.body?.organizationId ||
            req.auth.organizationId ||
            req.auth.organization;

        if (!organizationId) {
            return res.status(400).json({
                error: 'ORGANIZATION_ID_REQUIRED'
            });
        }

        const userId =
            req.auth.userId ||
            req.auth.sub;

        if (!userId) {
            return res.status(401).json({
                error: 'USER_ID_REQUIRED'
            });
        }

        const member =
            members.getOrganizationMember(
                organizationId,
                userId
            );

        if (!member) {
            return res.status(403).json({
                error: 'ORGANIZATION_MEMBERSHIP_REQUIRED',
                organizationId
            });
        }

        if (member.status !== 'ACTIVE') {
            return res.status(403).json({
                error: 'ORGANIZATION_MEMBER_INACTIVE',
                organizationId,
                memberStatus: member.status
            });
        }

        if (
            Array.isArray(allowedRoles) &&
            allowedRoles.length > 0 &&
            !allowedRoles.includes(member.role)
        ) {
            return res.status(403).json({
                error: 'ORGANIZATION_ROLE_DENIED',
                requiredRoles: allowedRoles,
                currentRole: member.role
            });
        }

        req.organizationMember = member;
        req.organizationId = organizationId;

        next();

    };

}

module.exports = {
    requireOrganizationMember
};
