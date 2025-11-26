/**
 * RNK Patrol - Jail System
 * 
 * Manages jail scenes with HARDCODED map assets bundled in the module.
 * Auto-creates jail scenes from pre-made map images.
 * 
 * Required assets in: modules/rnk-patrol/assets/maps/jails/
 * - dungeon.webp, barracks.webp, cavern.webp, tower.webp, city_watch.webp
 * - castle.webp, thieves_guild.webp, temple.webp, military.webp, ancient.webp
 */

import { MODULE_ID, debug } from './main.js'
import { getSetting, setSetting } from './settings.js'

// ==========================================
// HARDCODED JAIL CONFIGURATIONS
// ==========================================

const JAIL_CONFIGS = {
    dungeon: {
        id: 'dungeon',
        name: 'Medieval Dungeon',
        description: 'Classic stone dungeon with iron bars and torchlight',
        mapPath: `modules/${MODULE_ID}/assets/maps/jails/dungeon.webp`,
        gridSize: 100,
        width: 2000,
        height: 2000,
        padding: 0.1,
        backgroundColor: '#0d0d0d',
        // Where prisoners spawn when teleported to this jail
        spawnPoint: { x: 1000, y: 1000 },
        // Individual cell positions for multiple prisoners
        cellLocations: [
            { x: 400, y: 400 },
            { x: 400, y: 800 },
            { x: 400, y: 1200 },
            { x: 400, y: 1600 },
            { x: 1600, y: 400 },
            { x: 1600, y: 800 },
            { x: 1600, y: 1200 },
            { x: 1600, y: 1600 }
        ]
    },
    
    barracks: {
        id: 'barracks',
        name: 'City Guard Barracks',
        description: 'Military holding cells in the city guard station',
        mapPath: `modules/${MODULE_ID}/assets/maps/jails/barracks.webp`,
        gridSize: 100,
        width: 2400,
        height: 1800,
        padding: 0.1,
        backgroundColor: '#1a1510',
        spawnPoint: { x: 1200, y: 900 },
        cellLocations: [
            { x: 300, y: 300 },
            { x: 600, y: 300 },
            { x: 900, y: 300 },
            { x: 1500, y: 300 },
            { x: 1800, y: 300 },
            { x: 2100, y: 300 }
        ]
    },
    
    cavern: {
        id: 'cavern',
        name: 'Underground Cavern',
        description: 'Natural cave used as a prison by bandits or monsters',
        mapPath: `modules/${MODULE_ID}/assets/maps/jails/cavern.webp`,
        gridSize: 100,
        width: 2500,
        height: 2500,
        padding: 0.15,
        backgroundColor: '#0a0a0a',
        spawnPoint: { x: 1250, y: 1250 },
        cellLocations: [
            { x: 500, y: 500 },
            { x: 800, y: 1200 },
            { x: 1700, y: 600 },
            { x: 2000, y: 1500 },
            { x: 600, y: 2000 },
            { x: 1400, y: 1800 }
        ]
    },
    
    tower: {
        id: 'tower',
        name: 'Prison Tower',
        description: 'A tall tower with prison cells on multiple floors',
        mapPath: `modules/${MODULE_ID}/assets/maps/jails/tower.webp`,
        gridSize: 100,
        width: 1500,
        height: 1500,
        padding: 0.1,
        backgroundColor: '#1a1a2e',
        spawnPoint: { x: 750, y: 750 },
        cellLocations: [
            { x: 400, y: 400 },
            { x: 1100, y: 400 },
            { x: 400, y: 1100 },
            { x: 1100, y: 1100 }
        ]
    },
    
    city_watch: {
        id: 'city_watch',
        name: 'City Watch Station',
        description: 'Official city watch holding cells for criminals',
        mapPath: `modules/${MODULE_ID}/assets/maps/jails/city_watch.webp`,
        gridSize: 100,
        width: 2000,
        height: 1600,
        padding: 0.1,
        backgroundColor: '#1a1a1a',
        spawnPoint: { x: 1000, y: 800 },
        cellLocations: [
            { x: 200, y: 200 },
            { x: 200, y: 600 },
            { x: 200, y: 1000 },
            { x: 200, y: 1400 },
            { x: 1800, y: 200 },
            { x: 1800, y: 600 },
            { x: 1800, y: 1000 },
            { x: 1800, y: 1400 }
        ]
    },
    
    castle: {
        id: 'castle',
        name: 'Castle Dungeon',
        description: 'Deep dungeon beneath the castle keep',
        mapPath: `modules/${MODULE_ID}/assets/maps/jails/castle.webp`,
        gridSize: 100,
        width: 2800,
        height: 2000,
        padding: 0.1,
        backgroundColor: '#0d0d15',
        spawnPoint: { x: 1400, y: 1000 },
        cellLocations: [
            { x: 300, y: 300 },
            { x: 700, y: 300 },
            { x: 1100, y: 300 },
            { x: 1700, y: 300 },
            { x: 2100, y: 300 },
            { x: 2500, y: 300 },
            { x: 300, y: 1700 },
            { x: 700, y: 1700 },
            { x: 1100, y: 1700 },
            { x: 1700, y: 1700 }
        ]
    },
    
    thieves_guild: {
        id: 'thieves_guild',
        name: 'Thieves Guild Hideout',
        description: 'Secret prison maintained by the local thieves guild',
        mapPath: `modules/${MODULE_ID}/assets/maps/jails/thieves_guild.webp`,
        gridSize: 100,
        width: 2200,
        height: 2200,
        padding: 0.1,
        backgroundColor: '#15100a',
        spawnPoint: { x: 1100, y: 1100 },
        cellLocations: [
            { x: 400, y: 400 },
            { x: 1800, y: 400 },
            { x: 400, y: 1800 },
            { x: 1800, y: 1800 },
            { x: 1100, y: 600 },
            { x: 1100, y: 1600 }
        ]
    },
    
    temple: {
        id: 'temple',
        name: 'Temple Prison',
        description: 'Sacred prison maintained by religious order',
        mapPath: `modules/${MODULE_ID}/assets/maps/jails/temple.webp`,
        gridSize: 100,
        width: 1800,
        height: 1800,
        padding: 0.1,
        backgroundColor: '#1a1520',
        spawnPoint: { x: 900, y: 900 },
        cellLocations: [
            { x: 300, y: 300 },
            { x: 900, y: 300 },
            { x: 1500, y: 300 },
            { x: 300, y: 1500 },
            { x: 900, y: 1500 },
            { x: 1500, y: 1500 }
        ]
    },
    
    military: {
        id: 'military',
        name: 'Military Stockade',
        description: 'Military prison for deserters and war criminals',
        mapPath: `modules/${MODULE_ID}/assets/maps/jails/military.webp`,
        gridSize: 100,
        width: 2400,
        height: 1600,
        padding: 0.1,
        backgroundColor: '#151510',
        spawnPoint: { x: 1200, y: 800 },
        cellLocations: [
            { x: 200, y: 200 },
            { x: 600, y: 200 },
            { x: 1000, y: 200 },
            { x: 1400, y: 200 },
            { x: 1800, y: 200 },
            { x: 2200, y: 200 },
            { x: 200, y: 1400 },
            { x: 600, y: 1400 },
            { x: 1000, y: 1400 },
            { x: 1400, y: 1400 }
        ]
    },
    
    ancient: {
        id: 'ancient',
        name: 'Ancient Ruins Prison',
        description: 'Forgotten prison in ancient ruins, repurposed',
        mapPath: `modules/${MODULE_ID}/assets/maps/jails/ancient.webp`,
        gridSize: 100,
        width: 2000,
        height: 2000,
        padding: 0.15,
        backgroundColor: '#0a0a0a',
        spawnPoint: { x: 1000, y: 1000 },
        cellLocations: [
            { x: 400, y: 400 },
            { x: 1000, y: 400 },
            { x: 1600, y: 400 },
            { x: 400, y: 1600 },
            { x: 1000, y: 1600 },
            { x: 1600, y: 1600 }
        ]
    }
}

// ==========================================
// JAIL SYSTEM CLASS
// ==========================================

class JailSystem {
    constructor() {
        this._initialized = false
        this._jailSceneIds = []
        this._prisoners = new Map()
        this._createdJails = new Map() // Maps config key to scene ID
    }
    
    /**
     * Initialize the jail system
     */
    async initialize() {
        if (this._initialized) return
        
        debug('Initializing Jail System with hardcoded maps...')
        
        // Load existing jail scenes and prisoners from settings
        this._loadJailScenes()
        this._loadPrisoners()
        
        // Auto-create jail scenes from hardcoded configs
        if (game.user.isGM) {
            await this.ensureJailScenesExist()
        }
        
        this._initialized = true
        debug('Jail System initialized')
    }
    
    /**
     * Load jail scene IDs from settings
     */
    _loadJailScenes() {
        this._jailSceneIds = getSetting('jailScenes') || []
    }
    
    /**
     * Load prisoner data from settings
     */
    _loadPrisoners() {
        const stored = getSetting('prisoners') || []
        this._prisoners.clear()
        for (const p of stored) {
            this._prisoners.set(p.actorId, p)
        }
    }
    
    /**
     * Save prisoners to settings
     */
    async _savePrisoners() {
        if (!game.user.isGM) return
        await setSetting('prisoners', Array.from(this._prisoners.values()))
    }
    
    // ==========================================
    // HARDCODED JAIL SCENE CREATION
    // ==========================================
    
    /**
     * Get all available jail configurations
     * @returns {Object}
     */
    getJailConfigs() {
        return JAIL_CONFIGS
    }
    
    /**
     * Get a specific jail configuration
     * @param {string} configKey 
     * @returns {Object|null}
     */
    getJailConfig(configKey) {
        return JAIL_CONFIGS[configKey] || null
    }
    
    /**
     * Ensure all hardcoded jail scenes exist
     * Creates any missing scenes automatically
     */
    async ensureJailScenesExist() {
        if (!game.user.isGM) return
        
        debug('Checking for existing jail scenes...')
        
        // Check which scenes already exist
        const existingScenes = game.scenes.filter(s => 
            s.getFlag(MODULE_ID, 'isHardcodedJail')
        )
        
        // Map existing scenes by their config key
        for (const scene of existingScenes) {
            const configKey = scene.getFlag(MODULE_ID, 'jailConfigKey')
            if (configKey && JAIL_CONFIGS[configKey]) {
                this._createdJails.set(configKey, scene.id)
                
                // Ensure it's in the jail list
                if (!this._jailSceneIds.includes(scene.id)) {
                    this._jailSceneIds.push(scene.id)
                }
            }
        }
        
        // Save updated jail list
        await setSetting('jailScenes', this._jailSceneIds)
        
        debug(`Found ${existingScenes.length} existing hardcoded jail scenes`)
    }
    
    /**
     * Create a jail scene from hardcoded configuration
     * @param {string} configKey - The jail config key (dungeon, barracks, etc.)
     * @returns {Promise<Scene|null>}
     */
    async createJailSceneFromConfig(configKey) {
        if (!game.user.isGM) return null
        
        const config = JAIL_CONFIGS[configKey]
        if (!config) {
            ui.notifications.error(`Unknown jail type: ${configKey}`)
            return null
        }
        
        // Check if already exists
        const existingId = this._createdJails.get(configKey)
        if (existingId) {
            const existing = game.scenes.get(existingId)
            if (existing) {
                ui.notifications.info(`Jail scene "${config.name}" already exists`)
                return existing
            }
        }
        
        try {
            debug(`Creating jail scene: ${config.name}`)
            
            // Create the scene with the hardcoded map
            const sceneData = {
                name: `[JAIL] ${config.name}`,
                img: config.mapPath,
                width: config.width,
                height: config.height,
                padding: config.padding,
                backgroundColor: config.backgroundColor,
                grid: {
                    type: 1,
                    size: config.gridSize,
                    color: '#000000',
                    alpha: 0.2
                },
                initial: {
                    x: config.spawnPoint.x,
                    y: config.spawnPoint.y,
                    scale: 1
                },
                tokenVision: true,
                globalLight: true,
                globalLightThreshold: null,
                darkness: 0.3,
                flags: {
                    [MODULE_ID]: {
                        isHardcodedJail: true,
                        jailConfigKey: configKey,
                        jailSpawnPoint: config.spawnPoint,
                        cellLocations: config.cellLocations,
                        description: config.description
                    }
                }
            }
            
            const [scene] = await Scene.createDocuments([sceneData])
            
            if (scene) {
                // Track the created scene
                this._createdJails.set(configKey, scene.id)
                
                // Add to jail scenes list
                if (!this._jailSceneIds.includes(scene.id)) {
                    this._jailSceneIds.push(scene.id)
                    await setSetting('jailScenes', this._jailSceneIds)
                }
                
                ui.notifications.info(`Created jail scene: ${config.name}`)
                debug(`Created jail scene: ${scene.name} (${scene.id})`)
                
                return scene
            }
        } catch (err) {
            console.error(`RNK Patrol | Failed to create jail scene (${configKey}):`, err)
            ui.notifications.error(`Failed to create jail: ${config.name}. Check if map file exists.`)
        }
        
        return null
    }
    
    /**
     * Roll a random jail type and create/get the scene
     * This is called when a player is sent to jail - creates on demand
     * @returns {Promise<Scene|null>}
     */
    async rollRandomJail() {
        if (!game.user.isGM) return null
        
        const keys = Object.keys(JAIL_CONFIGS)
        const rolledKey = keys[Math.floor(Math.random() * keys.length)]
        const config = JAIL_CONFIGS[rolledKey]
        
        debug(`Rolled jail type: ${config.name} (${rolledKey})`)
        ui.notifications.info(`Jail rolled: ${config.name}`)
        
        // Check if this jail type already exists as a scene
        const existingId = this._createdJails.get(rolledKey)
        if (existingId) {
            const existing = game.scenes.get(existingId)
            if (existing) {
                debug(`Using existing jail scene: ${existing.name}`)
                return existing
            }
        }
        
        // Also check by looking at all scenes with our flag
        const existingScene = game.scenes.find(s => 
            s.getFlag(MODULE_ID, 'jailConfigKey') === rolledKey
        )
        if (existingScene) {
            // Track it
            this._createdJails.set(rolledKey, existingScene.id)
            if (!this._jailSceneIds.includes(existingScene.id)) {
                this._jailSceneIds.push(existingScene.id)
                await setSetting('jailScenes', this._jailSceneIds)
            }
            debug(`Found existing jail scene: ${existingScene.name}`)
            return existingScene
        }
        
        // Create the jail scene on-demand
        return await this.createJailSceneFromConfig(rolledKey)
    }
    
    /**
     * Create ALL jail scenes from hardcoded configs
     * @returns {Promise<number>} Number of scenes created
     */
    async createAllJailScenes() {
        if (!game.user.isGM) return 0
        
        let created = 0
        const keys = Object.keys(JAIL_CONFIGS)
        
        ui.notifications.info(`Creating ${keys.length} jail scenes...`)
        
        for (const key of keys) {
            const scene = await this.createJailSceneFromConfig(key)
            if (scene) created++
        }
        
        ui.notifications.info(`Created ${created} jail scenes!`)
        return created
    }
    
    /**
     * Delete ALL hardcoded jail scenes
     */
    async deleteAllJailScenes() {
        if (!game.user.isGM) return
        
        const confirm = await Dialog.confirm({
            title: 'Delete All Jail Scenes',
            content: '<p>Are you sure you want to delete ALL jail scenes? All prisoners will be released.</p>'
        })
        
        if (!confirm) return
        
        // Release all prisoners first
        await this.releaseAllPrisoners()
        
        // Find and delete all hardcoded jail scenes
        const jailScenes = game.scenes.filter(s => 
            s.getFlag(MODULE_ID, 'isHardcodedJail')
        )
        
        for (const scene of jailScenes) {
            await scene.delete()
        }
        
        // Clear tracking
        this._createdJails.clear()
        this._jailSceneIds = []
        await setSetting('jailScenes', [])
        
        ui.notifications.info(`Deleted ${jailScenes.length} jail scenes`)
    }
    
    // ==========================================
    // Jail Scene Management
    // ==========================================
    
    /**
     * Get all configured jail scenes
     * @returns {Scene[]}
     */
    getJailScenes() {
        return this._jailSceneIds
            .map(id => game.scenes.get(id))
            .filter(s => s)
    }
    
    /**
     * Get list of jail scenes with their config info
     * @returns {Object[]}
     */
    getJailScenesWithInfo() {
        return this.getJailScenes().map(scene => {
            const configKey = scene.getFlag(MODULE_ID, 'jailConfigKey')
            const config = JAIL_CONFIGS[configKey] || {}
            return {
                scene,
                sceneId: scene.id,
                sceneName: scene.name,
                configKey,
                config,
                prisonerCount: this.getPrisonersInJail(scene.id).length
            }
        })
    }
    
    /**
     * Select a random jail scene
     * @returns {Scene|null}
     */
    selectRandomJail() {
        const jails = this.getJailScenes()
        if (jails.length === 0) return null
        
        // Simulate D10 roll
        const roll = Math.floor(Math.random() * jails.length)
        return jails[roll]
    }
    
    /**
     * Check if a scene is a jail
     * @param {string} sceneId 
     * @returns {boolean}
     */
    isJailScene(sceneId) {
        return this._jailSceneIds.includes(sceneId)
    }
    
    // ==========================================
    // Prisoner Management
    // ==========================================
    
    /**
     * Send a token to jail
     * @param {Token} token - The token to jail
     * @param {Object} options
     * @param {string} options.jailSceneId - Specific jail scene ID (optional, random if not provided)
     * @param {string} options.capturedBy - Who captured the prisoner
     * @returns {Promise<Object|null>} Prisoner data or null
     */
    async sendToJail(token, options = {}) {
        if (!game.user.isGM) return null
        
        // Select jail
        const jail = options.jailSceneId 
            ? game.scenes.get(options.jailSceneId)
            : this.selectRandomJail()
        
        if (!jail) {
            ui.notifications.warn('No jail scenes available! Create jail scenes first.')
            return null
        }
        
        // Get spawn point
        const spawnPoint = this.getJailSpawnPoint(jail.id)
        const cellLocation = this.getNextAvailableCell(jail.id) || spawnPoint
        
        // Record original position
        const originalPosition = { x: token.x, y: token.y }
        const originalSceneId = canvas.scene.id
        
        // Create token data for jail scene
        const tokenData = token.document.toObject()
        tokenData.x = cellLocation.x
        tokenData.y = cellLocation.y
        
        // Delete from current scene
        await token.document.delete()
        
        // Create in jail scene
        await jail.createEmbeddedDocuments('Token', [tokenData])
        
        // Record prisoner
        const prisonerData = {
            actorId: token.actor?.id,
            actorName: token.name,
            jailSceneId: jail.id,
            jailName: jail.name,
            jailConfigKey: jail.getFlag(MODULE_ID, 'jailConfigKey'),
            originalSceneId,
            originalPosition,
            cellLocation,
            capturedAt: Date.now(),
            capturedBy: options.capturedBy || 'Unknown',
            released: false
        }
        
        this._prisoners.set(token.actor?.id, prisonerData)
        await this._savePrisoners()
        
        Hooks.callAll('rnkPatrol.prisonerAdded', prisonerData)
        
        ui.notifications.info(`${token.name} has been sent to ${jail.name}!`)
        
        // Pull player to jail scene if it's their character
        const ownerUser = game.users.find(u => 
            token.actor?.testUserPermission(u, "OWNER") && !u.isGM
        )
        if (ownerUser) {
            game.socket?.emit(`module.${MODULE_ID}`, {
                type: 'pullToScene',
                userId: ownerUser.id,
                sceneId: jail.id
            })
        }
        
        return prisonerData
    }
    
    /**
     * Get next available cell in a jail
     * @param {string} jailSceneId 
     * @returns {Object|null}
     */
    getNextAvailableCell(jailSceneId) {
        const scene = game.scenes.get(jailSceneId)
        if (!scene) return null
        
        const cellLocations = scene.getFlag(MODULE_ID, 'cellLocations') || []
        const prisoners = this.getPrisonersInJail(jailSceneId)
        
        // Find first unoccupied cell
        for (const cell of cellLocations) {
            const occupied = prisoners.some(p => 
                p.cellLocation && 
                p.cellLocation.x === cell.x && 
                p.cellLocation.y === cell.y
            )
            if (!occupied) return cell
        }
        
        // All cells occupied, use spawn point
        return this.getJailSpawnPoint(jailSceneId)
    }
    
    /**
     * Get spawn point for a jail scene
     * @param {string} sceneId 
     * @returns {Object}
     */
    getJailSpawnPoint(sceneId) {
        const scene = game.scenes.get(sceneId)
        if (!scene) return { x: 500, y: 500 }
        
        return scene.getFlag(MODULE_ID, 'jailSpawnPoint') || {
            x: scene.dimensions?.width / 2 || 500,
            y: scene.dimensions?.height / 2 || 500
        }
    }
    
    /**
     * Record a prisoner (legacy method for compatibility)
     * @param {Object} data 
     */
    async addPrisoner(data) {
        const prisonerData = {
            actorId: data.actorId,
            actorName: data.actorName,
            jailSceneId: data.jailSceneId,
            jailName: data.jailName,
            jailConfigKey: data.jailConfigKey,
            originalSceneId: data.originalSceneId,
            originalPosition: data.originalPosition,
            cellLocation: data.cellLocation,
            capturedAt: Date.now(),
            capturedBy: data.capturedBy,
            released: false
        }
        
        this._prisoners.set(data.actorId, prisonerData)
        await this._savePrisoners()
        
        Hooks.callAll('rnkPatrol.prisonerAdded', prisonerData)
    }
    
    /**
     * Release a prisoner
     * @param {string} actorId 
     * @param {Object} options 
     */
    async releasePrisoner(actorId, options = {}) {
        if (!game.user.isGM) return
        
        const prisoner = this._prisoners.get(actorId)
        if (!prisoner) return
        
        prisoner.released = true
        prisoner.releasedAt = Date.now()
        
        // Optionally teleport back to original location
        if (options.returnToOriginal && prisoner.originalSceneId && prisoner.originalPosition) {
            await this._returnPrisoner(prisoner)
        }
        
        if (options.clearRecord) {
            this._prisoners.delete(actorId)
        }
        
        await this._savePrisoners()
        
        Hooks.callAll('rnkPatrol.prisonerReleased', prisoner)
        
        ui.notifications.info(`${prisoner.actorName} has been released!`)
    }
    
    /**
     * Return prisoner to original location
     */
    async _returnPrisoner(prisoner) {
        const actor = game.actors.get(prisoner.actorId)
        if (!actor) return
        
        const originalScene = game.scenes.get(prisoner.originalSceneId)
        if (!originalScene) return
        
        // Find token in current jail scene
        const jailScene = game.scenes.get(prisoner.jailSceneId)
        if (!jailScene) return
        
        const jailToken = jailScene.tokens.find(t => t.actorId === prisoner.actorId)
        if (!jailToken) return
        
        // Create token in original scene
        const tokenData = jailToken.toObject()
        tokenData.x = prisoner.originalPosition.x
        tokenData.y = prisoner.originalPosition.y
        
        await jailToken.delete()
        await originalScene.createEmbeddedDocuments('Token', [tokenData])
        
        // Pull player back to original scene
        const ownerUser = game.users.find(u => 
            actor.testUserPermission(u, "OWNER") && !u.isGM
        )
        if (ownerUser) {
            game.socket?.emit(`module.${MODULE_ID}`, {
                type: 'pullToScene',
                userId: ownerUser.id,
                sceneId: originalScene.id
            })
        }
    }
    
    /**
     * Get all current prisoners
     * @returns {Object[]}
     */
    getPrisoners() {
        return Array.from(this._prisoners.values()).filter(p => !p.released)
    }
    
    /**
     * Get prisoners in a specific jail
     * @param {string} jailSceneId 
     * @returns {Object[]}
     */
    getPrisonersInJail(jailSceneId) {
        return this.getPrisoners().filter(p => p.jailSceneId === jailSceneId)
    }
    
    /**
     * Check if an actor is a prisoner
     * @param {string} actorId 
     * @returns {boolean}
     */
    isPrisoner(actorId) {
        const prisoner = this._prisoners.get(actorId)
        return prisoner && !prisoner.released
    }
    
    /**
     * Get prisoner info
     * @param {string} actorId 
     * @returns {Object|null}
     */
    getPrisonerInfo(actorId) {
        return this._prisoners.get(actorId) || null
    }
    
    /**
     * Release all prisoners
     */
    async releaseAllPrisoners() {
        if (!game.user.isGM) return
        
        const prisoners = this.getPrisoners()
        for (const prisoner of prisoners) {
            await this.releasePrisoner(prisoner.actorId, { 
                returnToOriginal: true, 
                clearRecord: true 
            })
        }
        
        debug('Released all prisoners')
    }
    
    // ==========================================
    // GM Dialog
    // ==========================================
    
    /**
     * Open jail management dialog
     */
    async openJailManager() {
        if (!game.user.isGM) return
        
        const jails = this.getJailScenesWithInfo()
        const prisoners = this.getPrisoners()
        const availableConfigs = Object.entries(JAIL_CONFIGS)
            .filter(([key]) => !this._createdJails.has(key))
        
        const content = `
            <div class="rnk-patrol-jail-manager">
                <h3><i class="fas fa-dungeon"></i> Jail System Manager</h3>
                
                <div class="jail-actions">
                    <button type="button" id="create-all-jails" class="action-btn">
                        <i class="fas fa-plus-square"></i> Create All Jails
                    </button>
                    <button type="button" id="delete-all-jails" class="action-btn danger">
                        <i class="fas fa-trash"></i> Delete All Jails
                    </button>
                </div>
                
                <hr>
                
                <h4>Created Jail Scenes (${jails.length}/10)</h4>
                <div class="jail-list">
                    ${jails.map(j => `
                        <div class="jail-item" data-scene-id="${j.sceneId}">
                            <span class="jail-name">${j.sceneName}</span>
                            <span class="prisoner-count">(${j.prisonerCount} prisoners)</span>
                            <button type="button" class="view-jail" data-scene-id="${j.sceneId}" title="View Scene">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    `).join('')}
                    ${jails.length === 0 ? '<p class="no-jails">No jail scenes created yet</p>' : ''}
                </div>
                
                ${availableConfigs.length > 0 ? `
                <div class="create-single-jail">
                    <label>Create Single Jail:</label>
                    <select id="jail-config-select">
                        <option value="">-- Select Type --</option>
                        ${availableConfigs.map(([key, cfg]) => 
                            `<option value="${key}">${cfg.name}</option>`
                        ).join('')}
                    </select>
                    <button type="button" id="create-single-jail">
                        <i class="fas fa-plus"></i> Create
                    </button>
                </div>
                ` : ''}
                
                <hr>
                
                <h4>Current Prisoners (${prisoners.length})</h4>
                <div class="prisoner-list">
                    ${prisoners.map(p => `
                        <div class="prisoner-item" data-actor-id="${p.actorId}">
                            <span class="prisoner-name">${p.actorName}</span>
                            <span class="prisoner-jail">@ ${p.jailName}</span>
                            <span class="prisoner-time">(${this._formatDuration(Date.now() - p.capturedAt)})</span>
                            <button type="button" class="release-prisoner" data-actor-id="${p.actorId}">
                                <i class="fas fa-door-open"></i> Release
                            </button>
                        </div>
                    `).join('')}
                    ${prisoners.length === 0 ? '<p class="no-prisoners">No current prisoners</p>' : ''}
                </div>
                
                ${prisoners.length > 0 ? `
                <button type="button" id="release-all-prisoners" class="action-btn">
                    <i class="fas fa-unlock"></i> Release All Prisoners
                </button>
                ` : ''}
            </div>
        `
        
        const dialog = new Dialog({
            title: 'Jail System Manager',
            content,
            buttons: {
                close: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Close'
                }
            },
            render: (html) => {
                // Create all jails
                html.find('#create-all-jails').click(async () => {
                    await this.createAllJailScenes()
                    dialog.close()
                    this.openJailManager()
                })
                
                // Delete all jails
                html.find('#delete-all-jails').click(async () => {
                    await this.deleteAllJailScenes()
                    dialog.close()
                    this.openJailManager()
                })
                
                // Create single jail
                html.find('#create-single-jail').click(async () => {
                    const key = html.find('#jail-config-select').val()
                    if (key) {
                        await this.createJailSceneFromConfig(key)
                        dialog.close()
                        this.openJailManager()
                    }
                })
                
                // View jail scene
                html.find('.view-jail').click((e) => {
                    const sceneId = e.currentTarget.dataset.sceneId
                    const scene = game.scenes.get(sceneId)
                    if (scene) scene.view()
                })
                
                // Release prisoner
                html.find('.release-prisoner').click(async (e) => {
                    const actorId = e.currentTarget.dataset.actorId
                    
                    const returnHome = await Dialog.confirm({
                        title: 'Release Prisoner',
                        content: 'Return prisoner to their original location?'
                    })
                    
                    await this.releasePrisoner(actorId, { 
                        returnToOriginal: returnHome, 
                        clearRecord: true 
                    })
                    dialog.close()
                    this.openJailManager()
                })
                
                // Release all prisoners
                html.find('#release-all-prisoners').click(async () => {
                    const confirm = await Dialog.confirm({
                        title: 'Release All',
                        content: 'Release all prisoners and return them to original locations?'
                    })
                    
                    if (confirm) {
                        await this.releaseAllPrisoners()
                        dialog.close()
                        this.openJailManager()
                    }
                })
            },
            default: 'close'
        }, {
            width: 550,
            classes: ['rnk-patrol', 'jail-manager-dialog']
        })
        
        dialog.render(true)
    }
    
    /**
     * Format duration for display
     */
    _formatDuration(ms) {
        const seconds = Math.floor(ms / 1000)
        const minutes = Math.floor(seconds / 60)
        const hours = Math.floor(minutes / 60)
        
        if (hours > 0) return `${hours}h ${minutes % 60}m`
        if (minutes > 0) return `${minutes}m`
        return `${seconds}s`
    }
    
    /**
     * Update settings (called when GM changes settings in hub)
     */
    updateSettings() {
        this._loadJailScenes()
        this._loadPrisoners()
    }
}

// Export singleton and configs
export const jailSystem = new JailSystem()
export { JAIL_CONFIGS }
