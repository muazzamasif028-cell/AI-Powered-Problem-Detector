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

    analyzeProblem(value) {
        const text = value.toLowerCase();

        if (
            text.includes('database') ||
            text.includes('sql') ||
            text.includes('connection failed') ||
            text.includes('mongodb') ||
            text.includes('postgres')
        ) {
            return {
                category: 'DATABASE',
                severity: 'HIGH',
                confidence: 0.95,
                suggestion: 'Check database connection, credentials, server status, and connection configuration.'
            };
        }

        if (
            text.includes('unauthorized') ||
            text.includes('authentication') ||
            text.includes('token') ||
            text.includes('login failed') ||
            text.includes('forbidden')
        ) {
            return {
                category: 'AUTHENTICATION',
                severity: 'HIGH',
                confidence: 0.94,
                suggestion: 'Check authentication tokens, credentials, permissions, and session configuration.'
            };
        }

        if (
            text.includes('crash') ||
            text.includes('crashing') ||
            text.includes('not working') ||
            text.includes('application failed')
        ) {
            return {
                category: 'APPLICATION',
                severity: 'CRITICAL',
                confidence: 0.92,
                suggestion: 'Check application logs, runtime errors, dependencies, and recent code changes.'
            };
        }

        if (
            text.includes('network') ||
            text.includes('timeout') ||
            text.includes('connection refused') ||
            text.includes('dns')
        ) {
            return {
                category: 'NETWORK',
                severity: 'HIGH',
                confidence: 0.91,
                suggestion: 'Check network connectivity, DNS configuration, ports, firewall, and service availability.'
            };
        }

        if (
            text.includes('slow') ||
            text.includes('performance') ||
            text.includes('lag') ||
            text.includes('memory')
        ) {
            return {
                category: 'PERFORMANCE',
                severity: 'MEDIUM',
                confidence: 0.88,
                suggestion: 'Check CPU, memory usage, database queries, and application performance metrics.'
            };
        }

        return {
            category: 'UNKNOWN',
            severity: 'LOW',
            confidence: 0.5,
            suggestion: 'More information is required to accurately classify this problem.'
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

        const analysis = this.analyzeProblem(value);

        return {
            detected: true,
            type: 'problem',
            input: value,

            category: analysis.category,
            severity: analysis.severity,
            confidence: analysis.confidence,
            suggestion: analysis.suggestion,

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
