'use strict';

const ENTERPRISE_FEATURES = Object.freeze({
    NEOM_COMMAND_CENTER: {
        id: 'neom-command-center',
        name: 'NEOM Command Center',
        organization: 'NEOM',
        access: ['NEOM']
    },

    SPACEX_MISSION_CONTROL: {
        id: 'spacex-mission-control',
        name: 'SpaceX Mission Control',
        organization: 'SpaceX',
        access: ['SPACEX']
    }
});

function normalizeOrganization(value) {
    if (!value) {
        return null;
    }

    return String(value)
        .trim()
        .toUpperCase();
}

function getOrganization(req) {
    if (!req.auth) {
        return null;
    }

    return normalizeOrganization(
        req.auth.organization
    );
}

function canAccessFeature(organization, feature) {
    if (!feature) {
        return false;
    }

    return feature.access.includes(
        normalizeOrganization(organization)
    );
}

function getAvailableFeatures(organization) {
    const normalizedOrganization =
        normalizeOrganization(organization);

    return Object.values(ENTERPRISE_FEATURES)
        .filter(feature =>
            canAccessFeature(
                normalizedOrganization,
                feature
            )
        )
        .map(feature => ({
            id: feature.id,
            name: feature.name,
            organization: feature.organization,
            restricted: true
        }));
}

function requireFeature(featureKey) {
    return (req, res, next) => {
        const feature =
            ENTERPRISE_FEATURES[featureKey];

        const organization =
            getOrganization(req);

        if (!canAccessFeature(
            organization,
            feature
        )) {
            return res.status(403).json({
                error: 'ENTERPRISE_ACCESS_DENIED',
                message:
                    'This feature is restricted to authorized organizations only.',
                requestedFeature:
                    feature?.id || null
            });
        }

        req.enterpriseOrganization =
            organization;

        next();
    };
}

module.exports = {
    ENTERPRISE_FEATURES,
    getOrganization,
    getAvailableFeatures,
    canAccessFeature,
    requireFeature
};
