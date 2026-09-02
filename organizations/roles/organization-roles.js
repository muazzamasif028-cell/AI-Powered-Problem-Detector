'use strict';

// ============================================
// SUPREME Organization Role Hierarchy
// ============================================

const ORGANIZATION_ROLES = Object.freeze({

    OWNER: {
        level: 100,
        permissions: ['*']
    },

    ADMIN: {
        level: 80,
        permissions: [
            'ORGANIZATION_READ',
            'ORGANIZATION_UPDATE',
            'MEMBER_CREATE',
            'MEMBER_READ',
            'MEMBER_UPDATE',
            'MEMBER_REMOVE',
            'ROLE_MANAGE'
        ]
    },

    MANAGER: {
        level: 60,
        permissions: [
            'ORGANIZATION_READ',
            'MEMBER_READ',
            'MEMBER_CREATE'
        ]
    },

    USER: {
        level: 20,
        permissions: [
            'ORGANIZATION_READ'
        ]
    },

    VIEWER: {
        level: 10,
        permissions: [
            'ORGANIZATION_READ'
        ]
    }

});

function normalizeRole(role) {
    return String(role || '')
        .trim()
        .toUpperCase();
}

function getRole(role) {
    return ORGANIZATION_ROLES[
        normalizeRole(role)
    ] || null;
}

function roleExists(role) {
    return Boolean(getRole(role));
}

function getRoleLevel(role) {
    return getRole(role)?.level ?? 0;
}

function hasPermission(role, permission) {

    const roleConfig = getRole(role);

    if (!roleConfig) {
        return false;
    }

    return (
        roleConfig.permissions.includes('*') ||
        roleConfig.permissions.includes(permission)
    );
}

function canManageRole(actorRole, targetRole) {

    return (
        getRoleLevel(actorRole) >
        getRoleLevel(targetRole)
    );
}

module.exports = {
    ORGANIZATION_ROLES,
    normalizeRole,
    getRole,
    roleExists,
    getRoleLevel,
    hasPermission,
    canManageRole
};
