'use strict';

/**
 * SUPREME AI Problem Detector
 *
 * Rule-based problem classification and analysis engine.
 */

class ProblemDetector {
    constructor() {
        this.initialized = false;
        this.detections = 0;
    }

    initialize() {
        this.initialized = true;
        console.log('Problem Detector initialized');
    }

    shutdown() {
        this.initialized = false;
        console.log('Problem Detector shutdown');
    }

    detect(input) {
        if (!this.initialized) {
            throw new Error('Problem Detector is not initialized');
        }

        if (input === undefined || input === null) {
            throw new TypeError('Detection input is required');
        }

        const value = typeof input === 'string'
            ? input.trim()
            : JSON.stringify(input);

        if (!value) {
            throw new TypeError('Detection input cannot be empty');
        }

        this.detections += 1;

        const analysis = this.analyze(value);

        return {
            detected: true,
            detectionId: `DET-${this.detections}`,
            input: value,

            analysis,

            timestamp: new Date().toISOString()
        };
    }

    analyze(input) {
        const text = input.toLowerCase();

        const categories = [
            {
                category: 'APPLICATION_ERROR',
                keywords: [
                    'application',
                    'app',
                    'crash',
                    'not working',
                    'error',
                    'failed'
                ],
                severity: 'HIGH',
                causes: [
                    'Application runtime failure',
                    'Configuration problem',
                    'Dependency issue'
                ],
                actions: [
                    'Check application logs',
                    'Verify environment variables',
                    'Check installed dependencies'
                ]
            },

            {
                category: 'DATABASE_ERROR',
                keywords: [
                    'database',
                    'db',
                    'sql',
                    'postgres',
                    'mongodb',
                    'connection'
                ],
                severity: 'HIGH',
                causes: [
                    'Database connection failure',
                    'Database service unavailable',
                    'Invalid database configuration'
                ],
                actions: [
                    'Check database connection',
                    'Verify database credentials',
                    'Check database service status'
                ]
            },

            {
                category: 'NETWORK_ERROR',
                keywords: [
                    'network',
                    'internet',
                    'connection refused',
                    'timeout',
                    'offline'
                ],
                severity: 'MEDIUM',
                causes: [
                    'Network connectivity issue',
                    'Remote service unavailable',
                    'Firewall restriction'
                ],
                actions: [
                    'Check network connectivity',
                    'Verify remote service availability',
                    'Check firewall configuration'
                ]
            },

            {
                category: 'SECURITY_ERROR',
                keywords: [
                    'security',
                    'unauthorized',
                    'forbidden',
                    'authentication',
                    'token',
                    'login'
                ],
                severity: 'HIGH',
                causes: [
                    'Authentication failure',
                    'Invalid security credentials',
                    'Access permission issue'
                ],
                actions: [
                    'Verify authentication credentials',
                    'Check access permissions',
                    'Validate security tokens'
                ]
            }
        ];

        for (const item of categories) {
            const matches = item.keywords.filter(keyword =>
                text.includes(keyword)
            );

            if (matches.length > 0) {
                return {
                    category: item.category,
                    severity: item.severity,
                    confidence: Math.min(
                        0.6 + matches.length * 0.1,
                        0.95
                    ),
                    matchedKeywords: matches,
                    possibleCauses: item.causes,
                    recommendedActions: item.actions
                };
            }
        }

        return {
            category: 'UNKNOWN',
            severity: 'LOW',
            confidence: 0.4,
            matchedKeywords: [],
            possibleCauses: [
                'Insufficient information to classify the problem'
            ],
            recommendedActions: [
                'Provide more detailed information',
                'Include error messages or logs'
            ]
        };
    }

    status() {
        return {
            initialized: this.initialized,
            detections: this.detections
        };
    }
}

module.exports = new ProblemDetector();
