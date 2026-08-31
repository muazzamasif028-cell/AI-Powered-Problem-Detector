'use strict';

// ============================================
// SUPREME Enterprise RBAC Permissions
// ============================================

const ROLES = Object.freeze({

    SUPER_ADMIN: 'SUPER_ADMIN',

    ADMIN: 'ADMIN',

    OPERATOR: 'OPERATOR',

    ENGINEER: 'ENGINEER',

    ANALYST: 'ANALYST',

    USER: 'USER'

});

const PERMISSIONS = Object.freeze({

    // ========================================
    // NEOM Command Center
    // ========================================

    NEOM_VIEW: 'NEOM_VIEW',

    NEOM_MONITOR: 'NEOM_MONITOR',

    NEOM_CONTROL: 'NEOM_CONTROL',

    NEOM_CONFIGURE: 'NEOM_CONFIGURE',

    NEOM_ADMIN: 'NEOM_ADMIN',

    // ========================================
    // SpaceX Mission Control
    // ========================================

    SPACEX_VIEW: 'SPACEX_VIEW',

    SPACEX_TELEMETRY: 'SPACEX_TELEMETRY',

    SPACEX_OPERATIONS: 'SPACEX_OPERATIONS',

    SPACEX_ENGINEERING: 'SPACEX_ENGINEERING',

    SPACEX_ADMIN: 'SPACEX_ADMIN'

});

const ROLE_PERMISSIONS = Object.freeze({

    SUPER_ADMIN: Object.values(PERMISSIONS),

    ADMIN: [
        PERMISSIONS.NEOM_VIEW,
        PERMISSIONS.NEOM_MONITOR,
        PERMISSIONS.NEOM_CONTROL,
        PERMISSIONS.NEOM_CONFIGURE,
        PERMISSIONS.NEOM_ADMIN,

        PERMISSIONS.SPACEX_VIEW,
        PERMISSIONS.SPACEX_TELEMETRY,
        PERMISSIONS.SPACEX_OPERATIONS,
        PERMISSIONS.SPACEX_ENGINEERING,
        PERMISSIONS.SPACEX_ADMIN
    ],

    OPERATOR: [
        PERMISSIONS.NEOM_VIEW,
        PERMISSIONS.NEOM_MONITOR,
        PERMISSIONS.NEOM_CONTROL,

        PERMISSIONS.SPACEX_VIEW,
        PERMISSIONS.SPACEX_TELEMETRY,
        PERMISSIONS.SPACEX_OPERATIONS
    ],

    ENGINEER: [
        PERMISSIONS.NEOM_VIEW,
        PERMISSIONS.NEOM_MONITOR,
        PERMISSIONS.NEOM_CONFIGURE,

        PERMISSIONS.SPACEX_VIEW,
        PERMISSIONS.SPACEX_TELEMETRY,
        PERMISSIONS.SPACEX_ENGINEERING
    ],

    ANALYST: [
        PERMISSIONS.NEOM_VIEW,
        PERMISSIONS.NEOM_MONITOR,

        PERMISSIONS.SPACEX_VIEW,
        PERMISSIONS.SPACEX_TELEMETRY
    ],

    USER: [
        PERMISSIONS.NEOM_VIEW,
        PERMISSIONS.SPACEX_VIEW
    ]

});

function normalizeRole(role) {

    if (!role) {
        return null;
    }

    return String(role)
        .trim()
        .toUpperCase();

}

function getRolePermissions(role) {

    const normalizedRole =
        normalizeRole(role);

    return ROLE_PERMISSIONS[
        normalizedRole
    ] || [];

}

function hasPermission(
    role,
    permission
) {

    return getRolePermissions(role)
        .includes(permission);

}

module.exports = {

    ROLES,

    PERMISSIONS,

    ROLE_PERMISSIONS,

    normalizeRole,

    getRolePermissions,

    hasPermission

};
