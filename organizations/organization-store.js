'use strict';

// ============================================
// SUPREME Organization Store
// ============================================

const organizations = new Map();

function generateOrganizationId() {
    return 'org_' +
        Date.now().toString(36) +
        '_' +
        Math.random().toString(36).slice(2, 8);
}

function normalizeOrganizationName(name) {
    return String(name || '')
        .trim();
}

function normalizeOrganizationSlug(slug) {
    return String(slug || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function createOrganization(data = {}) {

    const name =
        normalizeOrganizationName(data.name);

    if (!name) {
        throw new Error(
            'ORGANIZATION_NAME_REQUIRED'
        );
    }

    const slug =
        normalizeOrganizationSlug(
            data.slug || name
        );

    if (!slug) {
        throw new Error(
            'ORGANIZATION_SLUG_REQUIRED'
        );
    }

    const existing =
        findOrganizationBySlug(slug);

    if (existing) {
        throw new Error(
            'ORGANIZATION_SLUG_ALREADY_EXISTS'
        );
    }

    const now =
        new Date().toISOString();

    const organization = {
        id: generateOrganizationId(),

        name,

        slug,

        status:
            data.status || 'ACTIVE',

        plan:
            data.plan || 'FREE',

        features:
            Array.isArray(data.features)
                ? data.features
                : [],

        members: [],

        createdAt: now,

        updatedAt: now
    };

    organizations.set(
        organization.id,
        organization
    );

    return organization;
}

function getOrganization(id) {
    return organizations.get(id) || null;
}

function listOrganizations() {
    return Array.from(
        organizations.values()
    );
}

function findOrganizationBySlug(slug) {

    const normalizedSlug =
        normalizeOrganizationSlug(slug);

    return listOrganizations().find(
        organization =>
            organization.slug ===
            normalizedSlug
    ) || null;
}

function updateOrganization(
    id,
    updates = {}
) {

    const organization =
        getOrganization(id);

    if (!organization) {
        return null;
    }

    if (updates.name !== undefined) {

        const name =
            normalizeOrganizationName(
                updates.name
            );

        if (!name) {
            throw new Error(
                'ORGANIZATION_NAME_REQUIRED'
            );
        }

        organization.name = name;
    }

    if (updates.slug !== undefined) {

        const slug =
            normalizeOrganizationSlug(
                updates.slug
            );

        const existing =
            findOrganizationBySlug(slug);

        if (
            existing &&
            existing.id !== id
        ) {
            throw new Error(
                'ORGANIZATION_SLUG_ALREADY_EXISTS'
            );
        }

        organization.slug = slug;
    }

    if (updates.status !== undefined) {
        organization.status =
            String(updates.status)
                .trim()
                .toUpperCase();
    }

    if (updates.plan !== undefined) {
        organization.plan =
            String(updates.plan)
                .trim()
                .toUpperCase();
    }

    if (updates.features !== undefined) {
        organization.features =
            Array.isArray(updates.features)
                ? updates.features
                : organization.features;
    }

    organization.updatedAt =
        new Date().toISOString();

    organizations.set(
        id,
        organization
    );

    return organization;
}

function deleteOrganization(id) {
    return organizations.delete(id);
}

module.exports = {
    createOrganization,
    getOrganization,
    listOrganizations,
    findOrganizationBySlug,
    updateOrganization,
    deleteOrganization
};
