/**
 * RNK Patrol - Audio Bark System
 * 
 * Plays context-appropriate voice clips for patrol actions.
 * 
 * @module BarkSystem
 */

import { MODULE_ID, debug } from './main.js'
import { getSetting } from './settings.js'

/**
 * Bark types and their default sound paths
 */
export const BARK_TYPES = {
    // Patrol actions
    SPAWN: 'spawn',
    DESPAWN: 'despawn',
    
    // Capture actions
    CAPTURE: 'capture',
    DISREGARD: 'disregard',
    THEFT: 'theft',
    THEFT_RELEASE: 'theft_release',
    
    // Bribery
    BRIBERY_ACCEPT: 'bribery_accept',
    BRIBERY_GENEROUS: 'bribery_generous',
    BRIBERY_BETRAYAL: 'bribery_betrayal',
    
    // Blindfold
    BLINDFOLD_RELEASE: 'blindfold_release',
    
    // Alert states
    ALERT: 'alert',
    INVESTIGATE: 'investigate',
    ALL_CLEAR: 'all_clear'
}

/**
 * Default bark text for chat display
 */
export const BARK_TEXT = {
    [BARK_TYPES.SPAWN]: [
        "Resuming patrol.",
        "Something feels off tonight.",
        "All quiet... for now.",
        "Back to work.",
        "Stay vigilant."
    ],
    [BARK_TYPES.DESPAWN]: [
        "All clear here.",
        "Moving to next position.",
        "Sector secure.",
        "Nothing to report.",
        "Continuing patrol."
    ],
    [BARK_TYPES.CAPTURE]: [
        "Freeze!",
        "Got one!",
        "You're under arrest!",
        "Don't move!",
        "Halt! You're coming with me!",
        "End of the line, criminal!"
    ],
    [BARK_TYPES.DISREGARD]: [
        "Must've been the wind.",
        "False alarm.",
        "Hmm... nothing here.",
        "Thought I saw something.",
        "Rats again, probably."
    ],
    [BARK_TYPES.THEFT]: [
        "I'll be taking this.",
        "Consider it a fine.",
        "This'll cover the paperwork.",
        "A little contribution to the guard fund.",
        "You won't be needing this."
    ],
    [BARK_TYPES.THEFT_RELEASE]: [
        "Now get out of my sight.",
        "Don't let me catch you again.",
        "Move along.",
        "Consider yourself lucky.",
        "Scram!"
    ],
    [BARK_TYPES.BRIBERY_ACCEPT]: [
        "Very well... move along quickly.",
        "This never happened.",
        "A wise decision.",
        "You've got good sense.",
        "Pleasure doing business."
    ],
    [BARK_TYPES.BRIBERY_GENEROUS]: [
        "Just get out of here.",
        "Keep your coin, but don't come back.",
        "I'm feeling generous today.",
        "Go. Now. Before I change my mind.",
        "This one's on me."
    ],
    [BARK_TYPES.BRIBERY_BETRAYAL]: [
        "I'll take that... and you're still coming with me!",
        "Thanks for the gold. Now move it!",
        "Did you really think that would work?",
        "Nice try. Now you're REALLY in trouble.",
        "Double the crime, double the punishment!"
    ],
    [BARK_TYPES.BLINDFOLD_RELEASE]: [
        "Maybe you'll think twice next time.",
        "Good luck finding your way back.",
        "That should teach you.",
        "Don't know where you are? Good.",
        "Enjoy the walk home."
    ],
    [BARK_TYPES.ALERT]: [
        "What was that?!",
        "Stay alert!",
        "Something's wrong!",
        "I heard something!",
        "Eyes open, everyone!"
    ],
    [BARK_TYPES.INVESTIGATE]: [
        "Checking it out.",
        "Hold on, I see something.",
        "Let me investigate.",
        "Wait here.",
        "What do we have here?"
    ],
    [BARK_TYPES.ALL_CLEAR]: [
        "False alarm.",
        "Area secure.",
        "Nothing to worry about.",
        "Stand down.",
        "Back to normal patrol."
    ]
}

/**
 * BarkSystem - Manages audio barks for patrols
 */
export class BarkSystem {
    
    constructor() {
        /**
         * Custom sound paths by bark type
         * @type {Map<string, string[]>}
         */
        this._customSounds = new Map()
        
        /**
         * Last bark timestamps to prevent spam
         * @type {Map<string, number>}
         */
        this._lastBark = new Map()
        
        /**
         * Minimum time between barks (ms)
         * @type {number}
         */
        this._barkCooldown = 3000
    }
    
    /**
     * Initialize the bark system
     */
    initialize() {
        debug('BarkSystem initialized')
        this._loadCustomSounds()
    }
    
    /**
     * Load custom sounds from settings
     */
    _loadCustomSounds() {
        const customPaths = getSetting('customBarkPaths', {})
        
        for (const [type, paths] of Object.entries(customPaths)) {
            if (Array.isArray(paths) && paths.length > 0) {
                this._customSounds.set(type, paths)
            }
        }
    }
    
    /**
     * Play a bark
     * @param {string} type - Bark type
     * @param {Patrol|Object} patrol - Patrol object (for name/position)
     * @param {Object} options - Additional options
     */
    async play(type, patrol, options = {}) {
        if (!getSetting('barksEnabled', true)) return
        
        // Check cooldown
        const lastTime = this._lastBark.get(type) || 0
        if (Date.now() - lastTime < this._barkCooldown && !options.force) {
            return
        }
        this._lastBark.set(type, Date.now())
        
        // Get bark text
        const text = this._getRandomBarkText(type)
        
        // Display in chat
        if (getSetting('showBarkChat', true)) {
            await this._displayChatBark(patrol, text, type)
        }
        
        // Play sound
        if (getSetting('playBarkSound', true)) {
            await this._playSound(type, patrol)
        }
        
        // Show floating text on canvas
        if (getSetting('showBarkFloat', true) && patrol?.tokenId) {
            this._displayFloatingText(patrol.tokenId, text)
        }
    }
    
    /**
     * Get random bark text
     */
    _getRandomBarkText(type) {
        const texts = BARK_TEXT[type] || ['...']
        return texts[Math.floor(Math.random() * texts.length)]
    }
    
    /**
     * Display bark in chat
     */
    async _displayChatBark(patrol, text, type) {
        const speakerName = patrol?.name || 'Guard'
        const tokenId = patrol?.tokenId
        
        // Get token image if available
        let img = 'icons/svg/mystery-man.svg'
        if (tokenId) {
            const token = canvas.tokens?.get(tokenId)
            if (token?.document?.texture?.src) {
                img = token.document.texture.src
            }
        }
        
        // Create chat message
        await ChatMessage.create({
            speaker: {
                alias: speakerName,
                token: tokenId
            },
            content: `<div class="rnk-patrol-bark ${type}">
                <div class="bark-content">
                    <em>"${text}"</em>
                </div>
            </div>`,
            type: CONST.CHAT_MESSAGE_TYPES.IC,
            flags: {
                [MODULE_ID]: {
                    barkType: type
                }
            }
        })
    }
    
    /**
     * Play bark sound
     */
    async _playSound(type, patrol) {
        // Check for custom sounds
        const customPaths = this._customSounds.get(type)
        
        let soundPath
        if (customPaths && customPaths.length > 0) {
            soundPath = customPaths[Math.floor(Math.random() * customPaths.length)]
        } else {
            // Use module default sounds
            soundPath = this._getDefaultSoundPath(type)
        }
        
        if (!soundPath) return
        
        try {
            const volume = getSetting('barkVolume', 0.5)
            
            // Get position for 3D audio if available
            let position = null
            if (patrol?.tokenId) {
                const token = canvas.tokens?.get(patrol.tokenId)
                if (token) {
                    position = { x: token.x, y: token.y }
                }
            }
            
            await AudioHelper.play({
                src: soundPath,
                volume,
                autoplay: true,
                loop: false
            }, true) // true = push to other clients
            
        } catch (error) {
            debug(`Failed to play bark sound: ${error.message}`)
        }
    }
    
    /**
     * Get default sound path for bark type
     */
    _getDefaultSoundPath(type) {
        // Module's built-in sounds
        const basePath = `modules/${MODULE_ID}/sounds/barks/`
        
        const sounds = {
            [BARK_TYPES.SPAWN]: `${basePath}patrol.mp3`,
            [BARK_TYPES.DESPAWN]: `${basePath}moving.mp3`,
            [BARK_TYPES.CAPTURE]: `${basePath}capture.mp3`,
            [BARK_TYPES.DISREGARD]: `${basePath}disregard.mp3`,
            [BARK_TYPES.THEFT]: `${basePath}theft.mp3`,
            [BARK_TYPES.ALERT]: `${basePath}alert.mp3`
        }
        
        return sounds[type] || null
    }
    
    /**
     * Display floating text above token
     */
    _displayFloatingText(tokenId, text) {
        const token = canvas.tokens?.get(tokenId)
        if (!token) return
        
        // Create floating text
        const style = new PIXI.TextStyle({
            fontFamily: 'Signika',
            fontSize: 18,
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowBlur: 4,
            dropShadowAngle: Math.PI / 6,
            dropShadowDistance: 2,
            wordWrap: true,
            wordWrapWidth: 200
        })
        
        const floatText = new PIXI.Text(`"${text}"`, style)
        floatText.anchor.set(0.5, 1)
        floatText.x = token.center.x
        floatText.y = token.y - 20
        floatText.alpha = 1
        
        canvas.controls.addChild(floatText)
        
        // Animate float and fade
        const startY = floatText.y
        const endY = startY - 60
        const duration = 3000
        const startTime = Date.now()
        
        const animate = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)
            
            floatText.y = startY + (endY - startY) * progress
            floatText.alpha = 1 - progress
            
            if (progress < 1) {
                requestAnimationFrame(animate)
            } else {
                floatText.destroy()
            }
        }
        
        requestAnimationFrame(animate)
    }
    
    /**
     * Set custom sounds for a bark type
     * @param {string} type 
     * @param {string[]} soundPaths 
     */
    setCustomSounds(type, soundPaths) {
        this._customSounds.set(type, soundPaths)
    }
    
    /**
     * Preview a bark (GM only)
     * @param {string} type 
     */
    async preview(type) {
        if (!game.user.isGM) return
        
        await this.play(type, { name: 'Preview Guard', tokenId: null }, { force: true })
    }
}

// Export singleton
export const barkSystem = new BarkSystem()

// Add missing methods to the class prototype
BarkSystem.prototype.updateSettings = function() {
    this._loadCustomSounds()
    this._barkCooldown = getSetting('barkCooldown', 2000)
}

// Alias for playBark method used by GM Hub
BarkSystem.prototype.playBark = async function(category, x, y) {
    // Create a mock patrol object for preview
    const mockPatrol = {
        name: 'Preview',
        tokenId: null
    }
    await this.play(category, mockPatrol, { force: true })
}
