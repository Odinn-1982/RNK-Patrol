/**
 * RNK Patrol - Visual Effects System
 * 
 * Handles all appear/disappear animations for patrol tokens.
 * Inspired by RNK Zoner's teleportation effects.
 * 
 * @module PatrolEffects
 */

import { MODULE_ID, debug } from './main.js'
import { getSetting } from './settings.js'

/**
 * PatrolEffects - Visual effects for patrol appearance/disappearance
 */
export class PatrolEffects {
    
    /**
     * Effect type definitions
     */
    static EFFECT_TYPES = {
        FADE: 'fade',
        FLASH: 'flash',
        SMOKE: 'smoke',
        PORTAL: 'portal',
        SHADOW: 'shadow',
        GLITCH: 'glitch',
        NONE: 'none'
    }
    
    /**
     * Active effect containers
     * @type {Map<string, PIXI.Container>}
     */
    static _activeEffects = new Map()
    
    // ==========================================
    // Main Effect Methods
    // ==========================================
    
    /**
     * Play appear effect
     * @param {Object} options
     */
    static async playAppearEffect(options) {
        const { x, y, effectType, color, tokenId } = options
        
        if (!getSetting('enableEffects', true) || !canvas.ready) return
        
        const type = effectType || getSetting('defaultEffectType', 'fade')
        
        debug(`Playing appear effect: ${type} at (${x}, ${y})`)
        
        switch (type) {
            case this.EFFECT_TYPES.FADE:
                await this._fadeIn(x, y, color, tokenId)
                break
            case this.EFFECT_TYPES.FLASH:
                await this._flashIn(x, y, color)
                break
            case this.EFFECT_TYPES.SMOKE:
                await this._smokeIn(x, y, color)
                break
            case this.EFFECT_TYPES.PORTAL:
                await this._portalIn(x, y, color)
                break
            case this.EFFECT_TYPES.SHADOW:
                await this._shadowIn(x, y, color)
                break
            case this.EFFECT_TYPES.GLITCH:
                await this._glitchIn(x, y, color, tokenId)
                break
            case this.EFFECT_TYPES.NONE:
            default:
                break
        }
        
        // Play sound
        await this._playSound('appear')
    }
    
    /**
     * Play disappear effect
     * @param {Object} options
     */
    static async playDisappearEffect(options) {
        const { x, y, effectType, color, tokenId } = options
        
        if (!getSetting('enableEffects', true) || !canvas.ready) return
        
        const type = effectType || getSetting('defaultEffectType', 'fade')
        
        debug(`Playing disappear effect: ${type} at (${x}, ${y})`)
        
        switch (type) {
            case this.EFFECT_TYPES.FADE:
                await this._fadeOut(x, y, color, tokenId)
                break
            case this.EFFECT_TYPES.FLASH:
                await this._flashOut(x, y, color)
                break
            case this.EFFECT_TYPES.SMOKE:
                await this._smokeOut(x, y, color)
                break
            case this.EFFECT_TYPES.PORTAL:
                await this._portalOut(x, y, color)
                break
            case this.EFFECT_TYPES.SHADOW:
                await this._shadowOut(x, y, color)
                break
            case this.EFFECT_TYPES.GLITCH:
                await this._glitchOut(x, y, color, tokenId)
                break
            case this.EFFECT_TYPES.NONE:
            default:
                break
        }
        
        // Play sound
        await this._playSound('disappear')
    }
    
    // ==========================================
    // Fade Effects
    // ==========================================
    
    /**
     * Fade in effect
     */
    static async _fadeIn(x, y, color, tokenId) {
        const token = canvas.tokens.get(tokenId)
        if (!token || !token.mesh) {
            debug('_fadeIn: token or mesh not found, skipping effect')
            return
        }
        
        // Start fully transparent
        token.mesh.alpha = 0
        
        // Animate to full opacity
        return new Promise(resolve => {
            const duration = 500
            const startTime = Date.now()
            
            const animate = () => {
                if (!token.mesh) {
                    resolve()
                    return
                }
                
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)
                
                token.mesh.alpha = this._easeOutQuad(progress)
                
                if (progress < 1) {
                    requestAnimationFrame(animate)
                } else {
                    resolve()
                }
            }
            
            requestAnimationFrame(animate)
        })
    }
    
    /**
     * Fade out effect
     */
    static async _fadeOut(x, y, color, tokenId) {
        const token = canvas.tokens.get(tokenId)
        if (!token || !token.mesh) {
            debug('_fadeOut: token or mesh not found, skipping effect')
            return
        }
        
        // Animate to transparent
        return new Promise(resolve => {
            const duration = 500
            const startTime = Date.now()
            
            const animate = () => {
                if (!token.mesh) {
                    resolve()
                    return
                }
                
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)
                
                token.mesh.alpha = 1 - this._easeInQuad(progress)
                
                if (progress < 1) {
                    requestAnimationFrame(animate)
                } else {
                    token.mesh.alpha = 0
                    resolve()
                }
            }
            
            requestAnimationFrame(animate)
        })
    }
    
    // ==========================================
    // Flash Effects
    // ==========================================
    
    /**
     * Flash in effect
     */
    static async _flashIn(x, y, color) {
        const effectColor = this._parseColor(color) || 0xFFFFFF
        
        // Create flash overlay
        const flash = new PIXI.Graphics()
        flash.beginFill(effectColor, 0.8)
        flash.drawCircle(0, 0, canvas.grid.size * 1.5)
        flash.endFill()
        flash.x = x
        flash.y = y
        
        canvas.interface.addChild(flash)
        
        // Animate flash
        return new Promise(resolve => {
            const duration = 300
            const startTime = Date.now()
            
            const animate = () => {
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)
                
                flash.alpha = 1 - progress
                flash.scale.set(1 + progress * 0.5)
                
                if (progress < 1) {
                    requestAnimationFrame(animate)
                } else {
                    flash.destroy()
                    resolve()
                }
            }
            
            requestAnimationFrame(animate)
        })
    }
    
    /**
     * Flash out effect
     */
    static async _flashOut(x, y, color) {
        const effectColor = this._parseColor(color) || 0xFFFFFF
        
        // Create flash overlay
        const flash = new PIXI.Graphics()
        flash.beginFill(effectColor, 0)
        flash.drawCircle(0, 0, canvas.grid.size * 1.5)
        flash.endFill()
        flash.x = x
        flash.y = y
        
        canvas.interface.addChild(flash)
        
        // Animate flash
        return new Promise(resolve => {
            const duration = 300
            const startTime = Date.now()
            
            const animate = () => {
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)
                
                flash.alpha = Math.min(progress * 2, 1) * 0.8
                
                if (progress < 1) {
                    requestAnimationFrame(animate)
                } else {
                    // Quick fade out
                    setTimeout(() => {
                        flash.destroy()
                    }, 100)
                    resolve()
                }
            }
            
            requestAnimationFrame(animate)
        })
    }
    
    // ==========================================
    // Smoke Effects
    // ==========================================
    
    /**
     * Smoke in effect
     */
    static async _smokeIn(x, y, color) {
        const effectColor = this._parseColor(color) || 0x444444
        const particleCount = 12
        const container = new PIXI.Container()
        container.x = x
        container.y = y
        
        canvas.interface.addChild(container)
        
        // Create smoke particles
        const particles = []
        for (let i = 0; i < particleCount; i++) {
            const particle = new PIXI.Graphics()
            particle.beginFill(effectColor, 0.6)
            particle.drawCircle(0, 0, 8 + Math.random() * 8)
            particle.endFill()
            
            const angle = (Math.PI * 2 * i) / particleCount
            const distance = 60 + Math.random() * 20
            particle.x = Math.cos(angle) * distance
            particle.y = Math.sin(angle) * distance
            particle.targetX = 0
            particle.targetY = 0
            
            container.addChild(particle)
            particles.push(particle)
        }
        
        // Animate particles converging
        return new Promise(resolve => {
            const duration = 600
            const startTime = Date.now()
            
            const animate = () => {
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)
                const eased = this._easeOutQuad(progress)
                
                for (const particle of particles) {
                    particle.x = particle.x * (1 - eased * 0.1)
                    particle.y = particle.y * (1 - eased * 0.1)
                    particle.alpha = 1 - progress
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animate)
                } else {
                    container.destroy({ children: true })
                    resolve()
                }
            }
            
            requestAnimationFrame(animate)
        })
    }
    
    /**
     * Smoke out effect
     */
    static async _smokeOut(x, y, color) {
        const effectColor = this._parseColor(color) || 0x444444
        const particleCount = 12
        const container = new PIXI.Container()
        container.x = x
        container.y = y
        
        canvas.interface.addChild(container)
        
        // Create smoke particles
        const particles = []
        for (let i = 0; i < particleCount; i++) {
            const particle = new PIXI.Graphics()
            particle.beginFill(effectColor, 0.6)
            particle.drawCircle(0, 0, 8 + Math.random() * 8)
            particle.endFill()
            
            const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5
            particle.x = 0
            particle.y = 0
            particle.targetX = Math.cos(angle) * (60 + Math.random() * 40)
            particle.targetY = Math.sin(angle) * (60 + Math.random() * 40)
            
            container.addChild(particle)
            particles.push(particle)
        }
        
        // Animate particles dispersing
        return new Promise(resolve => {
            const duration = 600
            const startTime = Date.now()
            
            const animate = () => {
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)
                const eased = this._easeOutQuad(progress)
                
                for (const particle of particles) {
                    particle.x = particle.targetX * eased
                    particle.y = particle.targetY * eased
                    particle.alpha = 1 - progress
                    particle.scale.set(1 + progress)
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animate)
                } else {
                    container.destroy({ children: true })
                    resolve()
                }
            }
            
            requestAnimationFrame(animate)
        })
    }
    
    // ==========================================
    // Portal Effects
    // ==========================================
    
    /**
     * Portal in effect
     */
    static async _portalIn(x, y, color) {
        const effectColor = this._parseColor(color) || 0x6666FF
        const container = new PIXI.Container()
        container.x = x
        container.y = y
        
        canvas.interface.addChild(container)
        
        // Create portal ring
        const ring = new PIXI.Graphics()
        ring.lineStyle(4, effectColor, 0.8)
        ring.drawCircle(0, 0, canvas.grid.size)
        container.addChild(ring)
        
        // Inner swirl particles
        const swirls = []
        for (let i = 0; i < 8; i++) {
            const swirl = new PIXI.Graphics()
            swirl.beginFill(effectColor, 0.6)
            swirl.drawCircle(0, 0, 4)
            swirl.endFill()
            swirl.angle = (Math.PI * 2 * i) / 8
            swirl.radius = canvas.grid.size * 0.8
            container.addChild(swirl)
            swirls.push(swirl)
        }
        
        return new Promise(resolve => {
            const duration = 800
            const startTime = Date.now()
            
            const animate = () => {
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)
                
                // Shrink ring
                ring.scale.set(1 - progress * 0.8)
                ring.alpha = 1 - progress
                
                // Spiral swirls inward
                for (const swirl of swirls) {
                    swirl.angle += 0.15
                    swirl.radius *= 0.95
                    swirl.x = Math.cos(swirl.angle) * swirl.radius
                    swirl.y = Math.sin(swirl.angle) * swirl.radius
                    swirl.alpha = 1 - progress
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animate)
                } else {
                    container.destroy({ children: true })
                    resolve()
                }
            }
            
            requestAnimationFrame(animate)
        })
    }
    
    /**
     * Portal out effect
     */
    static async _portalOut(x, y, color) {
        const effectColor = this._parseColor(color) || 0x6666FF
        const container = new PIXI.Container()
        container.x = x
        container.y = y
        
        canvas.interface.addChild(container)
        
        // Create expanding portal ring
        const ring = new PIXI.Graphics()
        ring.lineStyle(4, effectColor, 0)
        ring.drawCircle(0, 0, 10)
        container.addChild(ring)
        
        return new Promise(resolve => {
            const duration = 600
            const startTime = Date.now()
            
            const animate = () => {
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)
                
                ring.clear()
                ring.lineStyle(4 * (1 - progress), effectColor, 0.8 * (1 - progress))
                ring.drawCircle(0, 0, 10 + progress * canvas.grid.size)
                
                if (progress < 1) {
                    requestAnimationFrame(animate)
                } else {
                    container.destroy({ children: true })
                    resolve()
                }
            }
            
            requestAnimationFrame(animate)
        })
    }
    
    // ==========================================
    // Shadow Effects
    // ==========================================
    
    /**
     * Shadow in effect (emerging from darkness)
     */
    static async _shadowIn(x, y, color) {
        const container = new PIXI.Container()
        container.x = x
        container.y = y
        
        canvas.interface.addChild(container)
        
        // Dark pool
        const pool = new PIXI.Graphics()
        pool.beginFill(0x000000, 0.8)
        pool.drawEllipse(0, 20, canvas.grid.size, canvas.grid.size * 0.3)
        pool.endFill()
        container.addChild(pool)
        
        // Shadow tendrils
        const tendrils = []
        for (let i = 0; i < 6; i++) {
            const tendril = new PIXI.Graphics()
            tendril.beginFill(0x000000, 0.6)
            tendril.drawRect(-3, 0, 6, 40)
            tendril.endFill()
            tendril.x = (i - 2.5) * 15
            tendril.y = 20
            tendril.pivot.set(0, 40)
            container.addChild(tendril)
            tendrils.push(tendril)
        }
        
        return new Promise(resolve => {
            const duration = 700
            const startTime = Date.now()
            
            const animate = () => {
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)
                
                // Shrink pool
                pool.alpha = 1 - progress
                pool.scale.y = 1 - progress * 0.5
                
                // Retract tendrils
                for (const tendril of tendrils) {
                    tendril.scale.y = 1 - progress
                    tendril.alpha = 1 - progress
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animate)
                } else {
                    container.destroy({ children: true })
                    resolve()
                }
            }
            
            requestAnimationFrame(animate)
        })
    }
    
    /**
     * Shadow out effect (sinking into darkness)
     */
    static async _shadowOut(x, y, color) {
        const container = new PIXI.Container()
        container.x = x
        container.y = y
        
        canvas.interface.addChild(container)
        
        // Dark pool expanding
        const pool = new PIXI.Graphics()
        pool.beginFill(0x000000, 0)
        pool.drawEllipse(0, 20, 10, 5)
        pool.endFill()
        container.addChild(pool)
        
        return new Promise(resolve => {
            const duration = 600
            const startTime = Date.now()
            
            const animate = () => {
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)
                
                pool.clear()
                pool.beginFill(0x000000, progress * 0.8)
                pool.drawEllipse(0, 20, 10 + progress * canvas.grid.size, 5 + progress * canvas.grid.size * 0.3)
                pool.endFill()
                
                if (progress < 1) {
                    requestAnimationFrame(animate)
                } else {
                    // Fade out pool
                    setTimeout(() => {
                        container.destroy({ children: true })
                    }, 200)
                    resolve()
                }
            }
            
            requestAnimationFrame(animate)
        })
    }
    
    // ==========================================
    // Glitch Effects
    // ==========================================
    
    /**
     * Glitch in effect
     */
    static async _glitchIn(x, y, color, tokenId) {
        const token = canvas.tokens.get(tokenId)
        if (!token) return
        
        return new Promise(resolve => {
            const duration = 400
            const startTime = Date.now()
            let lastGlitch = 0
            
            const animate = () => {
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)
                
                // Random glitch offsets
                if (elapsed - lastGlitch > 50) {
                    const glitchX = (Math.random() - 0.5) * 20 * (1 - progress)
                    const glitchY = (Math.random() - 0.5) * 20 * (1 - progress)
                    token.mesh.x = token.x + glitchX
                    token.mesh.y = token.y + glitchY
                    token.mesh.alpha = Math.random() > 0.3 ? 1 : 0.3
                    lastGlitch = elapsed
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animate)
                } else {
                    token.mesh.x = token.x
                    token.mesh.y = token.y
                    token.mesh.alpha = 1
                    resolve()
                }
            }
            
            requestAnimationFrame(animate)
        })
    }
    
    /**
     * Glitch out effect
     */
    static async _glitchOut(x, y, color, tokenId) {
        const token = canvas.tokens.get(tokenId)
        if (!token) return
        
        return new Promise(resolve => {
            const duration = 400
            const startTime = Date.now()
            let lastGlitch = 0
            
            const animate = () => {
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)
                
                // Increasing glitch intensity
                if (elapsed - lastGlitch > 40) {
                    const intensity = progress * 30
                    const glitchX = (Math.random() - 0.5) * intensity
                    const glitchY = (Math.random() - 0.5) * intensity
                    token.mesh.x = token.x + glitchX
                    token.mesh.y = token.y + glitchY
                    token.mesh.alpha = Math.random() > progress ? 1 : 0.2
                    lastGlitch = elapsed
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animate)
                } else {
                    token.mesh.x = token.x
                    token.mesh.y = token.y
                    token.mesh.alpha = 0
                    resolve()
                }
            }
            
            requestAnimationFrame(animate)
        })
    }
    
    // ==========================================
    // Sound Effects
    // ==========================================
    
    /**
     * Play effect sound
     * @param {string} type 
     */
    static async _playSound(type) {
        if (!getSetting('enableSounds', true)) return
        
        const volume = getSetting('soundVolume', 0.5)
        
        // Default Foundry sounds - can be customized later
        const soundPath = type === 'appear' 
            ? 'sounds/notify.wav'
            : 'sounds/lock.wav'
        
        try {
            await foundry.audio.AudioHelper.play({
                src: soundPath,
                volume,
                autoplay: true,
                loop: false
            }, true)
        } catch (err) {
            debug('Sound playback error:', err)
        }
    }
    
    // ==========================================
    // Utility Methods
    // ==========================================
    
    /**
     * Parse color string to number
     * @param {string|number} color 
     * @returns {number|null}
     */
    static _parseColor(color) {
        if (typeof color === 'number') return color
        if (!color) return null
        
        try {
            return PIXI.Color.shared.setValue(color).toNumber()
        } catch {
            return null
        }
    }
    
    /**
     * Ease out quad
     * @param {number} t 
     * @returns {number}
     */
    static _easeOutQuad(t) {
        return t * (2 - t)
    }
    
    /**
     * Ease in quad
     * @param {number} t 
     * @returns {number}
     */
    static _easeInQuad(t) {
        return t * t
    }
    
    /**
     * Ease in out quad
     * @param {number} t 
     * @returns {number}
     */
    static _easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    }
    
    /**
     * Cleanup all active effects
     */
    static cleanup() {
        for (const [id, container] of this._activeEffects) {
            container.destroy({ children: true })
        }
        this._activeEffects.clear()
    }
}
