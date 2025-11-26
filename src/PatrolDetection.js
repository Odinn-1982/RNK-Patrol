/**
 * RNK Patrol - Detection System
 * Handles token detection for patrols
 */

import { MODULE_ID, ALERT_STATES } from './main.js';

export class PatrolDetection {
    /**
     * Check for detected tokens within range of a patrol token
     * @param {Token} patrolToken - The patrol token doing the detecting
     * @param {number} radius - Detection radius in grid units
     * @param {Object} options - Detection options
     * @returns {Token[]} Array of detected tokens
     */
    static detectTokens(patrolToken, radius, options = {}) {
        if (!patrolToken || !canvas.tokens) return [];
        
        const {
            excludeHidden = true,
            excludeFriendly = true,
            excludeNPC = false,
            requireLineOfSight = false
        } = options;

        const detectedTokens = [];
        const gridSize = canvas.grid.size;
        const detectionDistance = radius * gridSize;
        
        // Get patrol token center
        const patrolCenter = {
            x: patrolToken.center.x,
            y: patrolToken.center.y
        };

        // Check all tokens on the scene
        for (const token of canvas.tokens.placeables) {
            // Skip self
            if (token.id === patrolToken.id) continue;

            // Skip hidden tokens if configured
            if (excludeHidden && token.document.hidden) continue;

            // Skip friendly tokens if configured
            if (excludeFriendly && this._isFriendly(patrolToken, token)) continue;

            // Skip NPCs if configured
            if (excludeNPC && !token.actor?.hasPlayerOwner) continue;

            // Calculate distance
            const tokenCenter = { x: token.center.x, y: token.center.y };
            const distance = Math.hypot(
                tokenCenter.x - patrolCenter.x,
                tokenCenter.y - patrolCenter.y
            );

            if (distance <= detectionDistance) {
                // Check line of sight if required
                if (requireLineOfSight) {
                    if (!this._hasLineOfSight(patrolCenter, tokenCenter)) {
                        continue;
                    }
                }

                detectedTokens.push(token);
            }
        }

        return detectedTokens;
    }

    /**
     * Check if two tokens are considered friendly
     * @param {Token} tokenA 
     * @param {Token} tokenB 
     * @returns {boolean}
     */
    static _isFriendly(tokenA, tokenB) {
        const dispositionA = tokenA.document.disposition;
        const dispositionB = tokenB.document.disposition;
        
        // Both friendly or both hostile = friendly to each other
        if (dispositionA === dispositionB) return true;
        
        // Neutral is friendly to everyone for patrol purposes
        if (dispositionA === 0 || dispositionB === 0) return true;

        return false;
    }

    /**
     * Check line of sight between two points
     * @param {Object} origin - {x, y}
     * @param {Object} target - {x, y}
     * @returns {boolean}
     */
    static _hasLineOfSight(origin, target) {
        // Use Foundry's built-in wall collision detection
        if (!canvas.walls) return true;

        const ray = new Ray(origin, target);
        const collisions = canvas.walls.checkCollision(ray, { 
            type: 'sight', 
            mode: 'any' 
        });

        return !collisions;
    }

    /**
     * Get detection action handler
     * @param {string} action - The action type
     * @returns {Function}
     */
    static getActionHandler(action) {
        const handlers = {
            none: () => {},
            alert: this._handleAlert.bind(this),
            pause: this._handlePause.bind(this),
            pursue: this._handlePursue.bind(this),
            macro: this._handleMacro.bind(this)
        };

        return handlers[action] || handlers.none;
    }

    /**
     * Handle alert action
     * @param {Patrol} patrol - The patrol that detected
     * @param {Token[]} detectedTokens - Detected tokens
     * @param {Object} options - Additional options
     */
    static async _handleAlert(patrol, detectedTokens, options = {}) {
        // Set patrol to alert state
        patrol.setAlertState(ALERT_STATES.ALERT);

        // Fire hook for other modules
        Hooks.callAll(`${MODULE_ID}.alert`, patrol, detectedTokens);

        // Show notification to GM
        if (game.user.isGM) {
            const patrolName = patrol.name;
            const targetNames = detectedTokens.map(t => t.name).join(', ');
            ui.notifications.warn(
                game.i18n.format('rnk-patrol.detection.alertRaised', { 
                    patrol: patrolName 
                })
            );
        }

        // Visual indicator on patrol token
        const token = patrol.getToken();
        if (token) {
            this._showAlertIndicator(token);
        }
    }

    /**
     * Handle pause action
     * @param {Patrol} patrol 
     * @param {Token[]} detectedTokens 
     * @param {Object} options 
     */
    static async _handlePause(patrol, detectedTokens, options = {}) {
        patrol.pause();
        patrol.setAlertState(ALERT_STATES.INVESTIGATING);

        if (game.user.isGM) {
            ui.notifications.info(
                game.i18n.format('rnk-patrol.detection.detected', {
                    patrol: patrol.name,
                    target: detectedTokens[0]?.name || 'unknown'
                })
            );
        }
    }

    /**
     * Handle pursue action
     * @param {Patrol} patrol 
     * @param {Token[]} detectedTokens 
     * @param {Object} options 
     */
    static async _handlePursue(patrol, detectedTokens, options = {}) {
        if (!detectedTokens.length) return;

        patrol.setAlertState(ALERT_STATES.COMBAT);

        // Get the patrol token
        const patrolToken = patrol.getToken();
        if (!patrolToken) return;

        // Target the first detected token
        const target = detectedTokens[0];
        
        // Fire hook for pursuit
        Hooks.callAll(`${MODULE_ID}.pursue`, patrol, target);

        if (game.user.isGM) {
            ui.notifications.warn(
                game.i18n.format('rnk-patrol.detection.pursuing', {
                    patrol: patrol.name,
                    target: target.name
                })
            );
        }

        // Move patrol token toward target (for walk/hybrid modes)
        if (patrol.mode !== 'blink') {
            const targetPos = { x: target.x, y: target.y };
            // This would integrate with the patrol's movement system
            patrol.setPursuitTarget(targetPos);
        }
    }

    /**
     * Handle macro action
     * @param {Patrol} patrol 
     * @param {Token[]} detectedTokens 
     * @param {Object} options 
     */
    static async _handleMacro(patrol, detectedTokens, options = {}) {
        const { macroId } = options;
        if (!macroId) return;

        const macro = game.macros.get(macroId);
        if (!macro) {
            console.warn(`${MODULE_ID} | Detection macro not found: ${macroId}`);
            return;
        }

        // Execute the macro with context
        try {
            await macro.execute({
                patrol: patrol,
                patrolToken: patrol.getToken(),
                detectedTokens: detectedTokens,
                alertState: patrol.alertState
            });
        } catch (error) {
            console.error(`${MODULE_ID} | Error executing detection macro:`, error);
        }
    }

    /**
     * Show visual alert indicator on token
     * @param {Token} token 
     */
    static _showAlertIndicator(token) {
        if (!token?.mesh) return;

        // Create alert effect using PIXI
        const alert = new PIXI.Graphics();
        alert.lineStyle(3, 0xff0000, 0.8);
        alert.drawCircle(0, 0, token.w * 0.6);
        
        // Position at token center
        alert.x = token.w / 2;
        alert.y = token.h / 2;
        
        token.addChild(alert);

        // Animate the alert
        const duration = 2000;
        const startTime = performance.now();

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = elapsed / duration;

            if (progress >= 1) {
                token.removeChild(alert);
                alert.destroy();
                return;
            }

            // Pulse effect
            const scale = 1 + Math.sin(progress * Math.PI * 4) * 0.2;
            alert.scale.set(scale);
            alert.alpha = 1 - progress;

            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }

    /**
     * Calculate detection coverage area for visualization
     * @param {Token} token 
     * @param {number} radius 
     * @returns {PIXI.Graphics}
     */
    static createDetectionVisual(token, radius) {
        if (!token) return null;

        const gridSize = canvas.grid.size;
        const pixelRadius = radius * gridSize;

        const visual = new PIXI.Graphics();
        
        // Semi-transparent fill
        visual.beginFill(0xffff00, 0.1);
        visual.lineStyle(2, 0xffff00, 0.5);
        visual.drawCircle(0, 0, pixelRadius);
        visual.endFill();

        // Position at token center
        visual.x = token.center.x;
        visual.y = token.center.y;

        return visual;
    }

    /**
     * Perform a detection check for a patrol
     * @param {Patrol} patrol 
     * @returns {Object} Detection results
     */
    static async performDetectionCheck(patrol) {
        if (!patrol.detectEnabled) {
            return { detected: false, tokens: [] };
        }

        const token = patrol.getToken();
        if (!token) {
            return { detected: false, tokens: [] };
        }

        const currentWaypoint = patrol.getCurrentWaypoint();
        const radius = currentWaypoint?.detectionRadius || 
                      game.settings.get(MODULE_ID, 'defaultDetectionRadius');

        const detectedTokens = this.detectTokens(token, radius, {
            excludeHidden: true,
            excludeFriendly: true,
            requireLineOfSight: currentWaypoint?.requireLineOfSight ?? false
        });

        if (detectedTokens.length > 0) {
            // Fire detection hook
            Hooks.callAll(`${MODULE_ID}.detection`, patrol, detectedTokens);

            // Handle the detection action
            const action = patrol.detectionAction || 'alert';
            const handler = this.getActionHandler(action);
            await handler(patrol, detectedTokens, { 
                macroId: patrol.detectionMacro 
            });

            return { detected: true, tokens: detectedTokens };
        }

        return { detected: false, tokens: [] };
    }
}
