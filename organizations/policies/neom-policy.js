'use strict';

// ============================================
// SUPREME — NEOM Organization Policy
// ============================================

const NEOM_ORGANIZATION_ID = 'org-neom';
const NEOM_ORGANIZATION_NAME = 'NEOM';

const NEOM_ALLOWED_ROLES = Object.freeze([
    'OWNER',
    'ADMIN',
    'MANAGER',
    'USER',
    'VIEWER'
]);

function isNEOMOrganization(organizationId) {
    return String(organizationId || '').trim() ===
        NEOM_ORGANIZATION_ID;
}

function isAllowedNEOMRole(role) {
    return NEOM_ALLOWED_ROLES.includes(
        String(role || '').trim().toUpperCase()
    );
}

function validateNEOMOrganization(organizationId) {
    if (!isNEOMOrganization(organizationId)) {
        throw new Error(
            'NEOM_ORGANIZATION_REQUIRED'
        );
    }

    return true;
}

function validateNEOMRole(role) {
    if (!isAllowedNEOMRole(role)) {
        throw new Error(
            'NEOM_ROLE_NOT_ALLOWED'
        );
    }

    return true;
}

module.exports = {
    NEOM_ORGANIZATION_ID,
    NEOM_ORGANIZATION_NAME,
    NEOM_ALLOWED_ROLES,
    isNEOMOrganization,
    isAllowedNEOMRole,
    validateNEOMOrganization,
    validateNEOMRole
};
