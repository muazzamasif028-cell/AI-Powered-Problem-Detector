'use strict';

const organizations = new Map();

function normalizeOrganization(name) {
    if (!name) return null;

    return String(name)
        .trim()
        .toUpperCase();
}

function createOrganization({
    id,
    name,
    status = 'ACTIVE',
    metadata = {}
}) {
    const organizationId =
        String(id || '').trim();

    const organizationName =
        normalizeOrganization(name);

    if (!organizationId || !organizationName) {
        throw new Error('ORGANIZATION_ID_AND_NAME_REQUIRED');
    }

    if (organizations.has(organizationId)) {
        throw new Error('ORGANIZATION_ALREADY_EXISTS');
    }

    const organization = Object.freeze({
        id: organizationId,
        name: organizationName,
        status,
        metadata,
        createdAt: new Date().toISOString()
    });

    organizations.set(
        organizationId,
        organization
    );

    return organization;
}

function getOrganization(id) {
    return organizations.get(
        String(id).trim()
    ) || null;
}

function getOrganizationByName(name) {
    const normalized =
        normalizeOrganization(name);

    for (const organization of organizations.values()) {
        if (organization.name === normalized) {
            return organization;
        }
    }

    return null;
}

function listOrganizations() {
    return Array.from(
        organizations.values()
    );
}

function organizationExists(name) {
    return Boolean(
        getOrganizationByName(name)
    );
}

function removeOrganization(id) {
    return organizations.delete(
        String(id).trim()
    );
}

module.exports = {
    createOrganization,
    getOrganization,
    getOrganizationByName,
    listOrganizations,
    organizationExists,
    removeOrganization,
    normalizeOrganization
};
