/**
 * RNK Patrol - Socket Handler
 * Manages GM/Player communication for patrol synchronization
 */

import { MODULE_ID, emitSocket } from './main.js';

/**
 * Socket message types
 */
export const SOCKET_TYPES = {
    // Patrol state changes
    PATROL_START: 'patrolStart',
    PATROL_STOP: 'patrolStop',
    PATROL_PAUSE: 'patrolPause',
    PATROL_RESUME: 'patrolResume',
    
    // Token actions
    TOKEN_APPEAR: 'tokenAppear',
    TOKEN_DISAPPEAR: 'tokenDisappear',
    TOKEN_MOVE: 'tokenMove',
    
    // Effects
    PLAY_EFFECT: 'playEffect',
    PLAY_SOUND: 'playSound',
    PLAY_APPEAR_EFFECT: 'playAppearEffect',
    PLAY_DISAPPEAR_EFFECT: 'playDisappearEffect',
    
    // Interaction
    OPEN_INTERACTION_WINDOW: 'openInteractionWindow',
    INTERACTION_RESPONSE: 'interactionResponse',
    
    // Data sync
    SYNC_PATROL: 'syncPatrol',
    SYNC_ALL: 'syncAll',
    REQUEST_SYNC: 'requestSync',
    
    // Alerts
    DETECTION_ALERT: 'detectionAlert',
    
    // Reinforcement system
    ALERT_POPUP: 'alertPopup',
    BLEED_OUT_SAVE: 'bleedOutSave',
    BLEED_OUT_RESULT: 'bleedOutResult',
    PULL_TO_SCENE: 'pullToScene'
};

export class PatrolSocket {
    static socketName = `module.${MODULE_ID}`;
    
    /**
     * Initialize the socket handler
     * @param {PatrolManager} manager - The patrol manager instance
                
            case SOCKET_TYPES.PLAY_APPEAR_EFFECT:
                this._onPlayAppearEffect(payload);
                break;
                
            case SOCKET_TYPES.PLAY_DISAPPEAR_EFFECT:
                this._onPlayDisappearEffect(payload);
                break;
                
            case SOCKET_TYPES.OPEN_INTERACTION_WINDOW:
                this._onOpenInteractionWindow(payload);
                break;
                
            case SOCKET_TYPES.INTERACTION_RESPONSE:
                this._onInteractionResponse(payload, userId);
                break;
     */
    static initialize(manager) {
        this.manager = manager;
        
        game.socket.on(this.socketName, (data) => {
            this._handleMessage(data);
        });

        console.log(`${MODULE_ID} | Socket initialized`);
    }

    /**
     * Handle incoming socket messages
     * @param {Object} data - The message data
     */
    static _handleMessage(data) {
        const { type, payload, userId } = data;

        // Ignore messages from self
        if (userId === game.user.id) return;

        switch (type) {
            case SOCKET_TYPES.PATROL_START:
                this._onPatrolStart(payload);
                break;
                
            case SOCKET_TYPES.PATROL_STOP:
                this._onPatrolStop(payload);
                break;
                
            case SOCKET_TYPES.PATROL_PAUSE:
                this._onPatrolPause(payload);
                break;
                
            case SOCKET_TYPES.PATROL_RESUME:
                this._onPatrolResume(payload);
                break;
                
            case SOCKET_TYPES.TOKEN_APPEAR:
                this._onTokenAppear(payload);
                break;
                
            case SOCKET_TYPES.TOKEN_DISAPPEAR:
                this._onTokenDisappear(payload);
                break;
                
            case SOCKET_TYPES.TOKEN_MOVE:
                this._onTokenMove(payload);
                break;
                
            case SOCKET_TYPES.PLAY_EFFECT:
                this._onPlayEffect(payload);
                break;
                
            case SOCKET_TYPES.PLAY_SOUND:
                this._onPlaySound(payload);
                break;
                
            case SOCKET_TYPES.PLAY_APPEAR_EFFECT:
                this._onPlayAppearEffect(payload);
                break;
                
            case SOCKET_TYPES.PLAY_DISAPPEAR_EFFECT:
                this._onPlayDisappearEffect(payload);
                break;
                
            case SOCKET_TYPES.SYNC_PATROL:
                this._onSyncPatrol(payload);
                break;
                
            case SOCKET_TYPES.SYNC_ALL:
                this._onSyncAll(payload);
                break;
                
            case SOCKET_TYPES.REQUEST_SYNC:
                this._onRequestSync(payload);
                break;
                
            case SOCKET_TYPES.DETECTION_ALERT:
                this._onDetectionAlert(payload);
                break;
                
            case SOCKET_TYPES.ALERT_POPUP:
                this._onAlertPopup(payload);
                break;
                
            case SOCKET_TYPES.BLEED_OUT_SAVE:
                this._onBleedOutSave(payload);
                break;
                
            case SOCKET_TYPES.BLEED_OUT_RESULT:
                this._onBleedOutResult(payload);
                break;
                
            case SOCKET_TYPES.PULL_TO_SCENE:
                this._onPullToScene(payload);
                break;
                
            default:
                console.warn(`${MODULE_ID} | Unknown socket message type: ${type}`);
        }
    }

    /**
     * Emit a socket message
     * @param {string} type - Message type
     * @param {Object} payload - Message payload
     */
    static emit(type, payload = {}) {
        game.socket.emit(this.socketName, {
            type,
            payload,
            userId: game.user.id
        });
    }

    /**
     * Emit to GM only
     * @param {string} type 
     * @param {Object} payload 
     */
    static emitToGM(type, payload = {}) {
        // In Foundry, all socket messages go to all users
        // We include a flag for GM-only handling
        this.emit(type, { ...payload, gmOnly: true });
    }

    // ==================== Patrol State Handlers ====================

    static _onPatrolStart(payload) {
        const { patrolId } = payload;
        const patrol = this.manager?.getPatrol(patrolId);
        if (patrol && !patrol.isActive) {
            // Start without emitting (to avoid loop)
            patrol._startLocal();
        }
    }

    static _onPatrolStop(payload) {
        const { patrolId } = payload;
        const patrol = this.manager?.getPatrol(patrolId);
        if (patrol && patrol.isActive) {
            patrol._stopLocal();
        }
    }

    static _onPatrolPause(payload) {
        const { patrolId } = payload;
        const patrol = this.manager?.getPatrol(patrolId);
        if (patrol && patrol.isActive) {
            patrol._pauseLocal();
        }
    }

    static _onPatrolResume(payload) {
        const { patrolId } = payload;
        const patrol = this.manager?.getPatrol(patrolId);
        if (patrol && patrol.isPaused) {
            patrol._resumeLocal();
        }
    }

    // ==================== Token Action Handlers ====================

    static _onTokenAppear(payload) {
        const { patrolId, waypointId, position, effectType } = payload;
        
        // Only handle if we're not the GM (GM handles this locally)
        if (game.user.isGM) return;

        const patrol = this.manager?.getPatrol(patrolId);
        if (!patrol) return;

        const token = patrol.getToken();
        if (!token) return;

        // Play appear effect
        const PatrolEffects = game.modules.get(MODULE_ID)?.api?.effects;
        if (PatrolEffects) {
            PatrolEffects.playAppearEffect(token, effectType);
        }

        // Update token visibility
        token.document.update({ hidden: false });
    }

    static _onTokenDisappear(payload) {
        const { patrolId, effectType } = payload;
        
        if (game.user.isGM) return;

        const patrol = this.manager?.getPatrol(patrolId);
        if (!patrol) return;

        const token = patrol.getToken();
        if (!token) return;

        // Play disappear effect
        const PatrolEffects = game.modules.get(MODULE_ID)?.api?.effects;
        if (PatrolEffects) {
            PatrolEffects.playDisappearEffect(token, effectType);
        }
    }

    static _onTokenMove(payload) {
        const { patrolId, position, animate } = payload;
        
        if (game.user.isGM) return;

        const patrol = this.manager?.getPatrol(patrolId);
        if (!patrol) return;

        const token = patrol.getToken();
        if (!token) return;

        // Move token
        if (animate) {
            token.document.update({ x: position.x, y: position.y });
        } else {
            token.document.update({ x: position.x, y: position.y }, { animate: false });
        }
    }

    // ==================== Effect Handlers ====================

    static _onPlayEffect(payload) {
        const { tokenId, effectType, options } = payload;
        
        const token = canvas.tokens?.get(tokenId);
        if (!token) return;

        const PatrolEffects = game.modules.get(MODULE_ID)?.api?.effects;
        if (PatrolEffects) {
            PatrolEffects.playEffect(token, effectType, options);
        }
    }

    static _onPlaySound(payload) {
        const { soundPath, volume, position } = payload;
        
        // Use Foundry's audio system
        AudioHelper.play({
            src: soundPath,
            volume: volume || 0.5,
            autoplay: true,
            loop: false
        }, false);
    }
    
    /**
     * Handle appear effect from GM - play the effect locally for players
     */
    static _onPlayAppearEffect(payload) {
        const { x, y, effectType, color, tokenId } = payload;
        
        // Only handle if we're not the GM (GM already played the effect)
        if (game.user.isGM) return;
        
        // Get PatrolEffects and play locally
        const PatrolEffects = game.rnkPatrol?.PatrolEffects;
        if (PatrolEffects) {
            // Play locally without broadcasting (broadcast = false)
            PatrolEffects.playAppearEffect({ x, y, effectType, color, tokenId }, false);
        }
    }
    
    /**
     * Handle disappear effect from GM - play the effect locally for players
     */
    static _onPlayDisappearEffect(payload) {
        const { x, y, effectType, color, tokenId } = payload;
        
        // Only handle if we're not the GM (GM already played the effect)
        if (game.user.isGM) return;
        
        // Get PatrolEffects and play locally
        const PatrolEffects = game.rnkPatrol?.PatrolEffects;
        if (PatrolEffects) {
            // Play locally without broadcasting (broadcast = false)
            PatrolEffects.playDisappearEffect({ x, y, effectType, color, tokenId }, false);
        }
    }

    static _onOpenInteractionWindow(payload) {
        const { targetUserId, patrolName, tokenName, alertLevel } = payload;
        if (game.user.id !== targetUserId) return;

        const content = `
            <div class="rnk-patrol-interaction-dialog">
                <p>The patrol <strong>${patrolName}</strong> just detected <strong>${tokenName}</strong>.</p>
                <p>Alert Level: <strong>${alertLevel}</strong></p>
                <p>How would you like to respond?</p>
            </div>
        `;

        new Dialog({
            title: 'Patrol Encounter',
            content,
            buttons: {
                evade: {
                    label: 'Evade (Hide)',
                    callback: () => this._sendInteractionDecision(payload, 'evade')
                },
                negotiate: {
                    label: 'Negotiate',
                    callback: () => this._sendInteractionDecision(payload, 'negotiate')
                },
                surrender: {
                    label: 'Surrender',
                    callback: () => this._sendInteractionDecision(payload, 'surrender')
                }
            },
            default: 'evade'
        }).render(true);
    }

    static _sendInteractionDecision(payload, decision) {
        const { targetUserId, ...rest } = payload;
        emitSocket('interactionResponse', { ...rest, decision });
        ui.notifications.info(`You chose to ${decision}.`);
    }

    static _onInteractionResponse(payload, senderId) {
        if (!game.user.isGM) return;

        const { patrolName, tokenName, decision } = payload;
        const user = game.users.get(senderId);
        const ownerLabel = user?.name || 'Player';

        const content = `
            <p>${ownerLabel} responded to <strong>${patrolName}</strong> spotting <strong>${tokenName}</strong>.</p>
            <p>Decision: <strong>${decision}</strong></p>
        `;

        ChatMessage.create({
            speaker: { alias: patrolName },
            content
        });

        ui.notifications.info(`${tokenName} (${ownerLabel}) chose to ${decision}.`);

        Hooks.callAll('rnkPatrol.interactionResponse', payload);
    }

    // ==================== Sync Handlers ====================

    static _onSyncPatrol(payload) {
        const { patrolData } = payload;
        
        if (!this.manager) return;

        // Update local patrol data
        const patrol = this.manager.getPatrol(patrolData.id);
        if (patrol) {
            patrol.updateFromData(patrolData);
        }
    }

    static _onSyncAll(payload) {
        const { patrols } = payload;
        
        if (!this.manager || game.user.isGM) return;

        // Replace all local patrol data with synced data
        this.manager.syncFromData(patrols);
    }

    static _onRequestSync(payload) {
        const { requesterId } = payload;
        
        // Only GM responds to sync requests
        if (!game.user.isGM || !this.manager) return;

        // Send current patrol state to the requester
        const patrolsData = this.manager.getAllPatrolsData();
        this.emit(SOCKET_TYPES.SYNC_ALL, { patrols: patrolsData });
    }

    // ==================== Alert Handlers ====================

    static _onDetectionAlert(payload) {
        const { patrolId, patrolName, detectedTokenIds, alertState } = payload;

        // Show notification to all users
        if (payload.gmOnly && !game.user.isGM) return;

        // Visual/audio feedback for detection
        if (detectedTokenIds.some(id => {
            const token = canvas.tokens?.get(id);
            return token?.isOwner;
        })) {
            // One of the player's tokens was detected!
            ui.notifications.warn(
                game.i18n.format('rnk-patrol.detection.detected', {
                    patrol: patrolName,
                    target: 'you'
                })
            );
            
            // Flash the screen or play alert sound
            this._playerDetectionAlert();
        }
    }

    /**
     * Alert effect when player is detected
     */
    static _playerDetectionAlert() {
        // Screen flash effect
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: radial-gradient(circle, transparent 30%, rgba(255, 0, 0, 0.3) 100%);
            pointer-events: none;
            z-index: 9999;
            animation: detectFlash 0.5s ease-out forwards;
        `;
        
        // Add animation keyframes if not present
        if (!document.getElementById('patrol-detect-animation')) {
            const style = document.createElement('style');
            style.id = 'patrol-detect-animation';
            style.textContent = `
                @keyframes detectFlash {
                    0% { opacity: 1; }
                    100% { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 500);

        // Play alert sound if enabled
        if (game.settings.get(MODULE_ID, 'playSound')) {
            AudioHelper.play({
                src: 'sounds/notify.wav',
                volume: 0.5,
                autoplay: true,
                loop: false
            }, false);
        }
    }
    
    // ==================== Reinforcement Handlers ====================
    
    /**
     * Handle alert popup for player
     * @param {Object} payload 
     */
    static _onAlertPopup(payload) {
        const { userId, data } = payload;
        
        // Only show to targeted user
        if (userId && userId !== game.user.id) return;
        
        this._showAlertPopup(data);
    }
    
    /**
     * Show alert popup dialog
     * @param {Object} alertData 
     */
    static _showAlertPopup(alertData) {
        const content = `
            <div class="rnk-alert-popup" style="text-align: center; padding: 10px;">
                <div style="margin-bottom: 15px;">
                    <i class="fas fa-exclamation-triangle" style="color: #ff4444; font-size: 48px;"></i>
                </div>
                <h2 style="color: #ff4444; margin: 10px 0;">🚨 ALERT TRIGGERED!</h2>
                <p style="font-size: 14px;"><strong>${alertData.tokenName}</strong> has been spotted!</p>
                <div style="background: #3a1a1a; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p style="color: #ff6666; font-size: 16px; margin: 0;">
                        <i class="fas fa-users"></i> 
                        <strong>${alertData.reinforcementCount}</strong> reinforcements incoming!
                    </p>
                </div>
                <p style="color: #ffaa00;">
                    <i class="fas fa-clock"></i> 
                    Arriving in <strong>2 seconds</strong>...
                </p>
            </div>
        `;
        
        // Play alert sound
        AudioHelper.play({
            src: 'sounds/lock.wav',
            volume: 0.6,
            autoplay: true,
            loop: false
        }, false);
        
        new Dialog({
            title: '🚨 Alert!',
            content,
            buttons: {
                ok: {
                    icon: '<i class="fas fa-running"></i>',
                    label: 'Run!',
                    callback: () => {}
                }
            },
            default: 'ok'
        }, {
            classes: ['rnk-patrol-dialog', 'alert-popup'],
            width: 350
        }).render(true);
    }
    
    /**
     * Handle bleed-out save prompt
     * @param {Object} payload 
     */
    static _onBleedOutSave(payload) {
        const { userId, data } = payload;
        
        // Only show to targeted user
        if (userId && userId !== game.user.id) return;
        
        this._showBleedOutSaveDialog(data);
    }
    
    /**
     * Show bleed-out save dialog
     * @param {Object} saveData 
     */
    static _showBleedOutSaveDialog(saveData) {
        const content = `
            <div class="rnk-bleedout-dialog" style="text-align: center; padding: 10px;">
                <div style="margin-bottom: 15px;">
                    <i class="fas fa-heartbeat" style="color: #cc0000; font-size: 48px; animation: pulse 1s infinite;"></i>
                </div>
                <h2 style="color: #cc0000; margin: 10px 0;">💀 DESPERATE STRUGGLE</h2>
                <p style="font-size: 14px;"><strong>${saveData.tokenName}</strong> is bleeding out!</p>
                
                <div style="background: #2a1a1a; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p style="margin: 5px 0;"><strong>Constitution Save DC:</strong> <span style="color: #ff6666; font-size: 18px;">${saveData.dc}</span></p>
                    <p style="margin: 5px 0;"><strong>Con Modifier:</strong> ${saveData.conMod >= 0 ? '+' : ''}${saveData.conMod}</p>
                    ${saveData.hasDisadvantage ? '<p style="color: #ff6666;"><i class="fas fa-minus-circle"></i> Rolling with Disadvantage</p>' : ''}
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <div style="flex: 1; background: #1a3a1a; padding: 10px; border-radius: 5px;">
                        <i class="fas fa-fist-raised" style="color: #66ff66;"></i>
                        <p style="margin: 5px 0; font-size: 12px;"><strong>Success:</strong> Keep fighting<br>(with disadvantage)</p>
                    </div>
                    <div style="flex: 1; background: #3a1a1a; padding: 10px; border-radius: 5px;">
                        <i class="fas fa-skull" style="color: #ff6666;"></i>
                        <p style="margin: 5px 0; font-size: 12px;"><strong>Failure:</strong><br>Captured!</p>
                    </div>
                </div>
            </div>
            <style>
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
            </style>
        `;
        
        // Play heartbeat sound
        AudioHelper.play({
            src: 'sounds/drums.wav',
            volume: 0.4,
            autoplay: true,
            loop: false
        }, false);
        
        new Dialog({
            title: '💀 Bleed-Out Save',
            content,
            buttons: {
                roll: {
                    icon: '<i class="fas fa-dice-d20"></i>',
                    label: 'Roll Save!',
                    callback: async () => {
                        await this._performBleedOutRoll(saveData);
                    }
                }
            },
            default: 'roll'
        }, {
            classes: ['rnk-patrol-dialog', 'bleedout-dialog'],
            width: 400
        }).render(true);
    }
    
    /**
     * Perform bleed-out roll from player side
     * @param {Object} saveData 
     */
    static async _performBleedOutRoll(saveData) {
        let roll;
        
        if (saveData.hasDisadvantage) {
            roll = await new Roll('2d20kl + @mod', { mod: saveData.conMod }).evaluate();
        } else {
            roll = await new Roll('1d20 + @mod', { mod: saveData.conMod }).evaluate();
        }
        
        // Show roll in chat
        await roll.toMessage({
            speaker: { alias: saveData.tokenName },
            flavor: `Bleed-Out Save (DC ${saveData.dc})`
        });
        
        const success = roll.total >= saveData.dc;
        
        // Send result to GM
        this.emit(SOCKET_TYPES.BLEED_OUT_RESULT, {
            tokenId: saveData.tokenId,
            tokenName: saveData.tokenName,
            rollTotal: roll.total,
            dc: saveData.dc,
            success
        });
        
        // Show result locally
        this._showBleedOutResultDialog({
            tokenName: saveData.tokenName,
            rollTotal: roll.total,
            dc: saveData.dc,
            success,
            message: success 
                ? `${saveData.tokenName} grits their teeth and keeps fighting!`
                : `${saveData.tokenName} collapses! CAPTURED!`
        });
    }
    
    /**
     * Handle bleed-out result broadcast
     * @param {Object} payload 
     */
    static _onBleedOutResult(payload) {
        const { data } = payload;
        
        // Show to everyone
        this._showBleedOutResultDialog(data);
    }
    
    /**
     * Show bleed-out result dialog
     * @param {Object} resultData 
     */
    static _showBleedOutResultDialog(resultData) {
        const bgColor = resultData.success ? '#1a3a1a' : '#3a1a1a';
        const icon = resultData.success ? 'fa-fist-raised' : 'fa-skull';
        const iconColor = resultData.success ? '#66ff66' : '#ff6666';
        const title = resultData.success ? '⚔️ STILL FIGHTING!' : '💀 CAPTURED!';
        
        const content = `
            <div style="background: ${bgColor}; padding: 20px; border-radius: 8px; text-align: center;">
                <i class="fas ${icon}" style="font-size: 64px; color: ${iconColor};"></i>
                <h2 style="color: white; margin: 15px 0;">${title}</h2>
                <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px; margin: 10px 0;">
                    <p style="color: white; font-size: 18px; margin: 0;">
                        Roll: <strong>${resultData.rollTotal}</strong> vs DC <strong>${resultData.dc}</strong>
                    </p>
                </div>
                <p style="color: #cccccc; font-style: italic; margin-top: 15px;">${resultData.message}</p>
            </div>
        `;
        
        // Play result sound
        AudioHelper.play({
            src: resultData.success ? 'sounds/dice.wav' : 'sounds/lock.wav',
            volume: 0.5,
            autoplay: true,
            loop: false
        }, false);
        
        new Dialog({
            title: resultData.success ? '⚔️ Still Standing!' : '💀 Captured!',
            content,
            buttons: {
                ok: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'OK',
                    callback: () => {}
                }
            },
            default: 'ok'
        }, {
            classes: ['rnk-patrol-dialog', 'bleedout-result'],
            width: 350
        }).render(true);
    }
    
    /**
     * Handle pull to scene command
     * @param {Object} payload 
     */
    static _onPullToScene(payload) {
        const { userId, sceneId } = payload;
        
        // Only respond if targeted
        if (userId && userId !== game.user.id) return;
        
        const scene = game.scenes.get(sceneId);
        if (scene) {
            scene.view();
        }
    }

    // ==================== Public Broadcast Methods ====================

    /**
     * Broadcast patrol start to all clients
     * @param {string} patrolId 
     */
    static broadcastPatrolStart(patrolId) {
        this.emit(SOCKET_TYPES.PATROL_START, { patrolId });
    }

    /**
     * Broadcast patrol stop to all clients
     * @param {string} patrolId 
     */
    static broadcastPatrolStop(patrolId) {
        this.emit(SOCKET_TYPES.PATROL_STOP, { patrolId });
    }

    /**
     * Broadcast token appear event
     * @param {string} patrolId 
     * @param {string} waypointId 
     * @param {Object} position 
     * @param {string} effectType 
     */
    static broadcastTokenAppear(patrolId, waypointId, position, effectType) {
        this.emit(SOCKET_TYPES.TOKEN_APPEAR, {
            patrolId,
            waypointId,
            position,
            effectType
        });
    }

    /**
     * Broadcast token disappear event
     * @param {string} patrolId 
     * @param {string} effectType 
     */
    static broadcastTokenDisappear(patrolId, effectType) {
        this.emit(SOCKET_TYPES.TOKEN_DISAPPEAR, { patrolId, effectType });
    }

    /**
     * Broadcast detection alert
     * @param {Patrol} patrol 
     * @param {Token[]} detectedTokens 
     */
    static broadcastDetection(patrol, detectedTokens) {
        this.emit(SOCKET_TYPES.DETECTION_ALERT, {
            patrolId: patrol.id,
            patrolName: patrol.name,
            detectedTokenIds: detectedTokens.map(t => t.id),
            alertState: patrol.alertState,
            gmOnly: false
        });
    }

    /**
     * Request sync from GM
     */
    static requestSync() {
        if (game.user.isGM) return; // GM doesn't need to request
        
        this.emit(SOCKET_TYPES.REQUEST_SYNC, { 
            requesterId: game.user.id 
        });
    }
}
