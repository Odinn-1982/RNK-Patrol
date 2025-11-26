/**
 * RNK Patrol - Capture System
 * 
 * Handles what happens when a patrol captures a player.
 * Six possible outcomes with weighted random selection.
 * 
 * @module CaptureSystem
 */

import { MODULE_ID, debug, warn } from './main.js'
import { getSetting } from './settings.js'

/**
 * Capture outcome types with default weights
 */
export const CAPTURE_OUTCOMES = {
    COMBAT: 'combat',
    THEFT: 'theft',
    BLINDFOLD: 'blindfold',
    DISREGARD: 'disregard',
    JAIL: 'jail',
    BRIBERY: 'bribery'
}

/**
 * Default outcome weights (percentages)
 */
export const DEFAULT_WEIGHTS = {
    [CAPTURE_OUTCOMES.COMBAT]: 30,
    [CAPTURE_OUTCOMES.THEFT]: 25,
    [CAPTURE_OUTCOMES.BLINDFOLD]: 20,
    [CAPTURE_OUTCOMES.DISREGARD]: 15,
    [CAPTURE_OUTCOMES.JAIL]: 10
}

/**
 * CaptureSystem - Manages capture events and outcomes
 */
export class CaptureSystem {
    
    constructor() {
        /**
         * Active captures in progress
         * @type {Map<string, Object>}
         */
        this._activeCaptures = new Map()
        
        /**
         * Blindfolded players
         * @type {Set<string>}
         */
        this._blindfolded = new Set()
    }
    
    /**
     * Initialize the capture system
     */
    initialize() {
        debug('CaptureSystem initialized')
        
        // Register socket handlers
        this._registerSocketHandlers()
    }
    
    /**
     * Register socket handlers for multiplayer sync
     */
    _registerSocketHandlers() {
        game.socket?.on(`module.${MODULE_ID}`, (data) => {
            if (data.type === 'blindfold') {
                this._handleBlindfoldSocket(data)
            } else if (data.type === 'unblind') {
                this._handleUnblindSocket(data)
            }
        })
    }
    
    // ==========================================
    // Main Capture Flow
    // ==========================================
    
    /**
     * Initiate a capture event
     * @param {Patrol} patrol - The patrol that caught the player
     * @param {Token} playerToken - The captured player token
     * @param {Object} options - Additional options
     */
    async initiateCapture(patrol, playerToken, options = {}) {
        if (!game.user.isGM) return
        
        const captureId = foundry.utils.randomID()
        
        const captureData = {
            id: captureId,
            patrolId: patrol.id,
            patrolName: patrol.name,
            tokenId: playerToken.id,
            tokenName: playerToken.name,
            actorId: playerToken.actor?.id,
            timestamp: Date.now(),
            outcome: null,
            resolved: false
        }
        
        this._activeCaptures.set(captureId, captureData)
        
        debug(`Capture initiated: ${patrol.name} caught ${playerToken.name}`)
        
        // Check if bribery is enabled - offer choice first
        const briberyEnabled = getSetting('briberyEnabled', true)
        
        if (briberyEnabled && !options.skipBribery) {
            await this._offerBribery(captureData, patrol, playerToken)
        } else {
            await this._executeRandomOutcome(captureData, patrol, playerToken)
        }
        
        return captureData
    }
    
    /**
     * GM manually triggers a specific outcome
     * @param {Token} playerToken 
     * @param {string} outcome 
     * @param {Object} options 
     */
    async triggerOutcome(playerToken, outcome, options = {}) {
        if (!game.user.isGM) return
        
        const fakePatrol = {
            id: 'gm-triggered',
            name: options.patrolName || 'Guard',
            token: options.patrolToken || null
        }
        
        const captureData = {
            id: foundry.utils.randomID(),
            patrolId: fakePatrol.id,
            patrolName: fakePatrol.name,
            tokenId: playerToken.id,
            tokenName: playerToken.name,
            actorId: playerToken.actor?.id,
            timestamp: Date.now(),
            outcome: outcome,
            resolved: false,
            gmTriggered: true
        }
        
        this._activeCaptures.set(captureData.id, captureData)
        
        await this._executeOutcome(captureData, fakePatrol, playerToken, outcome, options)
        
        return captureData
    }
    
    // ==========================================
    // Bribery System
    // ==========================================
    
    /**
     * Offer bribery option to player
     */
    async _offerBribery(captureData, patrol, playerToken) {
        const actor = playerToken.actor
        if (!actor) {
            return this._executeRandomOutcome(captureData, patrol, playerToken)
        }
        
        // Calculate bribe amount based on patrol type/level
        const baseBribe = getSetting('briberyBaseCost', 50)
        const patrolMultiplier = patrol.bribeMultiplier || 1
        const bribeAmount = Math.floor(baseBribe * patrolMultiplier)
        
        // Get player's gold (system-agnostic)
        const playerGold = this._getActorGold(actor)
        
        // Show bribery dialog to the player who owns this token
        const ownerUser = game.users.find(u => actor.testUserPermission(u, "OWNER") && !u.isGM)
        
        if (!ownerUser) {
            // No player owner, GM decides
            return this._gmBriberyDecision(captureData, patrol, playerToken, bribeAmount)
        }
        
        // Send dialog to player via socket
        const dialogData = {
            captureId: captureData.id,
            patrolName: patrol.name,
            bribeAmount,
            playerGold,
            canAfford: playerGold >= bribeAmount
        }
        
        // For now, show GM dialog - in full implementation, would send to player
        return this._gmBriberyDecision(captureData, patrol, playerToken, bribeAmount)
    }
    
    /**
     * GM decides bribery outcome
     */
    async _gmBriberyDecision(captureData, patrol, playerToken, bribeAmount) {
        const content = `
            <div class="rnk-patrol-bribery-dialog">
                <h3><i class="fas fa-coins"></i> Bribery Opportunity</h3>
                <p><strong>${patrol.name}</strong> has caught <strong>${playerToken.name}</strong>!</p>
                <p>Suggested bribe amount: <strong>${bribeAmount} gold</strong></p>
                <hr>
                <p>Choose the outcome:</p>
            </div>
        `
        
        const result = await Dialog.wait({
            title: 'Capture Outcome',
            content,
            buttons: {
                bribeSuccess: {
                    icon: '<i class="fas fa-check-circle"></i>',
                    label: 'Bribe Accepted (Release)',
                    callback: () => 'bribe_success'
                },
                bribeGenerous: {
                    icon: '<i class="fas fa-heart"></i>',
                    label: 'Guard is Generous (Free)',
                    callback: () => 'bribe_generous'
                },
                bribeBetrayal: {
                    icon: '<i class="fas fa-mask"></i>',
                    label: 'Double-Cross (Take & Jail)',
                    callback: () => 'bribe_betrayal'
                },
                random: {
                    icon: '<i class="fas fa-dice"></i>',
                    label: 'Random Outcome',
                    callback: () => 'random'
                },
                combat: {
                    icon: '<i class="fas fa-swords"></i>',
                    label: 'Combat',
                    callback: () => CAPTURE_OUTCOMES.COMBAT
                },
                theft: {
                    icon: '<i class="fas fa-hand-holding-usd"></i>',
                    label: 'Theft & Release',
                    callback: () => CAPTURE_OUTCOMES.THEFT
                },
                blindfold: {
                    icon: '<i class="fas fa-eye-slash"></i>',
                    label: 'Blindfold & Relocate',
                    callback: () => CAPTURE_OUTCOMES.BLINDFOLD
                },
                disregard: {
                    icon: '<i class="fas fa-meh"></i>',
                    label: 'Disregard',
                    callback: () => CAPTURE_OUTCOMES.DISREGARD
                },
                jail: {
                    icon: '<i class="fas fa-dungeon"></i>',
                    label: 'Send to Jail',
                    callback: () => CAPTURE_OUTCOMES.JAIL
                }
            },
            default: 'random',
            close: () => 'random'
        })
        
        if (result === 'random') {
            return this._executeRandomOutcome(captureData, patrol, playerToken)
        } else if (result.startsWith('bribe_')) {
            return this._executeBriberyResult(captureData, patrol, playerToken, result, bribeAmount)
        } else {
            return this._executeOutcome(captureData, patrol, playerToken, result)
        }
    }
    
    /**
     * Execute bribery result
     */
    async _executeBriberyResult(captureData, patrol, playerToken, result, bribeAmount) {
        const actor = playerToken.actor
        
        switch (result) {
            case 'bribe_success':
                // Take gold, release player
                if (actor) await this._removeGold(actor, bribeAmount)
                await this._playBark('bribery_accept', patrol)
                ui.notifications.info(`${patrol.name} accepted the bribe and released ${playerToken.name}`)
                captureData.outcome = 'bribe_success'
                break
                
            case 'bribe_generous':
                // Don't take gold, release anyway
                await this._playBark('bribery_generous', patrol)
                ui.notifications.info(`${patrol.name} let ${playerToken.name} go without taking the bribe`)
                captureData.outcome = 'bribe_generous'
                break
                
            case 'bribe_betrayal':
                // Take gold AND jail
                if (actor) await this._removeGold(actor, bribeAmount)
                await this._playBark('bribery_betrayal', patrol)
                ui.notifications.warn(`${patrol.name} took the bribe and STILL arrested ${playerToken.name}!`)
                captureData.outcome = 'bribe_betrayal'
                await this._executeOutcome(captureData, patrol, playerToken, CAPTURE_OUTCOMES.JAIL)
                break
        }
        
        captureData.resolved = true
        Hooks.callAll('rnkPatrol.captureResolved', captureData)
    }
    
    // ==========================================
    // Outcome Execution
    // ==========================================
    
    /**
     * Execute a random weighted outcome
     */
    async _executeRandomOutcome(captureData, patrol, playerToken) {
        const weights = this._getOutcomeWeights()
        const outcome = this._weightedRandom(weights)
        
        debug(`Random outcome selected: ${outcome}`)
        
        return this._executeOutcome(captureData, patrol, playerToken, outcome)
    }
    
    /**
     * Get outcome weights from settings
     */
    _getOutcomeWeights() {
        // Try to get from object setting first
        const weights = getSetting('captureOutcomeWeights', null)
        if (weights) {
            return {
                [CAPTURE_OUTCOMES.COMBAT]: weights.combat || 30,
                [CAPTURE_OUTCOMES.THEFT]: weights.theft || 25,
                [CAPTURE_OUTCOMES.BLINDFOLD]: weights.relocate || 20,
                [CAPTURE_OUTCOMES.DISREGARD]: weights.disregard || 15,
                [CAPTURE_OUTCOMES.JAIL]: weights.jail || 10
            }
        }
        
        // Fallback to defaults
        return {
            [CAPTURE_OUTCOMES.COMBAT]: 30,
            [CAPTURE_OUTCOMES.THEFT]: 25,
            [CAPTURE_OUTCOMES.BLINDFOLD]: 20,
            [CAPTURE_OUTCOMES.DISREGARD]: 15,
            [CAPTURE_OUTCOMES.JAIL]: 10
        }
    }
    
    /**
     * Weighted random selection
     */
    _weightedRandom(weights) {
        const entries = Object.entries(weights)
        const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
        let random = Math.random() * total
        
        for (const [outcome, weight] of entries) {
            random -= weight
            if (random <= 0) return outcome
        }
        
        return entries[0][0] // Fallback
    }
    
    /**
     * Execute a specific outcome
     */
    async _executeOutcome(captureData, patrol, playerToken, outcome, options = {}) {
        captureData.outcome = outcome
        
        debug(`Executing outcome: ${outcome} for ${playerToken.name}`)
        
        switch (outcome) {
            case CAPTURE_OUTCOMES.COMBAT:
                await this._executeCombat(captureData, patrol, playerToken, options)
                break
                
            case CAPTURE_OUTCOMES.THEFT:
                await this._executeTheft(captureData, patrol, playerToken, options)
                break
                
            case CAPTURE_OUTCOMES.BLINDFOLD:
                await this._executeBlindfold(captureData, patrol, playerToken, options)
                break
                
            case CAPTURE_OUTCOMES.DISREGARD:
                await this._executeDisregard(captureData, patrol, playerToken, options)
                break
                
            case CAPTURE_OUTCOMES.JAIL:
                await this._executeJail(captureData, patrol, playerToken, options)
                break
                
            default:
                warn(`Unknown outcome: ${outcome}`)
        }
        
        captureData.resolved = true
        Hooks.callAll('rnkPatrol.captureResolved', captureData)
        
        return captureData
    }
    
    // ==========================================
    // Outcome: Combat
    // ==========================================
    
    async _executeCombat(captureData, patrol, playerToken, options = {}) {
        await this._playBark('capture', patrol)
        
        // Get patrol token
        const patrolToken = patrol.token ? canvas.tokens.get(patrol.tokenId) : null
        
        if (patrolToken && playerToken) {
            // Start combat
            const combat = await Combat.create({
                scene: canvas.scene.id,
                active: true
            })
            
            // Add combatants
            await combat.createEmbeddedDocuments('Combatant', [
                { tokenId: patrolToken.id, actorId: patrolToken.actor?.id },
                { tokenId: playerToken.id, actorId: playerToken.actor?.id }
            ])
            
            // Roll initiative
            await combat.rollAll()
            
            ui.notifications.warn(`${patrol.name} attacks ${playerToken.name}!`)
        }
        
        // Alert nearby patrols
        await this._alertNearbyPatrols(patrol, playerToken)
    }
    
    /**
     * Alert nearby patrols to join combat
     */
    async _alertNearbyPatrols(patrol, playerToken) {
        const alertRadius = getSetting('alertRadius', 500) // pixels
        const manager = game.rnkPatrol?.manager
        if (!manager) return
        
        const patrolToken = canvas.tokens.get(patrol.tokenId)
        if (!patrolToken) return
        
        for (const otherPatrol of manager.getPatrols()) {
            if (otherPatrol.id === patrol.id) continue
            if (!otherPatrol.isActive) continue
            
            const otherToken = canvas.tokens.get(otherPatrol.tokenId)
            if (!otherToken) continue
            
            const distance = Math.hypot(
                patrolToken.x - otherToken.x,
                patrolToken.y - otherToken.y
            )
            
            if (distance <= alertRadius) {
                // This patrol joins the alert
                otherPatrol.setAlertLevel('alert')
                debug(`${otherPatrol.name} alerted by ${patrol.name}`)
            }
        }
    }
    
    // ==========================================
    // Outcome: Theft
    // ==========================================

    async _executeTheft(captureData, patrol, playerToken, options = {}) {
        await this._playBark('theft', patrol)
        
        const actor = playerToken.actor
        if (!actor) {
            ui.notifications.info(`${patrol.name} searched ${playerToken.name} but found nothing.`)
            return
        }
        
        const stolenItems = []
        const maxItems = getSetting('theftMaxItems', 3)
        const notifyPlayer = getSetting('theftNotifyPlayer', true)
        
        // Get theft targeting weights from settings
        const targetingWeights = getSetting('theftTargetingWeights', {
            currency: 70,
            equipment: 25,
            miscellaneous: 5
        })
        
        // Calculate cumulative weights
        const totalWeight = targetingWeights.currency + targetingWeights.equipment + targetingWeights.miscellaneous
        const currencyThreshold = (targetingWeights.currency / totalWeight) * 100
        const equipmentThreshold = currencyThreshold + (targetingWeights.equipment / totalWeight) * 100
        
        // Weighted theft targeting using configurable weights
        const targetRoll = Math.random() * 100
        
        if (targetRoll < currencyThreshold) {
            // Target: Currency
            const stolen = await this._stealCurrency(actor, patrol)
            if (stolen) stolenItems.push(stolen)
        } else if (targetRoll < equipmentThreshold) {
            // Target: Equipment
            const stolen = await this._stealEquipment(actor, patrol)
            if (stolen) stolenItems.push(stolen)
        } else {
            // Target: Miscellaneous
            const stolen = await this._stealMiscItem(actor, patrol)
            if (stolen) stolenItems.push(stolen)
        }
        
        // If primary target failed, try currency as fallback
        if (stolenItems.length === 0) {
            const stolen = await this._stealCurrency(actor, patrol)
            if (stolen) stolenItems.push(stolen)
        }
        
        // Report theft results
        if (stolenItems.length > 0) {
            const itemList = stolenItems.map(i => i.name).join(', ')
            
            if (notifyPlayer) {
                ui.notifications.warn(`${patrol.name} confiscated: ${itemList}`)
            }
            
            // Transfer items to guard actor if configured
            await this._transferToGuard(patrol, stolenItems)
        } else {
            ui.notifications.info(`${patrol.name} searched ${playerToken.name} but found nothing worth taking.`)
        }
        
        // Release player
        await this._playBark('theft_release', patrol)
        ui.notifications.info(`${patrol.name} released ${playerToken.name} after the "inspection".`)
    }
    
    /**
     * Steal currency from actor
     * @returns {Object|null} Stolen item info
     */
    async _stealCurrency(actor, patrol) {
        const theftPercent = getSetting('theftPercent', 25)
        const currentGold = this._getActorGold(actor)
        const stolenAmount = Math.floor(currentGold * (theftPercent / 100))
        
        if (stolenAmount > 0) {
            await this._removeGold(actor, stolenAmount)
            return { type: 'currency', name: `${stolenAmount} gold`, amount: stolenAmount }
        }
        return null
    }
    
    /**
     * Steal equipment item from actor
     * @returns {Object|null} Stolen item info
     */
    async _stealEquipment(actor, patrol) {
        // Get unequipped equipment items (weapons, armor, tools)
        const equipmentTypes = ['weapon', 'equipment', 'tool', 'consumable']
        const items = actor.items.filter(i => {
            if (!equipmentTypes.includes(i.type)) return false
            if (i.system?.equipped) return false
            if (i.system?.quantity <= 0) return false
            if (this._isQuestItem(i)) return false
            return true
        })
        
        if (items.length === 0) return null
        
        const item = items[Math.floor(Math.random() * items.length)]
        const itemData = item.toObject()
        
        // Remove from player
        if (item.system?.quantity > 1) {
            await item.update({ 'system.quantity': item.system.quantity - 1 })
            itemData.system.quantity = 1
        } else {
            await item.delete()
        }
        
        return { type: 'equipment', name: item.name, itemData }
    }
    
    /**
     * Steal miscellaneous item from actor
     * @returns {Object|null} Stolen item info
     */
    async _stealMiscItem(actor, patrol) {
        // Get misc items (loot, backpack items, trinkets)
        const miscTypes = ['loot', 'backpack', 'treasure']
        const items = actor.items.filter(i => {
            // Include misc types or items not in other categories
            const isMisc = miscTypes.includes(i.type) || 
                          !['weapon', 'equipment', 'tool', 'spell', 'feat', 'class', 'consumable'].includes(i.type)
            if (!isMisc) return false
            if (i.system?.quantity <= 0) return false
            if (this._isQuestItem(i)) return false
            return true
        })
        
        if (items.length === 0) return null
        
        const item = items[Math.floor(Math.random() * items.length)]
        const itemData = item.toObject()
        
        // Remove from player
        if (item.system?.quantity > 1) {
            await item.update({ 'system.quantity': item.system.quantity - 1 })
            itemData.system.quantity = 1
        } else {
            await item.delete()
        }
        
        return { type: 'misc', name: item.name, itemData }
    }
    
    /**
     * Check if item is a quest-critical item
     */
    _isQuestItem(item) {
        // Check various quest item indicators
        if (item.flags?.questItem) return true
        if (item.flags?.critical) return true
        if (item.system?.rarity === 'artifact') return true
        if (item.name?.toLowerCase().includes('quest')) return true
        if (item.name?.toLowerCase().includes('key')) return true
        if (item.name?.toLowerCase().includes('mcguffin')) return true
        // Check for module-specific quest flags
        if (item.flags?.[MODULE_ID]?.questItem) return true
        return false
    }
    
    /**
     * Transfer stolen items to guard actor for potential recovery
     */
    async _transferToGuard(patrol, stolenItems) {
        const transferEnabled = getSetting('theftTransferToGuard', false)
        if (!transferEnabled) return
        
        // Get the patrol's actor
        const patrolToken = canvas.tokens?.get(patrol.tokenId)
        const guardActor = patrolToken?.actor
        
        if (!guardActor) return
        
        // Create items on guard actor
        for (const stolen of stolenItems) {
            if (stolen.type === 'currency') {
                // Add gold to guard
                const currentGold = this._getActorGold(guardActor)
                await this._setActorGold(guardActor, currentGold + stolen.amount)
            } else if (stolen.itemData) {
                // Add item to guard's inventory
                await guardActor.createEmbeddedDocuments('Item', [stolen.itemData])
            }
        }
        
        debug(`Transferred ${stolenItems.length} stolen items to ${guardActor.name}`)
    }
    
    /**
     * Set gold on actor (system-agnostic)
     */
    async _setActorGold(actor, amount) {
        // D&D 5e
        if (actor.system?.currency?.gp !== undefined) {
            await actor.update({ 'system.currency.gp': amount })
            return
        }
        // PF2e
        if (actor.system?.details?.wealth?.value !== undefined) {
            await actor.update({ 'system.details.wealth.value': amount })
            return
        }
        // Generic
        if (actor.system?.gold !== undefined) {
            await actor.update({ 'system.gold': amount })
        }
    }
    
    // ==========================================
    // Outcome: Blindfold & Relocate
    // ==========================================

    async _executeBlindfold(captureData, patrol, playerToken, options = {}) {
        await this._playBark('capture', patrol)
        
        // Get settings
        const minDuration = getSetting('blindfoldMinDuration', 5) * 1000
        const maxDuration = getSetting('blindfoldMaxDuration', 10) * 1000
        const playAudio = getSetting('blindfoldPlayAudio', true)
        const fadeEffect = getSetting('blindfoldFadeEffect', true)
        
        // Random duration between min and max
        const duration = minDuration + Math.random() * (maxDuration - minDuration)
        
        // Blindfold the player with fade-to-black (if enabled)
        await this._blindfoldPlayer(playerToken, { fadeIn: fadeEffect })
        
        // Play ambient audio cues during blindness (if enabled)
        if (playAudio) {
            this._playBlindfoldAmbience(playerToken)
        }
        
        // Wait a portion of the duration before teleporting
        await new Promise(resolve => setTimeout(resolve, duration * 0.3))
        
        // Teleport to random location (player won't see it)
        const newPos = await this._getRandomSafeLocation(playerToken)
        if (newPos) {
            await playerToken.document.update({
                x: newPos.x,
                y: newPos.y,
                hidden: true // Hide during transport
            }, { animate: false })
        }
        
        // Wait remaining duration
        await new Promise(resolve => setTimeout(resolve, duration * 0.7))
        
        // Remove blindfold with fade-in vision
        await this._unblindPlayer(playerToken, { fadeOut: fadeEffect })
        
        // Unhide token
        await playerToken.document.update({ hidden: false })
        
        await this._playBark('blindfold_release', patrol)
        ui.notifications.info(`${playerToken.name} has been relocated... somewhere.`)
    }
    
    /**
     * Play ambient audio during blindfold
     */
    async _playBlindfoldAmbience(playerToken) {
        const userId = this._getTokenOwner(playerToken)
        if (!userId) return
        
        // Emit socket to play ambient sounds
        game.socket?.emit(`module.${MODULE_ID}`, {
            type: 'blindfoldAmbience',
            userId,
            sounds: [
                { delay: 1000, text: '*footsteps*' },
                { delay: 2500, text: '*muffled voices*' },
                { delay: 4000, text: '*dragging sounds*' },
                { delay: 6000, text: '*distant door*' }
            ]
        })
        
        // If we're the target, play locally
        if (game.userId === userId) {
            this._playLocalAmbience()
        }
    }
    
    /**
     * Play local blindfold ambience
     */
    _playLocalAmbience() {
        const sounds = [
            { delay: 1000, text: '*footsteps*' },
            { delay: 2500, text: '*muffled voices*' },
            { delay: 4000, text: '*dragging sounds*' },
            { delay: 6000, text: '*distant door*' }
        ]
        
        const overlay = document.getElementById('rnk-patrol-blindfold')
        if (!overlay) return
        
        const contentEl = overlay.querySelector('.blindfold-content p')
        if (!contentEl) return
        
        sounds.forEach(({ delay, text }) => {
            setTimeout(() => {
                if (overlay.classList.contains('active')) {
                    contentEl.textContent = text
                    // Fade text effect
                    contentEl.style.opacity = '0'
                    setTimeout(() => contentEl.style.opacity = '1', 100)
                }
            }, delay)
        })
    }

    /**
     * Apply blindfold effect to player
     */
    async _blindfoldPlayer(playerToken, options = {}) {
        const userId = this._getTokenOwner(playerToken)
        if (!userId) return
        
        this._blindfolded.add(playerToken.id)
        
        // Emit socket to apply blindfold UI
        game.socket?.emit(`module.${MODULE_ID}`, {
            type: 'blindfold',
            userId,
            tokenId: playerToken.id,
            fadeIn: options.fadeIn || false
        })
        
        // If we're the target, apply locally
        if (game.userId === userId) {
            this._applyBlindfoldUI(options)
        }
    }
    
    /**
     * Remove blindfold from player
     */
    async _unblindPlayer(playerToken, options = {}) {
        const userId = this._getTokenOwner(playerToken)
        if (!userId) return
        
        this._blindfolded.delete(playerToken.id)
        
        // Emit socket to remove blindfold UI
        game.socket?.emit(`module.${MODULE_ID}`, {
            type: 'unblind',
            userId,
            tokenId: playerToken.id,
            fadeOut: options.fadeOut || false
        })
        
        // If we're the target, remove locally
        if (game.userId === userId) {
            this._removeBlindfoldUI(options)
        }
    }
    
    /**
     * Apply blindfold UI overlay
     */
    _applyBlindfoldUI(options = {}) {
        // Create fullscreen black overlay
        let overlay = document.getElementById('rnk-patrol-blindfold')
        if (!overlay) {
            overlay = document.createElement('div')
            overlay.id = 'rnk-patrol-blindfold'
            overlay.innerHTML = `
                <div class="blindfold-content">
                    <i class="fas fa-eye-slash"></i>
                    <p>You have been blindfolded...</p>
                </div>
            `
            document.body.appendChild(overlay)
        }
        
        if (options.fadeIn) {
            overlay.classList.add('fade-in')
            setTimeout(() => overlay.classList.remove('fade-in'), 1000)
        }
        
        overlay.classList.add('active')
    }
    
    /**
     * Remove blindfold UI overlay
     */
    _removeBlindfoldUI(options = {}) {
        const overlay = document.getElementById('rnk-patrol-blindfold')
        if (!overlay) return
        
        if (options.fadeOut) {
            overlay.classList.add('fading')
            overlay.querySelector('.blindfold-content p').textContent = 'Your vision returns...'
            setTimeout(() => {
                overlay.classList.remove('active', 'fading')
                overlay.remove()
            }, 2000)
        } else {
            overlay.classList.remove('active')
            overlay.remove()
        }
    }
    
    /**
     * Handle blindfold socket message
     */
    _handleBlindfoldSocket(data) {
        if (data.userId === game.userId) {
            this._applyBlindfoldUI({ fadeIn: data.fadeIn })
            if (data.sounds) {
                this._playLocalAmbience()
            }
        }
    }
    
    /**
     * Handle unblind socket message
     */
    _handleUnblindSocket(data) {
        if (data.userId === game.userId) {
            this._removeBlindfoldUI({ fadeOut: data.fadeOut })
        }
    }
    
    /**
     * Get random SAFE walkable location on canvas (avoids walls)
     */
    async _getRandomSafeLocation(token) {
        const maxAttempts = 100
        const padding = 200
        const dimensions = canvas.dimensions
        
        for (let i = 0; i < maxAttempts; i++) {
            const x = padding + Math.random() * (dimensions.width - padding * 2)
            const y = padding + Math.random() * (dimensions.height - padding * 2)
            
            // Snap to grid
            const snapped = canvas.grid.getSnappedPoint({ x, y }, { mode: CONST.GRID_SNAPPING_MODES.CENTER })
            
            // Check for wall collisions
            const origin = { x: dimensions.width / 2, y: dimensions.height / 2 }
            const destination = snapped
            
            // Use Foundry's collision detection
            const hasCollision = CONFIG.Canvas.polygonBackends.move.testCollision(
                origin, destination, { type: 'move', mode: 'any' }
            )
            
            // Also check if position itself is in a wall
            const atWall = canvas.walls?.checkCollision(
                new Ray({ x: snapped.x - 1, y: snapped.y }, { x: snapped.x + 1, y: snapped.y }),
                { type: 'move', mode: 'any' }
            )
            
            if (!hasCollision && !atWall && snapped.x > 0 && snapped.y > 0) {
                return snapped
            }
        }
        
        // Fallback: return center of scene
        return { x: dimensions.width / 2, y: dimensions.height / 2 }
    }
    
    // ==========================================
    // Outcome: Disregard
    // ==========================================
    
    async _executeDisregard(captureData, patrol, playerToken, options = {}) {
        await this._playBark('disregard', patrol)
        
        ui.notifications.info(`${patrol.name} glances at ${playerToken.name}... "Must've been the wind."`)
        
        // Maybe reset patrol alert level
        if (patrol.setAlertLevel) {
            patrol.setAlertLevel('idle')
        }
    }
    
    // ==========================================
    // Outcome: Jail
    // ==========================================
    
    async _executeJail(captureData, patrol, playerToken, options = {}) {
        await this._playBark('capture', patrol)
        
        // Import jail system and roll a random jail (creates on-demand if needed)
        const { jailSystem } = await import('./JailSystem.js')
        
        // Roll random jail - this creates the scene if it doesn't exist
        const selectedJail = await jailSystem.rollRandomJail()
        
        if (!selectedJail) {
            ui.notifications.error('Failed to create jail scene! Check that jail map files exist.')
            // Fallback to combat
            return this._executeCombat(captureData, patrol, playerToken, options)
        }
        
        // Get the player who owns this token
        const userId = this._getTokenOwner(playerToken)
        
        // Use JailSystem's sendToJail for proper handling
        const prisonerData = await jailSystem.sendToJail(playerToken, {
            jailSceneId: selectedJail.id,
            capturedBy: patrol.name
        })
        
        if (!prisonerData) {
            ui.notifications.error('Failed to send player to jail!')
            return this._executeCombat(captureData, patrol, playerToken, options)
        }
        
        Hooks.callAll('rnkPatrol.playerJailed', {
            tokenId: playerToken.id,
            actorId: playerToken.actor?.id,
            jailSceneId: selectedJail.id,
            jailName: selectedJail.name,
            patrolName: patrol.name,
            prisonerData
        })
    }
    
    /**
     * Get configured jail scenes (DEPRECATED - use JailSystem.rollRandomJail instead)
     */
    _getJailScenes() {
        const jailSceneIds = getSetting('jailScenes', [])
        return jailSceneIds
            .map(id => game.scenes.get(id))
            .filter(s => s)
    }
    
    // ==========================================
    // Utility Methods
    // ==========================================
    
    /**
     * Get actor's gold (system-agnostic)
     */
    _getActorGold(actor) {
        // D&D 5e
        if (actor.system?.currency?.gp !== undefined) {
            return actor.system.currency.gp
        }
        // PF2e
        if (actor.system?.details?.wealth?.value !== undefined) {
            return actor.system.details.wealth.value
        }
        // Generic fallback
        if (actor.system?.gold !== undefined) {
            return actor.system.gold
        }
        return 0
    }
    
    /**
     * Remove gold from actor (system-agnostic)
     */
    async _removeGold(actor, amount) {
        const current = this._getActorGold(actor)
        const newAmount = Math.max(0, current - amount)
        
        // D&D 5e
        if (actor.system?.currency?.gp !== undefined) {
            await actor.update({ 'system.currency.gp': newAmount })
            return
        }
        // PF2e
        if (actor.system?.details?.wealth?.value !== undefined) {
            await actor.update({ 'system.details.wealth.value': newAmount })
            return
        }
        // Generic
        if (actor.system?.gold !== undefined) {
            await actor.update({ 'system.gold': newAmount })
        }
    }
    
    /**
     * Get the user ID who owns a token
     */
    _getTokenOwner(token) {
        const actor = token.actor
        if (!actor) return null
        
        // Find player who owns this actor
        for (const user of game.users) {
            if (user.isGM) continue
            if (actor.testUserPermission(user, "OWNER")) {
                return user.id
            }
        }
        return null
    }
    
    /**
     * Play audio bark
     */
    async _playBark(type, patrol) {
        const barksEnabled = getSetting('barksEnabled', true)
        if (!barksEnabled) return
        
        const barkSystem = game.rnkPatrol?.barks
        if (barkSystem) {
            await barkSystem.play(type, patrol)
        }
    }
    
    /**
     * Update settings (called when GM changes settings in hub)
     */
    updateSettings() {
        // Re-read settings on demand - nothing to cache
        debug('CaptureSystem settings updated')
    }
}

// Export singleton
export const captureSystem = new CaptureSystem()
