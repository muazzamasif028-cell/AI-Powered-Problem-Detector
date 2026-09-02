'use strict';

// ============================================
// SUPREME Organization Member Registry
// ============================================

const members = new Map();

function createMember({
    id,
    organizationId,
    userId,
    role = 'USER',
    status = 'ACTIVE',
    metadata = {}
}) {

    const memberId = String(id || '').trim();

    const normalizedOrganizationId =
        String(organizationId || '').trim();

    const normalizedUserId =
        String(userId || '').trim();

    const normalizedRole =
        String(role || 'USER')
            .trim()
            .toUpperCase();

    if (
        !memberId ||
        !normalizedOrganizationId ||
        !normalizedUserId
    ) {
        throw new Error(
            'MEMBER_ID_ORGANIZATION_ID_AND_USER_ID_REQUIRED'
        );
    }

    if (members.has(memberId)) {
        throw new Error(
            'MEMBER_ALREADY_EXISTS'
        );
    }

    const member = Object.freeze({
        id: memberId,
        organizationId:
            normalizedOrganizationId,
        userId:
            normalizedUserId,
        role:
            normalizedRole,
        status,
        metadata,
        createdAt:
            new Date().toISOString()
    });

    members.set(memberId, member);

    return member;
}

function getMember(id) {
    return members.get(
        String(id || '').trim()
    ) || null;
}

function listMembers(organizationId) {

    const normalizedOrganizationId =
        String(organizationId || '').trim();

    return Array.from(
        members.values()
    ).filter(member =>
        member.organizationId ===
        normalizedOrganizationId
    );
}

function getOrganizationMember(
    organizationId,
    userId
) {

    const normalizedOrganizationId =
        String(organizationId || '').trim();

    const normalizedUserId =
        String(userId || '').trim();

    return Array.from(
        members.values()
    ).find(member =>
        member.organizationId ===
            normalizedOrganizationId &&
        member.userId ===
            normalizedUserId
    ) || null;
}

function updateMemberRole(
    id,
    role
) {

    const memberId =
        String(id || '').trim();

    const member =
        members.get(memberId);

    if (!member) {
        return null;
    }

    const normalizedRole =
        String(role || '')
            .trim()
            .toUpperCase();

    if (!normalizedRole) {
        throw new Error(
            'ROLE_REQUIRED'
        );
    }

    const updatedMember =
        Object.freeze({
            ...member,
            role: normalizedRole,
            updatedAt:
                new Date().toISOString()
        });

    members.set(
        memberId,
        updatedMember
    );

    return updatedMember;
}

function removeMember(id) {
    return members.delete(
        String(id || '').trim()
    );
}

module.exports = {
    createMember,
    getMember,
    listMembers,
    getOrganizationMember,
    updateMemberRole,
    removeMember
};
