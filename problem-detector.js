'use strict';

/**
 * SUPREME AI Problem Detector
 *
 * Detects and classifies technical problems.
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

    analyze(input) {
        const text = input.toLowerCase();

        const rules = [
            {
                category: 'DATABASE',
                type: 'database-problem',
                severity: 'HIGH',
                confidence: 0.95,
                keywords: [
                    'database',
                    'sql',
                    'mongodb',
                    'postgres',
                    'mysql',
                    'connection failed'
                ],
                possibleCauses: [
                    'Database server is unavailable',
                    'Invalid database credentials',
                    'Incorrect connection configuration'
                ],
                recommendedActions: [
                    'Check database server status',
                    'Verify database credentials',
                    'Check connection configuration'
                ]
            },
            {
                category: 'AUTHENTICATION',
                type: 'authentication-problem',
                severity: 'HIGH',
                confidence: 0.94,
                keywords: [
                    'unauthorized',
                    'authentication',
                    'token',
                    'jwt',
                    'login failed',
                    'access denied'
                ],
                possibleCauses: [
                    'Invalid authentication token',
                    'Expired token',
                    'Invalid credentials'
                ],
                recommendedActions: [
                    'Check authentication token',
                    'Verify token expiration',
                    'Check authentication middleware'
                ]
            },
            {
                category: 'APPLICATION',
                type: 'application-problem',
                severity: 'CRITICAL',
                confidence: 0.92,
                keywords: [
                    'crashing',
                    'crash',
                    'not working',
                    'runtime error',
                    'application stopped'
                ],
                possibleCauses: [
                    'Unhandled application error',
                    'Runtime exception',
                    'Missing dependency'
                ],
                recommendedActions: [
                    'Check application logs',
                    'Inspect the error stack trace',
                    'Verify installed dependencies'
                ]
            },
            {
                category: 'NETWORK',
                type: 'network-problem',
                severity: 'HIGH',
                confidence: 0.91,
                keywords: [
                    'network',
                    'timeout',
                    'connection refused',
                    'dns',
                    'network error'
                ],
                possibleCauses: [
                    'Network connectivity problem',
                    'Service unavailable',
                    'Firewall or port problem'
                ],
                recommendedActions: [
                    'Check network connectivity',
                    'Check service availability',
                    'Verify ports and firewall rules'
                ]
            }
        ];

        for (const rule of rules) {
            const matchedKeywords = rule.keywords.filter(keyword =>
                text.includes(keyword)
            );

            if (matchedKeywords.length > 0) {
                return {
                    ...rule,
                    matchedKeywords
                };
            }
        }

        return {
            category: 'GENERAL',
            type: 'unknown-problem',
            severity: 'MEDIUM',
            confidence: 0.60,
            keywords: [],
            matchedKeywords: [],
            possibleCauses: [
                'Insufficient information available'
            ],
            recommendedActions: [
                'Provide more details about the problem',
                'Check system logs'
            ]
        };
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
            detected: analysis.type !== 'unknown-problem',
            type: analysis.type,
            category: analysis.category,
            severity: analysis.severity,
            confidence: analysis.confidence,
            input: value,
            matchedKeywords: analysis.matchedKeywords,
            possibleCauses: analysis.possibleCauses,
            recommendedActions: analysis.recommendedActions,
            detectionId: `DET-${this.detections}`,
            timestamp: new Date().toISOString()
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
