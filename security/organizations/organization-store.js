'use strict';

// ============================================
// SUPREME Platform
// Enterprise Organization Store
// ============================================

const ORGANIZATIONS = new Map();

// ============================================
// Helpers
// ============================================

function normalizeOrganizationId(value) {

    if (!value) {
        return null;
    }

    return String(value)
        .trim()
        .toUpperCase();

}

function createOrganization(data = {}) {

    const id = normalizeOrganizationId(
        data.id
    );

    if (!id) {
        throw new Error(
            'ORGANIZATION_ID_REQUIRED'
        );
    }

    if (ORGANIZATIONS.has(id)) {
        throw new Error(
            'ORGANIZATION_ALREADY_EXISTS'
        );
    }

    const organization = {
        id,
        name:
            String(data.name || id).trim(),

        type:
            String(
                data.type || 'ENTERPRISE'
            )
                .trim()
                .toUpperCase(),

        status:
            String(
                data.status || 'ACTIVE'
            )
                .trim()
                .toUpperCase(),

        createdAt:
            new Date().toISOString(),

        updatedAt:
            new Date().toISOString()
    };

    ORGANIZATIONS.set(
        id,
        organization
    );

    return organization;

}

function getOrganization(id) {

    const normalizedId =
        normalizeOrganizationId(id);

    if (!normalizedId) {
        return null;
    }

    return ORGANIZATIONS.get(
        normalizedId
    ) || null;

}

function organizationExists(id) {

    return Boolean(
        getOrganization(id)
    );

}

function updateOrganization(
    id,
    updates = {}
) {

    const organization =
        getOrganization(id);

    if (!organization) {
        throw new Error(
            'ORGANIZATION_NOT_FOUND'
        );
    }

    if (updates.name !== undefined) {
        organization.name =
            String(updates.name).trim();
    }

    if (updates.type !== undefined) {
        organization.type =
            String(updates.type)
                .trim()
                .toUpperCase();
    }

    if (updates.status !== undefined) {
        organization.status =
            String(updates.status)
                .trim()
                .toUpperCase();
    }

    organization.updatedAt =
        new Date().toISOString();

    ORGANIZATIONS.set(
        organization.id,
        organization
    );

    return organization;

}

function deleteOrganization(id) {

    const normalizedId =
        normalizeOrganizationId(id);

    if (!normalizedId) {
        return false;
    }

    return ORGANIZATIONS.delete(
        normalizedId
    );

}

function listOrganizations() {

    return Array.from(
        ORGANIZATIONS.values()
    );

}

function isOrganizationActive(id) {

    const organization =
        getOrganization(id);

    return Boolean(
        organization &&
        organization.status === 'ACTIVE'
    );

}

function seedDefaultOrganizations() {

    const defaults = [

        {
            id: 'NEOM',
            name: 'NEOM',
            type: 'ENTERPRISE',
            status: 'ACTIVE'
        },

        {
            id: 'SPACEX',
            name: 'SpaceX',
            type: 'ENTERPRISE',
            status: 'ACTIVE'
        },

        {
            id: 'SUPREME',
            name: 'SUPREME Platform',
            type: 'PLATFORM',
            status: 'ACTIVE'
        }

    ];

    for (const organization of defaults) {

        if (
            !organizationExists(
                organization.id
            )
        ) {
            createOrganization(
                organization
            );
        }

    }

}

seedDefaultOrganizations();

module.exports = {

    normalizeOrganizationId,

    createOrganization,

    getOrganization,

    organizationExists,

    updateOrganization,

    deleteOrganization,

    listOrganizations,

    isOrganizationActive,

    seedDefaultOrganizations

};
