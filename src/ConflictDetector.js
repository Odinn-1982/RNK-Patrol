/**
 * RNK Patrol - Module Conflict Detection System
 * 
 * Detects modules that may cause conflicts with RNK Patrol and alerts the GM
 */

import { MODULE_ID, MODULE_NAME, warn, log } from './main.js'

/**
 * List of known problematic modules that may conflict with RNK Patrol
 * Each entry contains the module ID and a description of the conflict
 */
const KNOWN_CONFLICTS = [
    {
        id: 'monks-active-tiles',
        name: 'Monk\'s Active Tiles',
        severity: 'medium',
        description: 'May interfere with waypoint triggers and token movement detection',
        suggestion: 'Configure Active Tiles to exclude patrol tokens'
    },
    {
        id: 'patrol',
        name: 'Patrol Module',
        severity: 'high',
        description: 'Another patrol module that uses similar token control methods',
        suggestion: 'Use only one patrol system at a time'
    },
    {
        id: 'token-attacher',
        name: 'Token Attacher',
        severity: 'medium',
        description: 'May cause issues with token teleportation and waypoint positioning',
        suggestion: 'Avoid attaching patrol tokens to other objects'
    },
    {
        id: 'drag-ruler',
        name: 'Drag Ruler',
        severity: 'low',
        description: 'May show movement paths for teleporting patrols',
        suggestion: 'This is cosmetic only and usually harmless'
    },
    {
        id: 'lib-wrapper',
        name: 'libWrapper',
        severity: 'info',
        description: 'Required dependency - ensure version is up to date',
        suggestion: 'Update to latest version if experiencing issues'
    },
    {
        id: 'socketlib',
        name: 'socketlib',
        severity: 'info',
        description: 'Required dependency - ensure version is up to date',
        suggestion: 'Update to latest version if experiencing issues'
    },
    {
        id: 'combat-utility-belt',
        name: 'Combat Utility Belt (CUB)',
        severity: 'medium',
        description: 'Condition and effect management may overlap',
        suggestion: 'Check effect stacking settings in both modules'
    },
    {
        id: 'pf2e-dorako-ui',
        name: 'Dorako UI',
        severity: 'low',
        description: 'UI styling may override RNK Patrol interface',
        suggestion: 'Adjust theme settings if UI elements look incorrect'
    }
]

/**
 * Conflict Detection Manager
 */
export class ConflictDetector {
    
    constructor() {
        this.detectedConflicts = []
        this.hasShownAlert = false
    }
    
    /**
     * Check for module conflicts
     * @returns {Array} Array of detected conflicts
     */
    detectConflicts() {
        this.detectedConflicts = []
        
        // Check each known conflict
        for (const conflict of KNOWN_CONFLICTS) {
            const module = game.modules.get(conflict.id)
            
            if (module && module.active) {
                this.detectedConflicts.push({
                    ...conflict,
                    version: module.version || 'Unknown'
                })
            }
        }
        
        // Check for modules that wrap critical methods
        this._checkMethodWrappers()
        
        // Check for modules that might interfere with canvas operations
        this._checkCanvasModifications()
        
        return this.detectedConflicts
    }
    
    /**
     * Check for modules that wrap methods we depend on
     */
    _checkMethodWrappers() {
        // Check if libWrapper is available and being used
        if (typeof libWrapper !== 'undefined') {
            log('libWrapper detected - this is expected and required')
        }
        
        // Check for modules that might wrap Token movement
        const activeModules = game.modules.filter(m => m.active)
        
        for (const module of activeModules) {
            // Look for modules with 'token' or 'movement' in their ID
            if ((module.id.includes('token') || module.id.includes('movement')) 
                && !KNOWN_CONFLICTS.find(k => k.id === module.id)
                && module.id !== MODULE_ID) {
                
                this.detectedConflicts.push({
                    id: module.id,
                    name: module.title || module.id,
                    severity: 'low',
                    description: 'May affect token movement or behavior',
                    suggestion: 'Monitor for unexpected behavior with patrols',
                    version: module.version || 'Unknown'
                })
            }
        }
    }
    
    /**
     * Check for canvas-modifying modules
     */
    _checkCanvasModifications() {
        // Check for modules that add canvas layers
        const activeModules = game.modules.filter(m => m.active)
        
        for (const module of activeModules) {
            if ((module.id.includes('canvas') || module.id.includes('layer'))
                && !KNOWN_CONFLICTS.find(k => k.id === module.id)
                && module.id !== MODULE_ID) {
                
                this.detectedConflicts.push({
                    id: module.id,
                    name: module.title || module.id,
                    severity: 'low',
                    description: 'Modifies canvas rendering - may affect waypoint visibility',
                    suggestion: 'Check waypoint visibility settings if markers are not appearing',
                    version: module.version || 'Unknown'
                })
            }
        }
    }
    
    /**
     * Show conflict alert to GM
     */
    async showConflictAlert() {
        if (!game.user.isGM) return
        if (this.hasShownAlert) return
        if (this.detectedConflicts.length === 0) return
        
        // Filter by severity
        const highSeverity = this.detectedConflicts.filter(c => c.severity === 'high')
        const mediumSeverity = this.detectedConflicts.filter(c => c.severity === 'medium')
        const lowSeverity = this.detectedConflicts.filter(c => c.severity === 'low')
        const info = this.detectedConflicts.filter(c => c.severity === 'info')
        
        // Build message
        let message = `<div style="max-height: 400px; overflow-y: auto;">`
        message += `<h3 style="margin-top: 0; color: #e94560;">RNK Patrol - Module Compatibility Report</h3>`
        
        if (highSeverity.length > 0) {
            message += `<h4 style="color: #ff4757; margin-bottom: 5px;"><i class="fas fa-exclamation-triangle"></i> High Priority Conflicts:</h4>`
            message += `<ul style="margin-top: 5px;">`
            for (const conflict of highSeverity) {
                message += this._formatConflict(conflict)
            }
            message += `</ul>`
        }
        
        if (mediumSeverity.length > 0) {
            message += `<h4 style="color: #ffa502; margin-bottom: 5px;"><i class="fas fa-exclamation-circle"></i> Medium Priority Conflicts:</h4>`
            message += `<ul style="margin-top: 5px;">`
            for (const conflict of mediumSeverity) {
                message += this._formatConflict(conflict)
            }
            message += `</ul>`
        }
        
        if (lowSeverity.length > 0) {
            message += `<h4 style="color: #ffd700; margin-bottom: 5px;"><i class="fas fa-info-circle"></i> Low Priority Issues:</h4>`
            message += `<ul style="margin-top: 5px;">`
            for (const conflict of lowSeverity) {
                message += this._formatConflict(conflict)
            }
            message += `</ul>`
        }
        
        if (info.length > 0) {
            message += `<h4 style="color: #00d4ff; margin-bottom: 5px;"><i class="fas fa-check-circle"></i> Information:</h4>`
            message += `<ul style="margin-top: 5px;">`
            for (const conflict of info) {
                message += this._formatConflict(conflict)
            }
            message += `</ul>`
        }
        
        message += `<p style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #444; font-size: 0.9em; color: #999;">`
        message += `<strong>Note:</strong> This is a compatibility check. Some modules may work fine together depending on your configuration.`
        message += `</p></div>`
        
        // Show dialog
        const dialog = new Dialog({
            title: 'RNK Patrol - Module Conflicts Detected',
            content: message,
            buttons: {
                ok: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Understood',
                    callback: () => {
                        this.hasShownAlert = true
                    }
                },
                dontShow: {
                    icon: '<i class="fas fa-ban"></i>',
                    label: 'Don\'t Show Again This Session',
                    callback: () => {
                        this.hasShownAlert = true
                        ui.notifications.info(`${MODULE_NAME}: Conflict warnings disabled for this session`)
                    }
                }
            },
            default: 'ok'
        }, {
            width: 600,
            height: 'auto'
        })
        
        dialog.render(true)
        
        // Also log to console
        warn('Module conflicts detected:', this.detectedConflicts)
    }
    
    /**
     * Format a single conflict for display
     */
    _formatConflict(conflict) {
        return `
            <li style="margin-bottom: 10px;">
                <strong>${conflict.name}</strong> <span style="color: #666;">(v${conflict.version})</span>
                <br>
                <span style="font-size: 0.9em; color: #aaa;">${conflict.description}</span>
                <br>
                <em style="font-size: 0.85em; color: #00d4ff;">→ ${conflict.suggestion}</em>
            </li>
        `
    }
    
    /**
     * Get a summary of conflicts
     */
    getSummary() {
        const counts = {
            high: this.detectedConflicts.filter(c => c.severity === 'high').length,
            medium: this.detectedConflicts.filter(c => c.severity === 'medium').length,
            low: this.detectedConflicts.filter(c => c.severity === 'low').length,
            info: this.detectedConflicts.filter(c => c.severity === 'info').length
        }
        
        return {
            total: this.detectedConflicts.length,
            ...counts,
            conflicts: this.detectedConflicts
        }
    }
}

/**
 * Initialize conflict detection
 */
export function initConflictDetection() {
    log('Initializing module conflict detection...')
    
    const detector = new ConflictDetector()
    
    // Store on game object for access
    game.rnkPatrol = game.rnkPatrol || {}
    game.rnkPatrol.conflictDetector = detector
    
    // Run detection on ready
    Hooks.once('ready', () => {
        setTimeout(() => {
            detector.detectConflicts()
            
            if (detector.detectedConflicts.length > 0) {
                log(`Found ${detector.detectedConflicts.length} potential module conflicts`)
                detector.showConflictAlert()
            } else {
                log('No module conflicts detected')
            }
        }, 2000) // Wait 2 seconds after ready to ensure all modules are loaded
    })
    
    // Re-check when modules are updated
    Hooks.on('updateModule', () => {
        detector.hasShownAlert = false
        setTimeout(() => {
            detector.detectConflicts()
        }, 1000)
    })
}
