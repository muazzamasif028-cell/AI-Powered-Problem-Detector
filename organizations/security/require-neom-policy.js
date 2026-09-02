'use strict';

// ============================================
// SUPREME — NEOM Organization Policy Middleware
// ============================================

const {
    validateNEOMOrganization,
    validateNEOMRole
} = require('../policies/neom-policy');

function requireNEOMPolicy() {

    return (req, res, next) => {

        const organizationId =
            String(
                req.body?.organizationId ||
                req.params?.organizationId ||
                ''
            ).trim();

        const role =
            String(
                req.body?.role ||
                'USER'
            ).trim().toUpperCase();

        try {

            validateNEOMOrganization(
                organizationId
            );

            validateNEOMRole(role);

        } catch (error) {

            return res.status(403).json({
                error: error.message,
                organizationId,
                role
            });

        }

        req.neomPolicy = {
            organizationId,
            role
        };

        next();
    };
}

module.exports = {
    requireNEOMPolicy
};
