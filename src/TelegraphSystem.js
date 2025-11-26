/**
 * RNK Patrol - Telegraph System
 * 
 * Visual telegraph effects before patrol spawns.
 * Shows warning indicators to give players reaction time.
 * 
 * @module TelegraphSystem
 */

import { MODULE_ID, debug } from './main.js'
import { getSetting } from './settings.js'

/**
 * Telegraph types available
 */
export const TELEGRAPH_TYPES = {
    MAGIC_CIRCLE: 'magicCircle',
    PORTAL: 'portal',
    SHADOW: 'shadow',
    ENERGY: 'energy',
    SMOKE: 'smoke',
    RUNES: 'runes',
    NONE: 'none'
}

/**
 * TelegraphSystem - Visual warnings before patrol spawn
 */
export class TelegraphSystem {
    
    constructor() {
        /**
         * Active telegraph effects
         * @type {Map<string, PIXI.Container>}
         */
        this._activeEffects = new Map()
    }
    
    /**
     * Initialize the telegraph system
     */
    initialize() {
        debug('TelegraphSystem initialized')
    }
    
    /**
     * Show telegraph effect at position
     * @param {Point} position - Where to show effect
     * @param {Object} options - Effect options
     * @returns {Promise} Resolves when telegraph animation completes
     */
    async showTelegraph(position, options = {}) {
        const enabled = getSetting('telegraphEnabled', true)
        if (!enabled) return Promise.resolve()
        
        const duration = (options.duration || getSetting('telegraphDuration', 1.5)) * 1000
        const type = options.type || getSetting('defaultTelegraphType', TELEGRAPH_TYPES.MAGIC_CIRCLE)
        const color = options.color || getSetting('telegraphColor', '#ff6600')
        const size = options.size || getSetting('telegraphSize', 100)
        
        if (type === TELEGRAPH_TYPES.NONE) return Promise.resolve()
        
        const effectId = foundry.utils.randomID()
        
        // Check for JB2A integration
        const useJB2A = getSetting('useJB2A', false) && this._hasJB2A()
        
        if (useJB2A) {
            return this._showJB2ATelegraph(position, { ...options, duration, type, color, size, effectId })
        } else {
            return this._showBuiltInTelegraph(position, { duration, type, color, size, effectId })
        }
    }
    
    /**
     * Check if JB2A is available
     */
    _hasJB2A() {
        return game.modules.get('jb2a_patreon')?.active || game.modules.get('JB2A_DnD5e')?.active
    }
    
    /**
     * Show built-in telegraph effect
     */
    async _showBuiltInTelegraph(position, options) {
        const { duration, type, color, size, effectId } = options
        
        // Create container
        const container = new PIXI.Container()
        container.x = position.x
        container.y = position.y
        
        // Create effect based on type
        switch (type) {
            case TELEGRAPH_TYPES.MAGIC_CIRCLE:
                this._createMagicCircle(container, size, color)
                break
            case TELEGRAPH_TYPES.PORTAL:
                this._createPortal(container, size, color)
                break
            case TELEGRAPH_TYPES.SHADOW:
                this._createShadow(container, size)
                break
            case TELEGRAPH_TYPES.ENERGY:
                this._createEnergy(container, size, color)
                break
            case TELEGRAPH_TYPES.SMOKE:
                this._createSmoke(container, size)
                break
            case TELEGRAPH_TYPES.RUNES:
                this._createRunes(container, size, color)
                break
        }
        
        canvas.effects.addChild(container)
        this._activeEffects.set(effectId, container)
        
        // Animate
        return new Promise(resolve => {
            const startTime = Date.now()
            const animate = () => {
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)
                
                // Pulse and grow
                const pulse = 0.8 + Math.sin(progress * Math.PI * 4) * 0.2
                const scale = 0.5 + progress * 0.5
                
                container.scale.set(scale * pulse)
                container.alpha = Math.min(progress * 2, 1 - (progress - 0.5) * 2)
                container.rotation += 0.02
                
                if (progress < 1) {
                    requestAnimationFrame(animate)
                } else {
                    container.destroy({ children: true })
                    this._activeEffects.delete(effectId)
                    resolve()
                }
            }
            
            requestAnimationFrame(animate)
        })
    }
    
    /**
     * Create magic circle effect
     */
    _createMagicCircle(container, size, colorHex) {
        const color = PIXI.Color.shared.setValue(colorHex).toNumber()
        
        // Outer circle
        const outer = new PIXI.Graphics()
        outer.lineStyle(3, color, 0.8)
        outer.drawCircle(0, 0, size)
        container.addChild(outer)
        
        // Inner circle
        const inner = new PIXI.Graphics()
        inner.lineStyle(2, color, 0.6)
        inner.drawCircle(0, 0, size * 0.7)
        container.addChild(inner)
        
        // Cross lines
        const cross = new PIXI.Graphics()
        cross.lineStyle(2, color, 0.5)
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2
            cross.moveTo(0, 0)
            cross.lineTo(Math.cos(angle) * size, Math.sin(angle) * size)
        }
        container.addChild(cross)
        
        // Center glow
        const glow = new PIXI.Graphics()
        glow.beginFill(color, 0.3)
        glow.drawCircle(0, 0, size * 0.3)
        glow.endFill()
        container.addChild(glow)
    }
    
    /**
     * Create portal effect
     */
    _createPortal(container, size, colorHex) {
        const color = PIXI.Color.shared.setValue(colorHex).toNumber()
        
        // Swirling circles
        for (let i = 0; i < 5; i++) {
            const ring = new PIXI.Graphics()
            ring.lineStyle(4 - i * 0.5, color, 0.8 - i * 0.1)
            ring.drawCircle(0, 0, size - i * (size / 5))
            ring.rotation = i * 0.5
            container.addChild(ring)
        }
        
        // Center vortex
        const vortex = new PIXI.Graphics()
        vortex.beginFill(0x000000, 0.8)
        vortex.drawCircle(0, 0, size * 0.2)
        vortex.endFill()
        container.addChild(vortex)
    }
    
    /**
     * Create shadow effect
     */
    _createShadow(container, size) {
        // Dark spreading shadow
        const shadow = new PIXI.Graphics()
        shadow.beginFill(0x000000, 0.6)
        shadow.drawCircle(0, 0, size)
        shadow.endFill()
        container.addChild(shadow)
        
        // Wispy edges
        for (let i = 0; i < 8; i++) {
            const wisp = new PIXI.Graphics()
            const angle = (i / 8) * Math.PI * 2
            wisp.beginFill(0x000000, 0.4)
            wisp.moveTo(0, 0)
            wisp.lineTo(
                Math.cos(angle - 0.2) * size * 1.3,
                Math.sin(angle - 0.2) * size * 1.3
            )
            wisp.lineTo(
                Math.cos(angle + 0.2) * size * 1.3,
                Math.sin(angle + 0.2) * size * 1.3
            )
            wisp.closePath()
            wisp.endFill()
            container.addChild(wisp)
        }
    }
    
    /**
     * Create energy effect
     */
    _createEnergy(container, size, colorHex) {
        const color = PIXI.Color.shared.setValue(colorHex).toNumber()
        
        // Energy bolts
        for (let i = 0; i < 12; i++) {
            const bolt = new PIXI.Graphics()
            const angle = (i / 12) * Math.PI * 2
            bolt.lineStyle(2, color, 0.8)
            
            // Zigzag lightning
            const startX = 0
            const startY = 0
            const endX = Math.cos(angle) * size
            const endY = Math.sin(angle) * size
            
            bolt.moveTo(startX, startY)
            const segments = 4
            for (let j = 1; j <= segments; j++) {
                const t = j / segments
                const x = startX + (endX - startX) * t + (Math.random() - 0.5) * 20
                const y = startY + (endY - startY) * t + (Math.random() - 0.5) * 20
                bolt.lineTo(x, y)
            }
            
            container.addChild(bolt)
        }
        
        // Center spark
        const spark = new PIXI.Graphics()
        spark.beginFill(color, 0.9)
        spark.drawCircle(0, 0, size * 0.15)
        spark.endFill()
        container.addChild(spark)
    }
    
    /**
     * Create smoke effect
     */
    _createSmoke(container, size) {
        // Multiple smoke puffs
        for (let i = 0; i < 6; i++) {
            const puff = new PIXI.Graphics()
            const offsetX = (Math.random() - 0.5) * size * 0.5
            const offsetY = (Math.random() - 0.5) * size * 0.5
            const puffSize = size * (0.3 + Math.random() * 0.4)
            
            puff.beginFill(0x333333, 0.4)
            puff.drawCircle(offsetX, offsetY, puffSize)
            puff.endFill()
            container.addChild(puff)
        }
    }
    
    /**
     * Create runes effect
     */
    _createRunes(container, size, colorHex) {
        const color = PIXI.Color.shared.setValue(colorHex).toNumber()
        
        // Outer ring
        const ring = new PIXI.Graphics()
        ring.lineStyle(3, color, 0.7)
        ring.drawCircle(0, 0, size)
        container.addChild(ring)
        
        // Rune symbols (simplified)
        const runeChars = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ']
        const runeStyle = new PIXI.TextStyle({
            fontFamily: 'Signika',
            fontSize: 24,
            fill: colorHex,
            stroke: '#000000',
            strokeThickness: 2
        })
        
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 - Math.PI / 2
            const rune = new PIXI.Text(runeChars[i], runeStyle)
            rune.anchor.set(0.5)
            rune.x = Math.cos(angle) * size * 0.75
            rune.y = Math.sin(angle) * size * 0.75
            rune.rotation = angle + Math.PI / 2
            container.addChild(rune)
        }
    }
    
    /**
     * Show JB2A telegraph effect
     */
    async _showJB2ATelegraph(position, options) {
        const { duration, type, effectId } = options
        
        // Map telegraph types to JB2A effects
        const jb2aEffects = {
            [TELEGRAPH_TYPES.MAGIC_CIRCLE]: 'jb2a.magic_signs.circle.02.conjuration.loop.blue',
            [TELEGRAPH_TYPES.PORTAL]: 'jb2a.portals.vertical.vortex.blue',
            [TELEGRAPH_TYPES.ENERGY]: 'jb2a.static_electricity.03.blue',
            [TELEGRAPH_TYPES.RUNES]: 'jb2a.magic_signs.rune.conjuration.intro.blue'
        }
        
        const effectPath = jb2aEffects[type]
        if (!effectPath) {
            return this._showBuiltInTelegraph(position, options)
        }
        
        // Use Sequencer if available
        if (game.modules.get('sequencer')?.active) {
            return new Sequencer.EffectSection()
                .file(effectPath)
                .atLocation(position)
                .duration(duration)
                .fadeOut(300)
                .play()
        }
        
        // Fallback to built-in
        return this._showBuiltInTelegraph(position, options)
    }
    
    /**
     * Cancel all active telegraph effects
     */
    cancelAll() {
        for (const [id, container] of this._activeEffects) {
            container.destroy({ children: true })
        }
        this._activeEffects.clear()
    }
    
    /**
     * Preview a telegraph effect (GM only)
     */
    async preview(type, position) {
        if (!game.user.isGM) return
        
        const targetPos = position || canvas.stage.pivot
        await this.showTelegraph(targetPos, { type, duration: 2 })
    }
    
    /**
     * Update settings (called when GM changes settings in hub)
     */
    updateSettings() {
        // Re-read settings - nothing to cache, all reads happen on demand
        debug('TelegraphSystem settings updated')
    }
}

// Export singleton
export const telegraphSystem = new TelegraphSystem()
