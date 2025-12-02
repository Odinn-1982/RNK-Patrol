/**
 * RNK Patrol - Reinforcement System
 * 
 * Handles alert-triggered reinforcements, encounter assistants,
 * and bleed-out capture mechanics.
 * 
 * @module ReinforcementSystem
 */

import { MODULE_ID, debug, warn } from './main.js'
import { getSetting } from './settings.js'
import AIService from './AI.js'
import { getAdapter } from './systemAdapters/index.js'

/**
 * Reinforcement guard variants for visual variety
 */
const GUARD_VARIANTS = [
    { name: 'Guard', tint: '#cc0000' },
    { name: 'Soldier', tint: '#0066cc' },
    { name: 'Watchman', tint: '#009933' },
    { name: 'Sentry', tint: '#996600' },
    { name: 'Enforcer', tint: '#660066' },
    { name: 'Warden', tint: '#cc6600' }
]

/**
 * ReinforcementSystem - Manages dynamic patrol reinforcements
 */
export class ReinforcementSystem {
    
    constructor() {
        /**
         * Track active reinforcement tokens
         * @type {Map<string, Object>}
         */
        this._activeReinforcements = new Map()
        
        /**
         * Track last alert time per scene for cooldown
         * @type {Map<string, number>}
         */
        this._lastAlertTime = new Map()
        
        /**
         * Track active encounter assistants
         * @type {Map<string, Object>}
         */
        this._activeAssistants = new Map()
        
        /**
         * Track bleed-out states
         * @type {Map<string, Object>}
         */
        this._bleedingTokens = new Map()
        
        /**
         * Reinforcement cooldown in milliseconds
         * @type {number}
         */
        this.ALERT_COOLDOWN = 90 * 1000 // 90 seconds
        
        /**
         * Reinforcement duration in milliseconds
         * @type {number}
         */
        this.REINFORCEMENT_DURATION = 30 * 1000 // 30 seconds
    }
    
    /**
     * Initialize the reinforcement system
     */
    initialize() {
        debug('ReinforcementSystem initialized')
        this._registerHooks()
    }
    
    /**
     * Register hooks for system events
     */
    _registerHooks() {
        // Listen for alert events
        Hooks.on(`${MODULE_ID}.alert`, this._onAlert.bind(this))
        
        // Listen for capture combat start
        Hooks.on(`${MODULE_ID}.captureStart`, this._onCaptureStart.bind(this))
        
        // Listen for combat turns for bleed-out checks
        Hooks.on('updateCombat', this._onCombatUpdate.bind(this))
        // Optional: auto-resolve any new combat if enabled
        Hooks.on('createCombat', async (combat) => {
            try {
                const automateCombat = getSetting('automateCombat', false)
                const combatAutomationLevel = getSetting('combatAutomationLevel', 'assisted')
                const aiProvider = getSetting('aiProvider', 'system')
                // Determine if the combat should be auto-resolved based on the source patroll(s) or global setting
                let shouldAutoResolve = false
                let requiresApproval = false
                // Inspect combatants for sourcePatrolId flag
                for (const c of combat.combatants.contents) {
                    const token = c.token?.object
                    if (!token) continue
                    const spId = token.getFlag(MODULE_ID, 'sourcePatrolId')
                    if (spId) {
                        const patrol = game.rnkPatrol?.manager?.getPatrol(spId)
                        const patrolAutomate = patrol?.automateCombat
                        if ((patrolAutomate === true) || (patrolAutomate === null && automateCombat)) {
                            shouldAutoResolve = true
                            // If this patrol specifically requires approval, flag it
                            if (patrol?.automateRequireApproval === true) requiresApproval = true
                            break
                        }
                    }
                }
                if (shouldAutoResolve && combatAutomationLevel === 'autoResolve' && aiProvider !== 'none' && game.user.isGM) {
                    // If any patrol in this combat requires approval, require it; otherwise check global
                    const automateRequireApproval = requiresApproval || getSetting('automateRequireApproval', false)
                    if (automateRequireApproval) {
                        await game.rnkPatrol.pushPendingAction({ type: 'autoResolveCombat', message: `AI suggests auto-resolve for combat ${combat.id}`, payload: { combatId: combat.id }, timestamp: Date.now() })
                        ui.notifications.info('AI auto-resolve suggestion queued for approval')
                    } else {
                        AIService.autoResolveCombat(combat)
                    }
                }
            } catch (err) {
                console.error(`${MODULE_ID} | Error auto-resolving combat`, err)
            }
        })
        
        // Clean up on scene change
        Hooks.on('canvasReady', () => this._cleanup())
    }
    
    // ==========================================
    // ALERT-TRIGGERED REINFORCEMENTS
    // ==========================================
    
    /**
     * Handle alert trigger - spawn reinforcements
     * @param {Patrol} patrol - Patrol that triggered alert
     * @param {Token[]} detectedTokens - Tokens that were detected
     */
    async _onAlert(patrol, detectedTokens) {
        if (!game.user.isGM) return
        
        const sceneId = canvas.scene?.id
        if (!sceneId) return
        
        // Check cooldown
        const lastAlert = this._lastAlertTime.get(sceneId) || 0
        const now = Date.now()
        
        if (now - lastAlert < this.ALERT_COOLDOWN) {
            const remaining = Math.ceil((this.ALERT_COOLDOWN - (now - lastAlert)) / 1000)
            debug(`Reinforcement cooldown active: ${remaining}s remaining`)
            return
        }
        
        // Update cooldown
        this._lastAlertTime.set(sceneId, now)
        
        // Get the triggering PC for popup
        const triggeringPC = detectedTokens.find(t => t.actor?.hasPlayerOwner)
        
        // Spawn reinforcements
        await this._spawnReinforcements(patrol, triggeringPC)
    }
    
    /**
     * Spawn alert-triggered reinforcements
     * @param {Patrol} alertPatrol - The patrol that raised the alert
     * @param {Token} triggeringPC - The PC that triggered the alert
     */
    async _spawnReinforcements(alertPatrol, triggeringPC) {
        // Get available waypoints (exclude the alert location)
        const manager = game.rnkPatrol?.manager
        if (!manager) return
        
        const allWaypoints = this._getAvailableWaypoints(alertPatrol)
        if (allWaypoints.length === 0) {
            debug('No available waypoints for reinforcements')
            return
        }
        
        // Random 1-4 reinforcements
        const count = Math.floor(Math.random() * 4) + 1
        debug(`Spawning ${count} reinforcements`)
        
        // Select random waypoints
        const selectedWaypoints = this._selectRandomWaypoints(allWaypoints, count)
        
        // Send alert popup to PC and GM
        await this._sendAlertPopup(triggeringPC, count)
        
        // Spawn with telegraph delay
        for (const waypoint of selectedWaypoints) {
            await this._spawnReinforcementAtWaypoint(waypoint, alertPatrol)
        }
    }
    
    /**
     * Get available waypoints excluding the alert patrol's current waypoint
     * @param {Patrol} alertPatrol 
     * @returns {Array}
     */
    _getAvailableWaypoints(alertPatrol) {
        const manager = game.rnkPatrol?.manager
        if (!manager) return []
        
        const allPatrols = manager.getActivePatrols()
        const waypoints = []
        
        // Get current waypoint of alert patrol to exclude
        const alertWaypoint = alertPatrol.getCurrentWaypoint?.()
        const alertWaypointId = alertWaypoint?.id
        
        for (const patrol of allPatrols) {
            const patrolWaypoints = patrol.getWaypoints?.() || []
            for (const wp of patrolWaypoints) {
                // Exclude the waypoint where alert triggered
                if (wp.id !== alertWaypointId) {
                    waypoints.push({ waypoint: wp, patrol })
                }
            }
        }
        
        return waypoints
    }
    
    /**
     * Select random waypoints from available pool
     * @param {Array} waypoints 
     * @param {number} count 
     * @returns {Array}
     */
    _selectRandomWaypoints(waypoints, count) {
        const shuffled = [...waypoints].sort(() => Math.random() - 0.5)
        return shuffled.slice(0, Math.min(count, shuffled.length))
    }
    
    /**
     * Send alert popup to triggering PC and GM
     * @param {Token} triggeringPC 
     * @param {number} reinforcementCount 
     */
    async _sendAlertPopup(triggeringPC, reinforcementCount) {
        const alertData = {
            type: 'alertReinforcements',
            tokenId: triggeringPC?.id,
            tokenName: triggeringPC?.name || 'Unknown',
            reinforcementCount,
            message: `🚨 ALERT TRIGGERED! ${reinforcementCount} reinforcements incoming!`
        }
        
        // Show to GM
        this._showAlertDialog(alertData, true)
        
        // Send to player via socket
        if (triggeringPC?.actor) {
            const ownerUser = game.users.find(u => 
                triggeringPC.actor.testUserPermission(u, "OWNER") && !u.isGM
            )
            
            if (ownerUser) {
                game.socket?.emit(`module.${MODULE_ID}`, {
                    type: 'alertPopup',
                    userId: ownerUser.id,
                    data: alertData
                })
            }
        }
    }
    
    /**
     * Show alert dialog
     * @param {Object} alertData 
     * @param {boolean} isGM 
     */
    _showAlertDialog(alertData, isGM = false) {
        const content = `
            <div class="rnk-alert-popup">
                <div class="alert-header">
                    <i class="fas fa-exclamation-triangle" style="color: #ff4444; font-size: 24px;"></i>
                    <h2>ALERT TRIGGERED!</h2>
                </div>
                <div class="alert-body">
                    <p><strong>${alertData.tokenName}</strong> has been spotted!</p>
                    <p class="reinforcement-warning">
                        <i class="fas fa-users"></i> 
                        <strong>${alertData.reinforcementCount}</strong> reinforcements are responding!
                    </p>
                    <p class="timer-warning">
                        <i class="fas fa-clock"></i> 
                        They will arrive in <strong>2 seconds</strong>...
                    </p>
                </div>
            </div>
        `
        
        new Dialog({
            title: '🚨 Alert!',
            content,
            buttons: {
                ok: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Acknowledged',
                    callback: () => {}
                }
            },
            default: 'ok'
        }, {
            classes: ['rnk-patrol-dialog', 'alert-popup'],
            width: 350
        }).render(true)
    }
    
    /**
     * Spawn a reinforcement at a waypoint with telegraph
     * @param {Object} waypointData - { waypoint, patrol }
     * @param {Patrol} alertPatrol 
     */
    async _spawnReinforcementAtWaypoint(waypointData, alertPatrol) {
        const { waypoint, patrol } = waypointData
        
        // Get telegraph system
        const telegraphSystem = game.rnkPatrol?.telegraphSystem
        
        // Show 2-second telegraph
        if (telegraphSystem) {
            await telegraphSystem.showTelegraph({
                x: waypoint.x,
                y: waypoint.y,
                duration: 2000,
                color: '#ff4444',
                type: 'warning'
            })
        }
        
        // Wait for telegraph
        await this._delay(2000)
        
        // Create reinforcement token
        const reinforcement = await this._createReinforcementToken(waypoint, patrol)
        
        if (reinforcement) {
            // Track it
            this._activeReinforcements.set(reinforcement.id, {
                tokenId: reinforcement.id,
                waypointId: waypoint.id,
                spawnTime: Date.now(),
                sourcePatrolId: alertPatrol.id
            })
            
            // Schedule despawn
            setTimeout(() => {
                this._despawnReinforcement(reinforcement.id)
            }, this.REINFORCEMENT_DURATION)
        }
    }
    
    /**
     * Create a reinforcement token
     * @param {Waypoint} waypoint 
     * @param {Patrol} patrol 
     * @returns {Token|null}
     */
    async _createReinforcementToken(waypoint, patrol) {
        // Pick a random guard variant
        const variant = GUARD_VARIANTS[Math.floor(Math.random() * GUARD_VARIANTS.length)]
        
        const scaleInfo = this._getPatrolScaleInfo(patrol)
        const tokenData = {
            name: `${variant.name} (Reinforcement)`,
            x: waypoint.x - 25,
            y: waypoint.y - 25,
            width: 1,
            height: 1,
            texture: {
                src: patrol.token?.document?.texture?.src || 'icons/svg/mystery-man.svg',
                tint: variant.tint
            },
            disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
            flags: {
                [MODULE_ID]: {
                    isReinforcement: true,
                    variant: variant.name,
                    sourcePatrolId: patrol.id
                }
            }
        }
        
        try {
            // If guard source is actors, attempt to attach scaled actor data
            const guardSource = getSetting('guardSource')
            if (guardSource === 'actors') {
                const jailSystem = game.rnkPatrol?.jailSystem
                const guardActor = patrol.guardActorId ? game.actors.get(patrol.guardActorId) : jailSystem?.getRandomNpcActor(patrol.sceneId)
                if (guardActor) {
                    const actorData = guardActor.toObject()
                    const scaledActorData = jailSystem._scaleActorData(actorData, scaleInfo.targetLevel || 5)
                    tokenData.actorData = scaledActorData
                    tokenData.actorLink = false
                    const proto = guardActor.prototypeToken || {}
                    if (proto.texture?.src) {
                        tokenData.texture.src = proto.texture.src
                    } else if (proto.img) {
                        tokenData.texture.src = proto.img
                    } else if (guardActor.img) {
                        tokenData.texture.src = guardActor.img
                    }
                }
            }
            // If we had a guardActor, set it in the token flags so it's easy to identify
            if (tokenData.actorData && (patrol.guardActorId || (jailSystem && jailSystem.getSceneGuardActor(patrol.sceneId)))) {
                const guardActorId = patrol.guardActorId || jailSystem?.getSceneGuardActor(patrol.sceneId)?.id || null
                tokenData.flags[MODULE_ID].guardActorId = guardActorId
            }
            const [token] = await canvas.scene.createEmbeddedDocuments('Token', [tokenData])
            debug(`Created reinforcement: ${variant.name} at (${waypoint.x}, ${waypoint.y})`)
            return canvas.tokens.get(token.id)
        } catch (err) {
            console.error(`${MODULE_ID} | Failed to create reinforcement:`, err)
            return null
        }
    }
    
    /**
     * Despawn a reinforcement with fade effect
     * @param {string} tokenId 
     */
    async _despawnReinforcement(tokenId) {
        const data = this._activeReinforcements.get(tokenId)
        if (!data) return
        
        const token = canvas.tokens.get(tokenId)
        if (!token) {
            this._activeReinforcements.delete(tokenId)
            return
        }
        
        // Fade out effect
        const effectsSystem = game.rnkPatrol?.effectsSystem
        if (effectsSystem) {
            await effectsSystem.playEffect(token, 'fade', { fadeOut: true })
        }
        
        // Delete token
        try {
            const adapter = getAdapter(token?.actor?.system?.id || game?.system?.id)
            if (adapter && typeof adapter.tokenHideRemove === 'function') await adapter.tokenHideRemove(token)
            else await token.document.delete()
            debug(`Despawned reinforcement: ${tokenId}`)
        } catch (err) {
            console.error(`${MODULE_ID} | Failed to despawn reinforcement:`, err)
        }
        
        this._activeReinforcements.delete(tokenId)
    }
    
    /**
     * Despawn all active reinforcements
     */
    async despawnAllReinforcements() {
        for (const [tokenId] of this._activeReinforcements) {
            await this._despawnReinforcement(tokenId)
        }
    }
    
    // ==========================================
    // ENCOUNTER ASSISTANTS
    // ==========================================
    
    /**
     * Handle capture combat start - possibly spawn assistants
     * @param {Object} captureData 
     * @param {Patrol} patrol 
     * @param {Token} playerToken 
     */
    async _onCaptureStart(captureData, patrol, playerToken) {
        if (!game.user.isGM) return
        
        // 50% chance to spawn assistants
        if (Math.random() > 0.5) {
            debug('No encounter assistants spawned (failed 50% roll)')
            return
        }
        
        // Spawn 1-2 assistants
        const count = Math.floor(Math.random() * 2) + 1
        debug(`Spawning ${count} encounter assistants`)
        
        await this._spawnEncounterAssistants(patrol, playerToken, count)
    }
    
    /**
     * Spawn encounter assistants near combat
     * @param {Patrol} patrol 
     * @param {Token} playerToken 
     * @param {number} count 
     */
    async _spawnEncounterAssistants(patrol, playerToken, count) {
        // Get adjacent waypoints
        const adjacentWaypoints = this._getAdjacentWaypoints(patrol)
        
        if (adjacentWaypoints.length === 0) {
            debug('No adjacent waypoints for assistants')
            return
        }
        
        // Get patrol's scale info for +10-20% bonus
        const scaleInfo = this._getPatrolScaleInfo(patrol)
        const bonusMultiplier = 1 + (0.1 + Math.random() * 0.1) // 1.1 to 1.2
        
        for (let i = 0; i < count; i++) {
            const waypoint = adjacentWaypoints[i % adjacentWaypoints.length]
            
            // Delay 1-2 rounds (6-12 seconds at 6s/round)
            const delayRounds = Math.floor(Math.random() * 2) + 1
            const delayMs = delayRounds * 6000
            
            setTimeout(async () => {
                await this._spawnAssistant(waypoint, patrol, scaleInfo, bonusMultiplier)
            }, delayMs)
            
            debug(`Scheduling assistant spawn in ${delayRounds} rounds`)
        }
    }
    
    /**
     * Get waypoints adjacent to patrol's current position
     * @param {Patrol} patrol 
     * @returns {Array}
     */
    _getAdjacentWaypoints(patrol) {
        const patrolWaypoints = patrol.getWaypoints?.() || []
        const currentIndex = patrol.currentWaypointIndex || 0
        
        const adjacent = []
        
        // Get previous and next waypoints
        if (currentIndex > 0) {
            adjacent.push(patrolWaypoints[currentIndex - 1])
        }
        if (currentIndex < patrolWaypoints.length - 1) {
            adjacent.push(patrolWaypoints[currentIndex + 1])
        }
        
        return adjacent.filter(Boolean)
    }
    
    /**
     * Get scale info from patrol for stat calculations
     * @param {Patrol} patrol 
     * @returns {Object}
     */
    _getPatrolScaleInfo(patrol) {
        // Try to get from patrol's guard template
        const jailSystem = game.rnkPatrol?.jailSystem
        const guardSource = getSetting('guardSource')
        let template = jailSystem?.getGuardTemplate('elite-guard') || 
                        jailSystem?.getGuardTemplate('default-guard')

        // If configured to use actors, create a template-like object derived from a random NPC actor
        if (guardSource === 'actors') {
            const actor = patrol.guardActorId ? game.actors.get(patrol.guardActorId) : jailSystem?.getRandomNpcActor(patrol.sceneId)
            if (actor) {
                const baseLevel = jailSystem._getActorLevel(actor)
                const baseHp = getProperty(actor, 'system.attributes.hp.max') || getProperty(actor, 'system.attributes.hp.value') || 30
                const baseAc = getProperty(actor, 'system.attributes.ac.value') || getProperty(actor, 'system.attributes.ac') || 12
                template = {
                    baseLevel,
                    baseHp,
                    hpPerLevel: 5,
                    baseAc,
                    acPerLevel: 0.5,
                    baseDamage: 6,
                    damagePerLevel: 1
                }
            }
        }
        
        return {
            template,
            targetLevel: patrol._lastTargetLevel || 5
        }
    }
    
    /**
     * Spawn a single assistant
     * @param {Waypoint} waypoint 
     * @param {Patrol} patrol 
     * @param {Object} scaleInfo 
     * @param {number} bonusMultiplier 
     */
    async _spawnAssistant(waypoint, patrol, scaleInfo, bonusMultiplier) {
        // Show telegraph
        const telegraphSystem = game.rnkPatrol?.telegraphSystem
        if (telegraphSystem) {
            await telegraphSystem.showTelegraph({
                x: waypoint.x,
                y: waypoint.y,
                duration: 1500,
                color: '#ff6600',
                type: 'warning'
            })
        }
        
        await this._delay(1500)
        
        // Calculate boosted stats
        const boostedStats = this._calculateBoostedStats(scaleInfo, bonusMultiplier)
        
        const tokenData = {
            name: 'Elite Backup',
            x: waypoint.x - 25,
            y: waypoint.y - 25,
            width: 1,
            height: 1,
            texture: {
                src: patrol.token?.document?.texture?.src || 'icons/svg/mystery-man.svg',
                tint: '#ff6600'
            },
            disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
            flags: {
                [MODULE_ID]: {
                    isAssistant: true,
                    scaledStats: boostedStats,
                    sourcePatrolId: patrol.id
                }
            }
        }
        
        try {
            const [token] = await canvas.scene.createEmbeddedDocuments('Token', [tokenData])
            
            this._activeAssistants.set(token.id, {
                tokenId: token.id,
                waypointId: waypoint.id,
                spawnTime: Date.now(),
                stats: boostedStats
            })
            
            debug(`Spawned assistant with ${Math.round((bonusMultiplier - 1) * 100)}% stat bonus`)
            
            // Add to combat if one exists
            if (game.combat) {
                await game.combat.createEmbeddedDocuments('Combatant', [{
                    tokenId: token.id,
                    initiative: Math.floor(Math.random() * 20) + 1
                }])
            }
        } catch (err) {
            console.error(`${MODULE_ID} | Failed to spawn assistant:`, err)
        }
    }
    
    /**
     * Calculate boosted stats for assistant
     * @param {Object} scaleInfo 
     * @param {number} multiplier 
     * @returns {Object}
     */
    _calculateBoostedStats(scaleInfo, multiplier) {
        const template = scaleInfo.template
        if (!template) {
            return {
                hp: Math.round(50 * multiplier),
                ac: Math.round(14 * multiplier),
                damage: Math.round(10 * multiplier),
                level: scaleInfo.targetLevel
            }
        }
        
        const targetLevel = scaleInfo.targetLevel
        const levelDiff = Math.max(0, targetLevel - template.baseLevel)
        
        return {
            hp: Math.round((template.baseHp + template.hpPerLevel * levelDiff) * multiplier),
            ac: Math.round((template.baseAc + template.acPerLevel * levelDiff) * multiplier),
            damage: Math.round((template.baseDamage + template.damagePerLevel * levelDiff) * multiplier),
            level: targetLevel
        }
    }
    
    // ==========================================
    // BLEED-OUT CAPTURE MECHANIC
    // ==========================================
    
    /**
     * Handle combat update - check for bleed-out saves
     * @param {Combat} combat 
     * @param {Object} change 
     * @param {Object} options 
     * @param {string} userId 
     */
    async _onCombatUpdate(combat, change, options, userId) {
        if (!game.user.isGM) return
        if (!change.turn && !change.round) return
        
        // Check all tokens in combat for bleeding status
        for (const combatant of combat.combatants) {
            const token = combatant.token?.object
            if (!token?.actor) continue
            // If automation is in 'assisted' mode, provide a suggestion via AI
            const automateCombat = getSetting('automateCombat', false)
            const combatAutomationLevel = getSetting('combatAutomationLevel', 'assisted')
            const aiProvider = getSetting('aiProvider', 'system')
            try {
                if (automateCombat && combatAutomationLevel === 'assisted' && aiProvider !== 'none' && game.user.isGM && change.turn) {
                    // current combatant to act
                    const current = combat.combatant
                    if (current) {
                        // Check if the token belongs to a patrol and whether that patrol wants assisted suggestions
                        const manager = game.rnkPatrol?.manager
                        const patrol = manager?.getPatrolForToken?.(current.tokenId)
                        const patrolAutomate = patrol?.automateCombat
                        const shouldSuggest = (patrolAutomate === true) || (patrolAutomate === null && automateCombat)
                        if (!shouldSuggest) continue
                        const enemies = combat.combatants.filter(c => c.token?.document?.disposition !== current.token?.document?.disposition).map(c => c.token?.object)
                        const suggestion = await AIService.decideCombatAction({ combatant: current, enemies, state: { combatId: combat.id } })
                        if (suggestion) {
                            const gmIds = game.users.filter(u => u.isGM).map(u => u.id)
                            ChatMessage.create({ content: `${MODULE_ID} Suggestion for ${current.name}: ${suggestion}`, whisper: gmIds })
                            const autoPerformSuggestions = getSetting('autoPerformSuggestions', false)
                            const automateRequireApproval = (patrol?.automateRequireApproval === true) || (patrol?.automateRequireApproval === null && getSetting('automateRequireApproval', false))
                            if (autoPerformSuggestions && shouldSuggest && !automateRequireApproval) {
                                // Try performing it immediately
                                try {
                                    const targetToken = enemies?.[0]
                                    await AIService.performAction({ combatant: current, action: suggestion, targetToken, combat })
                                } catch (err) { console.error(`${MODULE_ID} | failed to auto perform AI suggestion`, err) }
                            } else {
                                // Push to pending queue for approval if configured
                                const pendingAllowed = (patrol?.automateRequireApproval === true) || (patrol?.automateRequireApproval === null && getSetting('automateRequireApproval', false))
                                if (pendingAllowed) {
                                    await game.rnkPatrol.pushPendingAction({ type: 'performAction', message: `AI suggestion for ${current.name}: ${suggestion}`, payload: { attackerId: current.token?.actor?.id, targetId: enemies?.[0]?.actor?.id, action: suggestion }, timestamp: Date.now() })
                                    ui.notifications.info('AI suggestion queued for approval')
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`${MODULE_ID} | AI combat suggestion error:`, err)
            }
            await this._checkBleedingStatus(token, combat)
        }
    }
    
    /**
     * Check if a token should make a bleed-out save
     * @param {Token} token 
     * @param {Combat} combat 
     */
    async _checkBleedingStatus(token, combat) {
        // Check if bleed-out system is enabled
        const bleedOutEnabled = getSetting('bleedOutEnabled', true)
        if (!bleedOutEnabled) return
        
        const actor = token.actor
        if (!actor) return
        
        // Get HP values
        const hp = this._getTokenHP(actor)
        if (!hp) return
        
        const { current, max } = hp
        
        // Check if at or below bleeding threshold (configurable, default 25% HP)
        const thresholdPercent = getSetting('bleedOutThreshold', 25) / 100
        const bleedingThreshold = max * thresholdPercent
        
        if (current > bleedingThreshold) {
            // Not bleeding - clear any bleeding state
            this._bleedingTokens.delete(token.id)
            return
        }
        
        // Token is bleeding - calculate save DC
        const dc = this._calculateBleedOutDC(current, max)
        
        // Get or create bleeding state
        let bleedState = this._bleedingTokens.get(token.id)
        if (!bleedState) {
            bleedState = {
                tokenId: token.id,
                tokenName: token.name,
                hasDisadvantage: false,
                savesMade: 0,
                savesFailed: 0
            }
            this._bleedingTokens.set(token.id, bleedState)
        }
        
        // Prompt for save
        await this._promptBleedOutSave(token, dc, bleedState)
    }
    
    /**
     * Get HP from actor (system-agnostic)
     * @param {Actor} actor 
     * @returns {Object|null}
     */
    _getTokenHP(actor) {
        // Try common HP paths
        const paths = [
            'system.attributes.hp',
            'system.hp',
            'system.health',
            'system.vitality'
        ]
        
        for (const path of paths) {
            const hp = foundry.utils.getProperty(actor, path)
            if (hp && typeof hp.value === 'number' && typeof hp.max === 'number') {
                return { current: hp.value, max: hp.max }
            }
        }
        
        return null
    }
    
    /**
     * Calculate bleed-out save DC
     * DC = baseDC + (MaxHP - CurrentHP) / 2
     * @param {number} currentHP 
     * @param {number} maxHP 
     * @returns {number}
     */
    _calculateBleedOutDC(currentHP, maxHP) {
        const baseDC = getSetting('bleedOutBaseDC', 12)
        const hpDiff = maxHP - currentHP
        const dc = baseDC + Math.floor(hpDiff / 2)
        return Math.min(dc, 30) // Cap at 30
    }
    
    /**
     * Prompt for bleed-out save with interactive dialog
     * @param {Token} token 
     * @param {number} dc 
     * @param {Object} bleedState 
     */
    async _promptBleedOutSave(token, dc, bleedState) {
        const actor = token.actor
        const isPC = actor?.hasPlayerOwner
        
        // Get Constitution modifier
        const conMod = this._getConstitutionMod(actor)
        
        // Prepare dialog data
        const saveData = {
            tokenId: token.id,
            tokenName: token.name,
            dc,
            conMod,
            hasDisadvantage: bleedState.hasDisadvantage,
            isPC
        }
        
        // Show interactive save dialog based on player control setting
        const playerControl = getSetting('bleedOutPlayerControl', 'player')
        
        if (isPC) {
            if (playerControl === 'auto') {
                // Auto-roll for everyone including players
                await this._performBleedOutSave(saveData)
            } else if (playerControl === 'gm') {
                // GM controls all bleed-out saves
                this._showBleedOutDialog(saveData, true)
            } else {
                // 'player' - Send save dialog to player
                const ownerUser = game.users.find(u => 
                    actor.testUserPermission(u, "OWNER") && !u.isGM
                )
                
                if (ownerUser) {
                    game.socket?.emit(`module.${MODULE_ID}`, {
                        type: 'bleedOutSave',
                        userId: ownerUser.id,
                        data: saveData
                    })
                }
                
                // Also show to GM for monitoring
                this._showBleedOutDialog(saveData, true)
            }
        } else {
            // NPC - auto-roll
            await this._performBleedOutSave(saveData)
        }
    }
    
    /**
     * Get Constitution modifier from actor
     * @param {Actor} actor 
     * @returns {number}
     */
    _getConstitutionMod(actor) {
        // Try common paths
        const paths = [
            'system.abilities.con.mod',
            'system.attributes.con.mod',
            'system.stats.constitution.mod'
        ]
        
        for (const path of paths) {
            const mod = foundry.utils.getProperty(actor, path)
            if (typeof mod === 'number') return mod
        }
        
        return 0
    }
    
    /**
     * Show bleed-out save dialog
     * @param {Object} saveData 
     * @param {boolean} isGM 
     */
    _showBleedOutDialog(saveData, isGM = false) {
        const content = `
            <div class="rnk-bleedout-dialog">
                <div class="bleedout-header">
                    <i class="fas fa-heartbeat" style="color: #cc0000; font-size: 32px;"></i>
                    <h2>DESPERATE STRUGGLE</h2>
                </div>
                <div class="bleedout-body">
                    <p><strong>${saveData.tokenName}</strong> is bleeding out!</p>
                    <div class="save-info">
                        <p><strong>Constitution Save DC:</strong> ${saveData.dc}</p>
                        <p><strong>Con Modifier:</strong> ${saveData.conMod >= 0 ? '+' : ''}${saveData.conMod}</p>
                        ${saveData.hasDisadvantage ? '<p class="disadvantage"><i class="fas fa-minus-circle"></i> Rolling with Disadvantage</p>' : ''}
                    </div>
                    <p style="margin-top: 10px; font-style: italic;">What do you want to do?</p>
                    <div class="outcomes">
                        <div class="outcome fight">
                            <i class="fas fa-sword"></i>
                            <span><strong>Keep Fighting:</strong> Continue combat without rolling (stay bloodied)</span>
                        </div>
                        <div class="outcome success">
                            <i class="fas fa-dice-d20"></i>
                            <span><strong>Roll Save:</strong> Success = fight on, Failure = captured</span>
                        </div>
                        <div class="outcome surrender">
                            <i class="fas fa-flag"></i>
                            <span><strong>Surrender:</strong> Accept capture peacefully</span>
                        </div>
                    </div>
                </div>
            </div>
        `
        
        new Dialog({
            title: '💀 Bleed-Out Save',
            content,
            buttons: {
                fight: {
                    icon: '<i class="fas fa-fist-raised"></i>',
                    label: 'Keep Fighting',
                    callback: () => {
                        ui.notifications.info(`${saveData.tokenName} fights on despite their wounds!`)
                        // They stay in combat, no save rolled, no capture
                    }
                },
                roll: {
                    icon: '<i class="fas fa-dice-d20"></i>',
                    label: 'Roll Save',
                    callback: async () => {
                        await this._performBleedOutSave(saveData)
                    }
                },
                surrender: {
                    icon: '<i class="fas fa-flag"></i>',
                    label: 'Surrender',
                    callback: async () => {
                        ui.notifications.info(`${saveData.tokenName} surrenders to capture.`)
                        await this._executeBleedOutCapture(saveData, true)
                    }
                },
                ...(isGM ? {
                    forceCapture: {
                        icon: '<i class="fas fa-gavel"></i>',
                        label: 'Force Capture (GM)',
                        callback: async () => {
                            await this._executeBleedOutCapture(saveData, true)
                        }
                    }
                } : {})
            },
            default: 'fight'
        }, {
            classes: ['rnk-patrol-dialog', 'bleedout-dialog'],
            width: 420
        }).render(true)
    }
    
    /**
     * Perform the bleed-out save roll
     * @param {Object} saveData 
     */
    async _performBleedOutSave(saveData) {
        // Roll d20 + Con mod
        let roll
        
        if (saveData.hasDisadvantage) {
            roll = await new Roll('2d20kl + @mod', { mod: saveData.conMod }).evaluate()
        } else {
            roll = await new Roll('1d20 + @mod', { mod: saveData.conMod }).evaluate()
        }
        
        // Show roll in chat
        await roll.toMessage({
            speaker: { alias: saveData.tokenName },
            flavor: `Bleed-Out Save (DC ${saveData.dc})`
        })
        
        const success = roll.total >= saveData.dc
        
        // Update bleeding state
        const bleedState = this._bleedingTokens.get(saveData.tokenId)
        if (bleedState) {
            if (success) {
                bleedState.savesMade++
                bleedState.hasDisadvantage = true // Now has disadvantage on future actions
            } else {
                bleedState.savesFailed++
            }
        }
        
        // Show result
        await this._showBleedOutResult(saveData, roll.total, success)
        
        // Handle outcome
        if (!success) {
            await this._executeBleedOutCapture(saveData, false)
        }
    }
    
    /**
     * Show bleed-out save result
     * @param {Object} saveData 
     * @param {number} rollTotal 
     * @param {boolean} success 
     */
    async _showBleedOutResult(saveData, rollTotal, success) {
        const resultData = {
            tokenName: saveData.tokenName,
            rollTotal,
            dc: saveData.dc,
            success,
            message: success 
                ? `${saveData.tokenName} grits their teeth and keeps fighting! (Disadvantage on actions)`
                : `${saveData.tokenName} collapses! CAPTURED!`
        }
        
        // Send to all players
        game.socket?.emit(`module.${MODULE_ID}`, {
            type: 'bleedOutResult',
            data: resultData
        })
        
        // Show locally too
        this._displayBleedOutResult(resultData)
    }
    
    /**
     * Display bleed-out result dialog
     * @param {Object} resultData 
     */
    _displayBleedOutResult(resultData) {
        const bgColor = resultData.success ? '#2a5a2a' : '#5a2a2a'
        const icon = resultData.success ? 'fa-fist-raised' : 'fa-skull'
        const title = resultData.success ? 'STILL FIGHTING!' : 'CAPTURED!'
        
        const content = `
            <div class="rnk-bleedout-result" style="background: ${bgColor}; padding: 15px; border-radius: 8px;">
                <div style="text-align: center;">
                    <i class="fas ${icon}" style="font-size: 48px; color: white;"></i>
                    <h2 style="color: white; margin: 10px 0;">${title}</h2>
                    <p style="color: white; font-size: 16px;">
                        Roll: <strong>${resultData.rollTotal}</strong> vs DC <strong>${resultData.dc}</strong>
                    </p>
                    <p style="color: #cccccc; font-style: italic;">${resultData.message}</p>
                </div>
            </div>
        `
        
        new Dialog({
            title: resultData.success ? '⚔️ Still Standing!' : '💀 Captured!',
            content,
            buttons: {
                ok: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'OK'
                }
            },
            default: 'ok'
        }, {
            classes: ['rnk-patrol-dialog', 'bleedout-result'],
            width: 350
        }).render(true)
    }
    
    /**
     * Execute capture after failed bleed-out save
     * @param {Object} saveData 
     * @param {boolean} forced - GM forced the capture
     */
    async _executeBleedOutCapture(saveData, forced = false) {
        const token = canvas.tokens.get(saveData.tokenId)
        if (!token) return
        
        const isPC = token.actor?.hasPlayerOwner
        
        // Clear bleeding state
        this._bleedingTokens.delete(saveData.tokenId)
        
        if (isPC) {
            // Trigger jail sequence for PCs
            const captureSystem = game.rnkPatrol?.captureSystem
            if (captureSystem) {
                // Create a fake patrol for the capture
                await captureSystem.triggerOutcome(token, 'jail', {
                    patrolName: 'Bleed-Out Capture',
                    skipBribery: true
                })
            }
        } else {
            // Remove NPC from combat
            if (game.combat) {
                const combatant = game.combat.combatants.find(c => c.tokenId === token.id)
                if (combatant) {
                    await combatant.delete()
                }
            }
            
            // Optionally delete or hide the token
            const adapter = getAdapter(token?.actor?.system?.id || game?.system?.id)
            if (adapter && typeof adapter.tokenHideRemove === 'function') await adapter.tokenHideRemove(token, { applyToPlayers: false })
            else await token.document.update({ hidden: true })
            
            ui.notifications.info(`${saveData.tokenName} has been knocked out!`)
        }
    }
    
    // ==========================================
    // UTILITY METHODS
    // ==========================================
    
    /**
     * Delay helper
     * @param {number} ms 
     * @returns {Promise}
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
    
    /**
     * Clean up on scene change
     */
    _cleanup() {
        this._activeReinforcements.clear()
        this._activeAssistants.clear()
        this._bleedingTokens.clear()
    }
    
    /**
     * Get remaining cooldown for alerts
     * @returns {number} Seconds remaining
     */
    getAlertCooldownRemaining() {
        const sceneId = canvas.scene?.id
        if (!sceneId) return 0
        
        const lastAlert = this._lastAlertTime.get(sceneId) || 0
        const elapsed = Date.now() - lastAlert
        const remaining = Math.max(0, this.ALERT_COOLDOWN - elapsed)
        
        return Math.ceil(remaining / 1000)
    }
    
    /**
     * Force reset cooldown (GM tool)
     */
    resetAlertCooldown() {
        const sceneId = canvas.scene?.id
        if (sceneId) {
            this._lastAlertTime.delete(sceneId)
            ui.notifications.info('Alert cooldown reset')
        }
    }
}
