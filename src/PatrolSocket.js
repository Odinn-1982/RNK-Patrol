/**
 * RNK Patrol - Socket Handler
 * Manages GM/Player communication for patrol synchronization
 */

import { MODULE_ID } from './main.js';

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
    
    // Data sync
    SYNC_PATROL: 'syncPatrol',
    SYNC_ALL: 'syncAll',
    REQUEST_SYNC: 'requestSync',
    
    // Alerts
    DETECTION_ALERT: 'detectionAlert'
};

export class PatrolSocket {
    static socketName = `module.${MODULE_ID}`;
    
    /**
     * Initialize the socket handler
     * @param {PatrolManager} manager - The patrol manager instance
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
