'use strict';

const express = require('express');

const {
    authenticateToken
} = require('../../security/auth/jwt-auth');

const {
    requireOrganizationMember
} = require('../security/require-organization-member');

const {
    requireOrganizationPermission
} = require('../security/require-organization-permission');

const {
    preventRoleEscalation
} = require('../security/prevent-role-escalation');

const {
    requireNEOMPolicy
} = require('../security/require-neom-policy');

const {
    createMember,
    getMember,
    listMembers,
    getOrganizationMember,
    updateMemberRole,
    removeMember
} = require('./member-registry');

const router = express.Router();

// ============================================
// Bootstrap First Organization Administrator
// ============================================

router.post(
    '/bootstrap',
    authenticateToken,
    (req, res) => {

        const tokenRole =
            String(req.auth?.role || '')
                .toUpperCase();

        if (tokenRole !== 'ADMIN') {
            return res.status(403).json({
                error: 'ADMIN_ROLE_REQUIRED'
            });
        }

        const organizationId =
            String(
                req.body?.organizationId || ''
            ).trim();

        const userId =
            req.auth?.userId ||
            req.auth?.sub;

        if (!organizationId || !userId) {
            return res.status(400).json({
                error: 'ORGANIZATION_ID_AND_USER_ID_REQUIRED'
            });
        }

        const existing =
            getOrganizationMember(
                organizationId,
                userId
            );

        if (existing) {
            return res.json({
                member: existing,
                bootstrapped: false
            });
        }

        try {

            const member = createMember({
                id: `member-${userId}`,
                organizationId,
                userId,
                role: 'ADMIN',
                metadata: {
                    bootstrap: true
                }
            });

            return res.status(201).json({
                member,
                bootstrapped: true
            });

        } catch (error) {

            return res.status(400).json({
                error: error.message
            });

        }

    }
);


// ============================================
// List organization members
// Protected: ACTIVE organization member
// ============================================

router.get(
    '/organization/:organizationId',
    authenticateToken,
    requireOrganizationMember(),
    (req, res) => {

        res.json({
            organizationId:
                req.params.organizationId,

            members:
                listMembers(
                    req.params.organizationId
                )
        });
    }
);

// ============================================
// Get member by ID
// ============================================

router.get(
    '/:id',
    authenticateToken,
    (req, res) => {

        const member =
            getMember(req.params.id);

        if (!member) {
            return res.status(404).json({
                error: 'MEMBER_NOT_FOUND'
            });
        }

        res.json({ member });
    }
);

// ============================================
// Get user's membership
// ============================================

router.get(
    '/organization/:organizationId/user/:userId',
    authenticateToken,
    requireOrganizationMember(),
    (req, res) => {

        const member =
            getOrganizationMember(
                req.params.organizationId,
                req.params.userId
            );

        if (!member) {
            return res.status(404).json({
                error: 'MEMBER_NOT_FOUND'
            });
        }

        res.json({ member });
    }
);

// ============================================
// Create organization member
// Protected: ADMIN / OWNER
// ============================================

router.post(
    '/',
    authenticateToken,
    requireOrganizationMember(),
    requireOrganizationPermission(
        'MEMBER_CREATE'
    ),

    preventRoleEscalation(),
    requireNEOMPolicy(),
    (req, res) => {

        try {

            const member =
                createMember({
                    id: req.body?.id,
                    organizationId:
                        req.body?.organizationId,
                    userId:
                        req.body?.userId,
                    role:
                        req.body?.role,
                    status:
                        req.body?.status,
                    metadata:
                        req.body?.metadata
                });

            return res.status(201).json({
                member
            });

        } catch (error) {

            return res.status(400).json({
                error: error.message
            });
        }
    }
);

// ============================================
// Update organization member role
// Protected: ROLE_MANAGE + hierarchy validation
// ============================================

router.patch(
    '/:id/role',

    authenticateToken,

    (req, res, next) => {

        const targetMember =
            getMember(req.params.id);

        if (!targetMember) {
            return res.status(404).json({
                error: 'MEMBER_NOT_FOUND'
            });
        }

        req.targetMember = targetMember;

        // Used by organization membership middleware
        req.body.organizationId =
            targetMember.organizationId;

        next();
    },

    requireOrganizationMember(),

    requireOrganizationPermission(
        'ROLE_MANAGE'
    ),

    preventRoleEscalation(),

    (req, res) => {

        const targetMember =
            req.targetMember;

        const actor =
            req.organizationMember;

        const {
            getRoleLevel,
            roleExists,
            normalizeRole,
            canManageRole
        } = require(
            '../roles/organization-roles'
        );

        const newRole =
            normalizeRole(req.body?.role);

        if (!roleExists(newRole)) {
            return res.status(400).json({
                error: 'INVALID_ORGANIZATION_ROLE',
                role: newRole
            });
        }

        // Actor cannot manage equal/higher member
        if (
            !canManageRole(
                actor.role,
                targetMember.role
            )
        ) {
            return res.status(403).json({
                error: 'TARGET_ROLE_MANAGEMENT_DENIED',
                actorRole: actor.role,
                targetRole: targetMember.role
            });
        }

        // Actor cannot assign equal/higher role
        if (
            getRoleLevel(newRole) >=
            getRoleLevel(actor.role)
        ) {
            return res.status(403).json({
                error: 'ROLE_ESCALATION_DENIED',
                actorRole: actor.role,
                requestedRole: newRole
            });
        }

        try {

            const updatedMember =
                updateMemberRole(
                    targetMember.id,
                    newRole
                );

            return res.json({
                member: updatedMember,
                updated: true
            });

        } catch (error) {

            return res.status(400).json({
                error: error.message
            });

        }
    }
);

// ============================================
// Remove organization member
// Protected: ADMIN / OWNER
// ============================================

router.delete(
    '/:id',
    authenticateToken,
    (req, res, next) => {

        const member =
            getMember(req.params.id);

        if (!member) {
            return res.status(404).json({
                error: 'MEMBER_NOT_FOUND'
            });
        }

        req.organizationId =
            member.organizationId;

        next();
    },
    requireOrganizationMember({
        organizationIdParam:
            'organizationId',

        allowedRoles: [
            'ADMIN',
            'OWNER'
        ]
    }),
    (req, res) => {

        const removed =
            removeMember(req.params.id);

        if (!removed) {
            return res.status(404).json({
                error: 'MEMBER_NOT_FOUND'
            });
        }

        return res.status(204).end();
    }
);

module.exports = router;
