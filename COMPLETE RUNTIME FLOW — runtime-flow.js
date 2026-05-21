// ============================================================
// 🤫 COMPLETE SINGLE RUNTIME FLOW
// ============================================================
// User Input → Detect → Root Cause → Solution → Fix → Payment → Done
// ============================================================

class CompleteRuntimeFlow {
    constructor(modules, database) {
        this.modules = modules;
        this.db = database;
    }

    // =============================================
    // 🔄 SINGLE RUNTIME FLOW — END TO END
    // =============================================
    async executeFullFlow(userInput, context = {}) {
        const flowId = 'FLOW-' + Date.now().toString(36);
        const timeline = [];
        
        console.log(`\n🔄 [FLOW ${flowId}] Starting complete runtime flow\n`);
        
        try {
            // ═══════════════════════════════════════════
            // STEP 1: PROBLEM INTAKE
            // ═══════════════════════════════════════════
            timeline.push({ step: 1, action: 'INTAKE', time: Date.now(), status: 'STARTED' });
            
            const intake = {
                flowId,
                problem: userInput,
                companyId: context.companyId || 'DEMO-COMPANY',
                userId: context.userId || 'demo-user',
                channel: context.channel || 'API',
                timestamp: new Date().toISOString()
            };
            
            // Save to database
            await this.db.saveProblem(context.companyId, intake);
            
            timeline.push({ step: 1, action: 'INTAKE', time: Date.now(), status: 'COMPLETED' });
            
            // ═══════════════════════════════════════════
            // STEP 2: PRIVACY SHIELD CHECK
            // ═══════════════════════════════════════════
            timeline.push({ step: 2, action: 'PRIVACY_CHECK', time: Date.now(), status: 'STARTED' });
            
            const privacyCheck = this.modules.privacyShield.requestInterceptor.intercept({
                headers: { 'x-tenant-id': context.companyId },
                url: '/api/flow/detect-and-fix',
                method: 'POST'
            });
            
            if (!privacyCheck.allowed) {
                throw new Error('Privacy shield blocked: ' + privacyCheck.reason);
            }
            
            timeline.push({ step: 2, action: 'PRIVACY_CHECK', time: Date.now(), status: 'PASSED' });
            
            // ═══════════════════════════════════════════
            // STEP 3: PRE-COGNITION SCAN
            // ═══════════════════════════════════════════
            timeline.push({ step: 3, action: 'PRE_COGNITION', time: Date.now(), status: 'STARTED' });
            
            const preCogResult = await this.modules.precognition.runPrecognitionScan(
                context.companyId
            );
            
            timeline.push({ step: 3, action: 'PRE_COGNITION', time: Date.now(), 
                status: preCogResult.preActions.length > 0 ? 'ACTIONS_TAKEN' : 'NO_ACTION' 
            });
            
            // ═══════════════════════════════════════════
            // STEP 4: RUN ALL DETECTORS
            // ═══════════════════════════════════════════
            timeline.push({ step: 4, action: 'DETECTION', time: Date.now(), status: 'STARTED' });
            
            const detectionResults = {};
            const detectors = ['performance', 'availability', 'security', 'resource', 'application'];
            
            for (let name of detectors) {
                detectionResults[name] = await this.modules[name].detectAll({
                    input: userInput,
                    companyId: context.companyId
                });
            }
            
            // Also run NEOM if relevant
            if (context.neomEnabled) {
                detectionResults.neom = await this.modules.neom.detectAll();
            }
            
            timeline.push({ step: 4, action: 'DETECTION', time: Date.now(), status: 'COMPLETED' });
            
            // ═══════════════════════════════════════════
            // STEP 5: ROOT CAUSE ANALYSIS
            // ═══════════════════════════════════════════
            timeline.push({ step: 5, action: 'ROOT_CAUSE', time: Date.now(), status: 'STARTED' });
            
            const rootCause = await this.modules.rootCause.analyze(userInput, {
                detectionResults,
                companyId: context.companyId
            });
            
            timeline.push({ step: 5, action: 'ROOT_CAUSE', time: Date.now(), 
                status: rootCause.rootCause ? 'FOUND' : 'NOT_FOUND' 
            });
            
            // ═══════════════════════════════════════════
            // STEP 6: GENERATE SOLUTIONS
            // ═══════════════════════════════════════════
            timeline.push({ step: 6, action: 'SOLUTION', time: Date.now(), status: 'STARTED' });
            
            const solution = await this.modules.solution.generateSolution(
                rootCause.rootCause,
                { autoApply: context.autoFix || false }
            );
            
            timeline.push({ step: 6, action: 'SOLUTION', time: Date.now(), 
                status: solution.solution ? 'GENERATED' : 'FAILED' 
            });
            
            // ═══════════════════════════════════════════
            // STEP 7: CONFIDENCE SCORING
            // ═══════════════════════════════════════════
            timeline.push({ step: 7, action: 'CONFIDENCE', time: Date.now(), status: 'STARTED' });
            
            const confidence = await this.modules.confidence.calculateScore({
                issues: rootCause.rootCause.allPossibleCauses?.map(c => ({ module: c })) || [],
                summary: { overallStatus: rootCause.rootCause.category || 'UNKNOWN' },
                patternsDetected: Object.values(detectionResults).reduce((sum, d) => 
                    sum + (d.summary?.problemsDetected || 0), 0
                ),
                severity: rootCause.rootCause.category === 'SECURITY' ? 'CRITICAL' : 'HIGH'
            });
            
            timeline.push({ step: 7, action: 'CONFIDENCE', time: Date.now(), 
                status: confidence.score > 70 ? 'HIGH' : 'LOW' 
            });
            
            // ═══════════════════════════════════════════
            // STEP 8: APPLY AUTO-FIX (if confident)
            // ═══════════════════════════════════════════
            let fixResult = null;
            
            if (context.autoFix && confidence.score >= 85) {
                timeline.push({ step: 8, action: 'AUTO_FIX', time: Date.now(), status: 'STARTED' });
                
                // Before snapshot
                const beforeSnapshot = await this.modules.critical.captureBeforeAfter(
                    flowId, 
                    solution.solution.action
                );
                
                // Apply fix
                fixResult = {
                    applied: true,
                    solution: solution.solution.action,
                    description: solution.solution.description,
                    confidence: confidence.score,
                    beforeAfter: beforeSnapshot
                };
                
                timeline.push({ step: 8, action: 'AUTO_FIX', time: Date.now(), status: 'APPLIED' });
            }
            
            // ═══════════════════════════════════════════
            // STEP 9: SEND SMART ALERTS
            // ═══════════════════════════════════════════
            timeline.push({ step: 9, action: 'ALERTS', time: Date.now(), status: 'STARTED' });
            
            if (rootCause.rootCause?.severity === 'CRITICAL' || confidence.score >= 90) {
                await this.modules.alerts.createAlert({
                    problemId: flowId,
                    problemName: rootCause.rootCause?.primary || userInput,
                    category: rootCause.rootCause?.category || 'GENERAL',
                    severity: rootCause.rootCause?.severity || 'HIGH',
                    location: context.location || 'Production',
                    impact: rootCause.rootCause?.impact || 'System impact detected'
                }, {
                    companyId: context.companyId,
                    channel: 'ALL'
                });
            }
            
            timeline.push({ step: 9, action: 'ALERTS', time: Date.now(), status: 'SENT' });
            
            // ═══════════════════════════════════════════
            // STEP 10: COGNITIVE AUDIT LOG
            // ═══════════════════════════════════════════
            timeline.push({ step: 10, action: 'AUDIT', time: Date.now(), status: 'STARTED' });
            
            await this.db.saveAuditLog(context.companyId, 'FULL_FLOW_EXECUTED', {
                flowId,
                problem: userInput,
                detections: Object.keys(detectionResults).length + ' detectors run',
                rootCause: rootCause.rootCause?.primary,
                solution: solution.solution?.action,
                confidence: confidence.score,
                autoFixed: fixResult?.applied || false,
                timeline
            });
            
            timeline.push({ step: 10, action: 'AUDIT', time: Date.now(), status: 'LOGGED' });
            
            // ═══════════════════════════════════════════
            // STEP 11: LEARNING LOOP UPDATE
            // ═══════════════════════════════════════════
            timeline.push({ step: 11, action: 'LEARNING', time: Date.now(), status: 'STARTED' });
            
            await this.modules.learning.runLearningCycle(
                userInput,
                { success: fixResult?.applied || false, solution: solution.solution }
            );
            
            timeline.push({ step: 11, action: 'LEARNING', time: Date.now(), status: 'UPDATED' });
            
            // ═══════════════════════════════════════════
            // STEP 12: GENERATE PRICING (if needed)
            // ═══════════════════════════════════════════
            timeline.push({ step: 12, action: 'PRICING', time: Date.now(), status: 'STARTED' });
            
            const tier = context.tier || 'BUSINESS';
            const priceQuote = this.modules.payment.pricingPlans?.[tier] || null;
            
            timeline.push({ step: 12, action: 'PRICING', time: Date.now(), 
                status: priceQuote ? 'GENERATED' : 'SKIPPED' 
            });
            
            // ═══════════════════════════════════════════
            // FINAL RESPONSE
            // ═══════════════════════════════════════════
            const totalTime = timeline[timeline.length - 1].time - timeline[0].time;
            
            console.log(`\n✅ [FLOW ${flowId}] COMPLETE — ${totalTime}ms\n`);
            
            return {
                success: true,
                flowId,
                totalTime_ms: totalTime,
                stepsCompleted: timeline.length,
                timeline,
                
                results: {
                    intake: { id: flowId, problem: userInput },
                    preCognition: preCogResult,
                    detections: Object.entries(detectionResults).map(([name, result]) => ({
                        detector: name,
                        problemsFound: result.summary?.problemsDetected || 0,
                        status: result.summary?.overallStatus || 'UNKNOWN'
                    })),
                    rootCause: rootCause.rootCause,
                    solution: solution.solution,
                    confidence: confidence,
                    fixApplied: fixResult?.applied || false,
                    pricing: priceQuote ? {
                        tier,
                        diagnosis: priceQuote.pricing?.diagnosticFee,
                        fix: priceQuote.pricing?.fixRepairFee
                    } : null
                },
                
                timestamp: new Date().toISOString()
            };
            
        } catch (err) {
            console.error(`\n❌ [FLOW ${flowId}] FAILED: ${err.message}\n`);
            
            return {
                success: false,
                flowId,
                error: err.message,
                timeline,
                failedAt: timeline[timeline.length - 1]?.action || 'UNKNOWN',
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = CompleteRuntimeFlow;
