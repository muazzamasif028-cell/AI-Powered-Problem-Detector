'use strict';

/**
 * SUPREME PLATFORM v14.0.0 — Auth System
 *
 * Users, companies (tenants), JWT sessions, role-based permissions and an audit
 * log. Implemented on Node's built-in `crypto` only — no external JWT or bcrypt
 * dependency:
 *   - passwords use scrypt with a per-user random salt and a timing-safe compare
 *   - tokens are HS256 JWTs, signed and verified in `_sign()` / `verifyToken()`
 */

const {
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} = require('crypto');

const ROLES = Object.freeze({
  SUPER_ADMIN: {
    id: 'SUPER_ADMIN',
    rank: 3,
    permissions: [
      'platform:manage',
      'company:create',
      'company:read',
      'company:update',
      'company:delete',
      'user:create',
      'user:read',
      'user:update',
      'user:delete',
      'problem:create',
      'problem:read',
      'detection:run',
      'diagnostics:run',
      'solution:read',
      'solution:auto-apply',
      'pricing:quote',
      'satellite:read',
      'satellite:command',
      'audit:read',
      'system:read',
    ],
  },
  ADMIN: {
    id: 'ADMIN',
    rank: 2,
    permissions: [
      'company:read',
      'company:update',
      'user:create',
      'user:read',
      'user:update',
      'problem:create',
      'problem:read',
      'detection:run',
      'diagnostics:run',
      'solution:read',
      'solution:auto-apply',
      'pricing:quote',
      'satellite:read',
      'audit:read',
      'system:read',
    ],
  },
  USER: {
    id: 'USER',
    rank: 1,
    permissions: [
      'problem:create',
      'problem:read',
      'detection:run',
      'diagnostics:run',
      'solution:read',
      'pricing:quote',
      'satellite:read',
    ],
  },
});

const DEFAULT_OPTIONS = {
  jwtSecret: null,
  tokenTtlSeconds: 24 * 60 * 60,
  scryptKeyLength: 64,
  minPasswordLength: 10,
  maxFailedAttempts: 5,
  lockoutMinutes: 15,
  auditLimit: 2000,
};

class AuthSystem {
  constructor(options = {}) {
    this.name = 'AuthSystem';
    this.version = '14.0.0';
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.ready = false;
    this.startedAt = null;

    this.users = new Map();
    this.usersByEmail = new Map();
    this.companies = new Map();
    this.sessions = new Map();
    this.auditLog = [];

    this.stats = {
      registrations: 0,
      logins: 0,
      failedLogins: 0,
      lockouts: 0,
      logouts: 0,
      tokensIssued: 0,
      tokensRejected: 0,
      permissionDenials: 0,
      companiesCreated: 0,
    };
  }

  async initialize() {
    if (this.ready) {
      return this.status();
    }

    console.log('🤫 [AuthSystem] initializing authentication subsystem...');

    if (!this.options.jwtSecret) {
      this.options.jwtSecret = randomBytes(48).toString('hex');
      this.ephemeralSecret = true;
      console.log(
        '🤫 [AuthSystem] WARNING: no SESSION_SECRET provided — generated an ephemeral signing key. ' +
          'Every restart will invalidate existing tokens.'
      );
    } else {
      this.ephemeralSecret = false;
    }

    this.ready = true;
    this.startedAt = new Date();

    console.log(
      `🤫 [AuthSystem] ready — roles=${Object.keys(ROLES).join('/')} ` +
        `tokenTtl=${this.options.tokenTtlSeconds}s scrypt keyLen=${this.options.scryptKeyLength}`
    );

    return this.status();
  }

  // ------------------------------------------------------------- registration

  /**
   * Register a user. The first user of a brand-new company becomes its ADMIN;
   * SUPER_ADMIN can only be granted explicitly by another SUPER_ADMIN.
   *
   * @param {object} input
   * @param {string} input.email
   * @param {string} input.password
   * @param {string} [input.name]
   * @param {string} [input.companyName]
   * @param {string} [input.companyId]
   * @param {string} [input.role]
   * @param {object} [actor] Caller, when an existing admin creates the user.
   */
  async register(input = {}, actor = null) {
    this._assertReady();

    const email = this._normalizeEmail(input.email);
    const password = typeof input.password === 'string' ? input.password : '';

    this._validatePassword(password);

    if (this.usersByEmail.has(email)) {
      this._audit('USER_REGISTER_DUPLICATE', { email }, actor);
      const error = new Error(`An account already exists for "${email}"`);
      error.code = 'EMAIL_TAKEN';
      error.statusCode = 409;
      throw error;
    }

    const requestedRole = input.role ? String(input.role).toUpperCase() : null;
    if (requestedRole && !ROLES[requestedRole]) {
      const error = new Error(`Unknown role "${requestedRole}". Expected one of ${Object.keys(ROLES).join(', ')}`);
      error.code = 'UNKNOWN_ROLE';
      error.statusCode = 400;
      throw error;
    }

    if (requestedRole === 'SUPER_ADMIN' && (!actor || actor.role !== 'SUPER_ADMIN')) {
      this.stats.permissionDenials += 1;
      this._audit('USER_REGISTER_FORBIDDEN', { email, requestedRole }, actor);
      const error = new Error('Only a SUPER_ADMIN may create another SUPER_ADMIN');
      error.code = 'ROLE_ESCALATION_FORBIDDEN';
      error.statusCode = 403;
      throw error;
    }

    const company = this._resolveCompany(input, actor);
    const isFirstUserOfCompany = company.userCount === 0;
    const role = requestedRole || (isFirstUserOfCompany ? 'ADMIN' : 'USER');

    const { hash, salt } = this._hashPassword(password);

    const user = {
      userId: `USR-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`,
      email,
      name: typeof input.name === 'string' ? input.name.trim().slice(0, 200) : email.split('@')[0],
      role,
      permissions: [...ROLES[role].permissions],
      companyId: company.companyId,
      companyName: company.name,
      passwordHash: hash,
      passwordSalt: salt,
      status: 'ACTIVE',
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    };

    this.users.set(user.userId, user);
    this.usersByEmail.set(email, user.userId);

    company.userCount += 1;
    company.updatedAt = new Date().toISOString();

    this.stats.registrations += 1;
    this._audit('USER_REGISTERED', { userId: user.userId, email, role, companyId: company.companyId }, actor);

    console.log(
      `🤫 [AuthSystem] registered ${email} as ${role} in company ${company.name} (${company.companyId})`
    );

    return this._publicUser(user);
  }

  /** Alias matching the REST verb. */
  async signup(input, actor) {
    return this.register(input, actor);
  }

  // -------------------------------------------------------------------- login

  /**
   * Authenticate and issue a JWT session.
   *
   * @param {object} input
   * @param {string} input.email
   * @param {string} input.password
   * @param {object} [meta] Request metadata (ip, userAgent) for the audit log.
   */
  async login(input = {}, meta = {}) {
    this._assertReady();

    const email = this._normalizeEmail(input.email);
    const password = typeof input.password === 'string' ? input.password : '';

    const userId = this.usersByEmail.get(email);
    const user = userId ? this.users.get(userId) : null;

    // Same error and roughly the same work for unknown-email and wrong-password
    // so the response does not disclose which accounts exist.
    if (!user) {
      this._hashPassword(password);
      this.stats.failedLogins += 1;
      this._audit('LOGIN_FAILED', { email, reason: 'UNKNOWN_EMAIL', ...meta }, null);
      throw this._invalidCredentials();
    }

    if (user.status !== 'ACTIVE') {
      this.stats.failedLogins += 1;
      this._audit('LOGIN_FAILED', { email, reason: 'INACTIVE', ...meta }, this._publicUser(user));
      const error = new Error(`Account is ${user.status.toLowerCase()}`);
      error.code = 'ACCOUNT_INACTIVE';
      error.statusCode = 403;
      throw error;
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      this.stats.failedLogins += 1;
      this._audit('LOGIN_BLOCKED_LOCKOUT', { email, lockedUntil: user.lockedUntil, ...meta }, null);
      const error = new Error(`Account is locked until ${user.lockedUntil}`);
      error.code = 'ACCOUNT_LOCKED';
      error.statusCode = 423;
      throw error;
    }

    if (!this._verifyPassword(password, user)) {
      user.failedAttempts += 1;
      this.stats.failedLogins += 1;

      if (user.failedAttempts >= this.options.maxFailedAttempts) {
        user.lockedUntil = new Date(Date.now() + this.options.lockoutMinutes * 60 * 1000).toISOString();
        user.failedAttempts = 0;
        this.stats.lockouts += 1;
        this._audit('ACCOUNT_LOCKED', { email, lockedUntil: user.lockedUntil, ...meta }, null);
        console.log(`🤫 [AuthSystem] locked ${email} until ${user.lockedUntil}`);
      } else {
        this._audit(
          'LOGIN_FAILED',
          { email, reason: 'BAD_PASSWORD', attempt: user.failedAttempts, ...meta },
          null
        );
      }

      throw this._invalidCredentials();
    }

    user.failedAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date().toISOString();

    const session = this._createSession(user, meta);

    this.stats.logins += 1;
    this._audit('LOGIN_SUCCEEDED', { email, sessionId: session.sessionId, ...meta }, this._publicUser(user));

    console.log(`🤫 [AuthSystem] ${email} signed in — session ${session.sessionId}`);

    return {
      user: this._publicUser(user),
      token: session.token,
      tokenType: 'Bearer',
      expiresIn: this.options.tokenTtlSeconds,
      expiresAt: session.expiresAt,
      sessionId: session.sessionId,
    };
  }

  /** Alias matching the REST verb. */
  async signin(input, meta) {
    return this.login(input, meta);
  }

  /** Invalidate a session so its token stops verifying. */
  logout(token) {
    this._assertReady();

    let payload;
    try {
      payload = this.verifyToken(token);
    } catch {
      return { ok: true, alreadyInvalid: true };
    }

    const session = this.sessions.get(payload.sid);
    if (session) {
      session.status = 'REVOKED';
      session.revokedAt = new Date().toISOString();
      this.sessions.delete(payload.sid);
    }

    this.stats.logouts += 1;
    this._audit('LOGOUT', { userId: payload.sub, sessionId: payload.sid }, null);

    console.log(`🤫 [AuthSystem] session ${payload.sid} revoked`);
    return { ok: true, sessionId: payload.sid };
  }

  // ------------------------------------------------------------------- tokens

  /**
   * Verify a JWT and return its payload.
   * Throws with `statusCode` 401 on any failure.
   */
  verifyToken(token) {
    this._assertReady();

    if (typeof token !== 'string' || token.trim() === '') {
      this.stats.tokensRejected += 1;
      throw this._invalidToken('Token is missing');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      this.stats.tokensRejected += 1;
      throw this._invalidToken('Token is malformed');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const expected = this._hmac(`${encodedHeader}.${encodedPayload}`);

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      this.stats.tokensRejected += 1;
      throw this._invalidToken('Signature verification failed');
    }

    let payload;
    try {
      payload = JSON.parse(this._base64UrlDecode(encodedPayload));
    } catch {
      this.stats.tokensRejected += 1;
      throw this._invalidToken('Payload is not valid JSON');
    }

    if (!Number.isFinite(payload.exp) || payload.exp * 1000 < Date.now()) {
      this.stats.tokensRejected += 1;
      throw this._invalidToken('Token has expired');
    }

    const session = this.sessions.get(payload.sid);
    if (!session || session.status !== 'ACTIVE') {
      this.stats.tokensRejected += 1;
      throw this._invalidToken('Session is no longer active');
    }

    const user = this.users.get(payload.sub);
    if (!user || user.status !== 'ACTIVE') {
      this.stats.tokensRejected += 1;
      throw this._invalidToken('User is no longer active');
    }

    session.lastSeenAt = new Date().toISOString();

    return payload;
  }

  /** Resolve a bearer token to the full user record. */
  authenticate(token) {
    const payload = this.verifyToken(token);
    const user = this.users.get(payload.sub);
    return { user: this._publicUser(user), session: this.sessions.get(payload.sid), payload };
  }

  // -------------------------------------------------------------- permissions

  hasPermission(user, permission) {
    if (!user) {
      return false;
    }
    if (Array.isArray(user.permissions) && user.permissions.includes(permission)) {
      return true;
    }
    const role = ROLES[user.role];
    return Boolean(role && role.permissions.includes(permission));
  }

  requirePermission(user, permission) {
    if (!this.hasPermission(user, permission)) {
      this.stats.permissionDenials += 1;
      this._audit('PERMISSION_DENIED', { permission }, user);
      const error = new Error(`Missing required permission "${permission}"`);
      error.code = 'PERMISSION_DENIED';
      error.statusCode = 403;
      throw error;
    }
    return true;
  }

  // ----------------------------------------------------------------- tenants

  /**
   * Create a company / tenant.
   * @param {object} input
   * @param {object} [actor]
   */
  createCompany(input = {}, actor = null) {
    this._assertReady();

    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (name.length < 2) {
      const error = new Error('Company "name" must be at least 2 characters');
      error.code = 'INVALID_COMPANY_NAME';
      error.statusCode = 400;
      throw error;
    }

    const company = {
      companyId: `CMP-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
      name,
      tier: input.tier ? String(input.tier).toUpperCase() : 'SMALL',
      status: 'ACTIVE',
      userCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.companies.set(company.companyId, company);
    this.stats.companiesCreated += 1;
    this._audit('COMPANY_CREATED', { companyId: company.companyId, name }, actor);

    console.log(`🤫 [AuthSystem] company created — ${company.name} (${company.companyId})`);
    return company;
  }

  getCompany(companyId) {
    return this.companies.get(companyId) || null;
  }

  listCompanies() {
    return [...this.companies.values()];
  }

  listUsers(companyId = null) {
    const users = [...this.users.values()].map((user) => this._publicUser(user));
    return companyId ? users.filter((user) => user.companyId === companyId) : users;
  }

  getUser(userId) {
    const user = this.users.get(userId);
    return user ? this._publicUser(user) : null;
  }

  // ------------------------------------------------------------------- audit

  getAuditLog(limit = 100, filter = {}) {
    let entries = this.auditLog;

    if (filter.action) {
      entries = entries.filter((entry) => entry.action === filter.action);
    }
    if (filter.userId) {
      entries = entries.filter((entry) => entry.actorUserId === filter.userId);
    }
    if (filter.companyId) {
      entries = entries.filter((entry) => entry.actorCompanyId === filter.companyId);
    }

    return entries.slice(0, Math.max(0, limit));
  }

  activeSessions() {
    return [...this.sessions.values()]
      .filter((session) => session.status === 'ACTIVE')
      .map(({ token, ...rest }) => rest);
  }

  status() {
    return {
      engine: this.name,
      version: this.version,
      ready: this.ready,
      startedAt: this.startedAt,
      roles: Object.keys(ROLES),
      tokenTtlSeconds: this.options.tokenTtlSeconds,
      ephemeralSigningKey: Boolean(this.ephemeralSecret),
      counts: {
        users: this.users.size,
        companies: this.companies.size,
        activeSessions: [...this.sessions.values()].filter((session) => session.status === 'ACTIVE').length,
        auditEntries: this.auditLog.length,
      },
      stats: this.stats,
    };
  }

  async shutdown() {
    console.log(
      `🤫 [AuthSystem] shutting down — ${this.users.size} user(s), ${this.sessions.size} session(s)`
    );
    this.ready = false;
    return { engine: this.name, stopped: true };
  }

  // ---------------------------------------------------------------- internals

  _assertReady() {
    if (!this.ready) {
      throw new Error('AuthSystem used before initialize()');
    }
  }

  _normalizeEmail(email) {
    const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
      const error = new Error('A valid "email" is required');
      error.code = 'INVALID_EMAIL';
      error.statusCode = 400;
      throw error;
    }

    return normalized;
  }

  _validatePassword(password) {
    if (password.length < this.options.minPasswordLength) {
      const error = new Error(`"password" must be at least ${this.options.minPasswordLength} characters`);
      error.code = 'WEAK_PASSWORD';
      error.statusCode = 400;
      throw error;
    }

    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
    if (classes < 3) {
      const error = new Error(
        '"password" must mix at least three of: lowercase, uppercase, digits, symbols'
      );
      error.code = 'WEAK_PASSWORD';
      error.statusCode = 400;
      throw error;
    }
  }

  _hashPassword(password, existingSalt = null) {
    const salt = existingSalt || randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, this.options.scryptKeyLength).toString('hex');
    return { hash, salt };
  }

  _verifyPassword(password, user) {
    const { hash } = this._hashPassword(password, user.passwordSalt);
    const candidate = Buffer.from(hash, 'hex');
    const stored = Buffer.from(user.passwordHash, 'hex');

    if (candidate.length !== stored.length) {
      return false;
    }

    return timingSafeEqual(candidate, stored);
  }

  _resolveCompany(input, actor) {
    if (input.companyId) {
      const company = this.companies.get(input.companyId);
      if (!company) {
        const error = new Error(`Unknown companyId "${input.companyId}"`);
        error.code = 'COMPANY_NOT_FOUND';
        error.statusCode = 404;
        throw error;
      }
      return company;
    }

    if (input.companyName) {
      const existing = [...this.companies.values()].find(
        (company) => company.name.toLowerCase() === String(input.companyName).trim().toLowerCase()
      );
      if (existing) {
        return existing;
      }
      return this.createCompany({ name: input.companyName }, actor);
    }

    if (actor && actor.companyId && this.companies.has(actor.companyId)) {
      return this.companies.get(actor.companyId);
    }

    return this.createCompany({ name: `${this._normalizeEmail(input.email).split('@')[1]} workspace` }, actor);
  }

  _createSession(user, meta) {
    const sessionId = `SES-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const issuedAtSeconds = Math.floor(Date.now() / 1000);
    const expiresAtSeconds = issuedAtSeconds + this.options.tokenTtlSeconds;

    const token = this._sign({
      sub: user.userId,
      sid: sessionId,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      iat: issuedAtSeconds,
      exp: expiresAtSeconds,
      iss: 'supreme-platform',
    });

    const session = {
      sessionId,
      userId: user.userId,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      token,
      status: 'ACTIVE',
      ip: meta.ip || null,
      userAgent: meta.userAgent || null,
      issuedAt: new Date(issuedAtSeconds * 1000).toISOString(),
      expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
      lastSeenAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, session);
    this.stats.tokensIssued += 1;

    return session;
  }

  _sign(payload) {
    const header = this._base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = this._base64UrlEncode(JSON.stringify(payload));
    const signature = this._hmac(`${header}.${body}`);
    return `${header}.${body}.${signature}`;
  }

  _hmac(input) {
    return createHmac('sha256', this.options.jwtSecret).update(input).digest('base64url');
  }

  _base64UrlEncode(value) {
    return Buffer.from(value, 'utf8').toString('base64url');
  }

  _base64UrlDecode(value) {
    return Buffer.from(value, 'base64url').toString('utf8');
  }

  _publicUser(user) {
    if (!user) {
      return null;
    }
    const { passwordHash, passwordSalt, ...safe } = user;
    return safe;
  }

  _invalidCredentials() {
    const error = new Error('Invalid email or password');
    error.code = 'INVALID_CREDENTIALS';
    error.statusCode = 401;
    return error;
  }

  _invalidToken(reason) {
    const error = new Error(`Unauthorized: ${reason}`);
    error.code = 'INVALID_TOKEN';
    error.statusCode = 401;
    return error;
  }

  _audit(action, detail, actor) {
    const entry = {
      auditId: `AUD-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
      action,
      detail: detail || {},
      actorUserId: actor ? actor.userId || null : null,
      actorEmail: actor ? actor.email || null : null,
      actorRole: actor ? actor.role || null : null,
      actorCompanyId: actor ? actor.companyId || null : null,
      at: new Date().toISOString(),
    };

    this.auditLog.unshift(entry);
    if (this.auditLog.length > this.options.auditLimit) {
      this.auditLog.pop();
    }

    return entry;
  }
}

module.exports = { AuthSystem, ROLES };
module.exports.default = AuthSystem;
