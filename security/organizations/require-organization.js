'use strict';

// ============================================
// SUPREME Platform
// Organization Validation Middleware
// ============================================

const {
    normalizeOrganizationId,
    getOrganization,
    isOrganizationActive
} = require(
    './organization-store'
);

function requireOrganization(req, res, next) {

    const organizationId =
        normalizeOrganizationId(
            req.auth?.organization
        );

    if (!organizationId) {

        return res.status(403).json({
            error: 'ORGANIZATION_REQUIRED',
            message:
                'A valid organization is required.'
        });

    }

    const organization =
        getOrganization(organizationId);

    if (!organization) {

        return res.status(403).json({
            error: 'ORGANIZATION_NOT_FOUND',
            organization:
                organizationId
        });

    }

    if (
        !isOrganizationActive(
            organizationId
        )
    ) {

        return res.status(403).json({
            error:
                'ORGANIZATION_INACTIVE',
            organization:
                organizationId
        });

    }

    req.organization = organization;

    next();

}

module.exports = {
    requireOrganization
};
