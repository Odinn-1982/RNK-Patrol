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

import { MODULE_ID, debug, WAYPOINT_STATES } from './main.js'
import { getSetting, setSetting } from './settings.js'

// ==========================================
// HARDCODED JAIL CONFIGURATIONS
// ==========================================

// Map jail config keys to the actual JSON scene export files
// These are pre-made FVTT scene exports that can be imported
const JAIL_CONFIGS = {
    jail_1: {
        id: 'jail_1',
        name: 'Jail 1',
        description: 'Castle dungeon prison with multiple cells',
        jsonFile: `modules/${MODULE_ID}/assets/maps/jails/fvtt-Scene-jail-1-ZOxMiU2ZA47Vk4eK.json`,
        imageFile: `modules/${MODULE_ID}/assets/maps/jails/Jail 1.jpg`,
        // Captured PC spawn point (from "captured" placeholder token)
        capturedSpawnPoint: { x: 146, y: 224 },
        // Group/rescue party spawn point (from "Group Spawn" tile)
        groupSpawnPoint: { x: 755, y: 24 },
        // Guard patrol placeholder positions (Patrol 1-4)
        guardSpawns: [
            { x: 198, y: 661, name: 'Patrol 1' },
            { x: 98, y: 752, name: 'Patrol 2' },
            { x: 752, y: 855, name: 'Patrol 3' },
            { x: 477, y: 489, name: 'Patrol 4' }
        ],
        // Inmate placeholder positions (In-mate 1-3)
        inmateSpawns: [
            { x: 65, y: 361, name: 'In-mate 1' },
            { x: 273, y: 629, name: 'In-mate 2' },
            { x: 600, y: 907, name: 'In-mate 3' }
        ],
        // Patrol routes for guards - each route is an array of waypoints
        patrolRoutes: [
            { 
                name: 'Route 1 - Main Hall', 
                guardIndex: 0, // Which guard uses this route
                waypoints: [
                    { x: 198, y: 661 },
                    { x: 300, y: 661 },
                    { x: 300, y: 500 },
                    { x: 198, y: 500 }
                ]
            },
            { 
                name: 'Route 2 - Cell Block A', 
                guardIndex: 1,
                waypoints: [
                    { x: 98, y: 752 },
                    { x: 98, y: 400 },
                    { x: 200, y: 400 },
                    { x: 200, y: 752 }
                ]
            },
            { 
                name: 'Route 3 - Cell Block B', 
                guardIndex: 2,
                waypoints: [
                    { x: 752, y: 855 },
                    { x: 600, y: 855 },
                    { x: 600, y: 700 },
                    { x: 752, y: 700 }
                ]
            },
            { 
                name: 'Route 4 - Central', 
                guardIndex: 3,
                waypoints: [
                    { x: 477, y: 489 },
                    { x: 550, y: 489 },
                    { x: 550, y: 600 },
                    { x: 477, y: 600 }
                ]
            }
        ],
        // Placeholder token names to remove when populating
        placeholderNames: ['captured', 'Patrol 1', 'Patrol 2', 'Patrol 3', 'Patrol 4', 'In-mate 1', 'In-mate 2', 'In-mate 3']
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
        this._guardTemplates = new Map()
        this._registerDefaultGuardTemplates()
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
        const stored = getSetting('jailScenes')
        // Ensure we always have an array (in case old Object type setting exists)
        this._jailSceneIds = Array.isArray(stored) ? stored : []
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

    _registerDefaultGuardTemplates() {
        this.registerGuardTemplate('default-guard', {
            name: 'Default Guard',
            baseLevel: 1,
            baseHp: 30,
            hpPerLevel: 6,
            baseAc: 12,
            acPerLevel: 0.5,
            baseDamage: 6,
            damagePerLevel: 1
        })
        this.registerGuardTemplate('elite-guard', {
            name: 'Elite Guard',
            baseLevel: 3,
            baseHp: 45,
            hpPerLevel: 8,
            baseAc: 14,
            acPerLevel: 0.5,
            baseDamage: 8,
            damagePerLevel: 1.5
        })
    }

    registerGuardTemplate(key, template) {
        this._guardTemplates.set(key, template)
    }

    getGuardTemplate(key) {
        return this._guardTemplates.get(key)
    }

    getGuardTemplateKeys() {
        return Array.from(this._guardTemplates.keys())
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
            const config = configKey ? JAIL_CONFIGS[configKey] : null
            if (config) {
                this._createdJails.set(configKey, scene.id)

                // Backfill default waypoints if missing
                const storedWaypoints = scene.getFlag(MODULE_ID, 'waypoints') || []
                if (storedWaypoints.length === 0) {
                    const defaults = this._buildDefaultJailWaypoints(scene, configKey, config)
                    if (defaults.length > 0) {
                        await scene.setFlag(MODULE_ID, 'waypoints', defaults)
                    }
                }

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
     * Force recreate a jail scene - deletes existing and creates fresh from JSON
     * @param {string} configKey - The jail config key (jail_1, etc.)
     * @returns {Promise<Scene|null>}
     */
    async forceRecreateJail(configKey) {
        if (!game.user.isGM) return null
        
        const config = JAIL_CONFIGS[configKey]
        if (!config) {
            ui.notifications.error(`Unknown jail type: ${configKey}`)
            return null
        }
        
        // Find and delete any existing jail scene with this config
        const existingScene = game.scenes.find(s => 
            s.getFlag(MODULE_ID, 'jailConfigKey') === configKey
        )
        
        if (existingScene) {
            ui.notifications.info(`Deleting existing jail scene: ${existingScene.name}`)
            await existingScene.delete()
        }
        
        // Clear from tracking
        this._createdJails.delete(configKey)
        this._jailSceneIds = this._jailSceneIds.filter(id => id !== existingScene?.id)
        await setSetting('jailScenes', this._jailSceneIds)
        
        // Now create fresh
        return await this.createJailSceneFromConfig(configKey)
    }

    /**
     * Create a jail scene from hardcoded configuration
     * Imports from the bundled JSON scene export files
     * @param {string} configKey - The jail config key (prison, cellblock, etc.)
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
            debug(`Creating jail scene from JSON: ${config.name}`)

            // Fetch the JSON scene data
            const response = await fetch(config.jsonFile)
            if (!response.ok) {
                throw new Error(`Failed to fetch scene JSON: ${response.status}`)
            }

            const sceneData = await response.json()

            // Modify the scene data for our purposes
            sceneData.name = `[JAIL] ${config.name}`
            sceneData.navigation = false

            // Remove the _id so Foundry creates a new one
            delete sceneData._id

            // Set our module flags
            sceneData.flags = sceneData.flags || {}
            sceneData.flags[MODULE_ID] = {
                isHardcodedJail: true,
                jailConfigKey: configKey,
                jailSpawnPoint: config.spawnPoint,
                cellLocations: config.cellLocations,
                description: config.description
            }

            // Keep tokens from the exported scene (patrols, inmates, placeholders)
            // Process tokens to ensure they work in this world
            if (sceneData.tokens && sceneData.tokens.length > 0) {
                sceneData.tokens = sceneData.tokens.map(token => {
                    // Remove actor link if the actor doesn't exist in this world
                    // This prevents errors when the original actors aren't present
                    if (token.actorId && !game.actors.get(token.actorId)) {
                        token.actorId = null
                        token.actorLink = false
                    }
                    // Remove the token _id so Foundry creates new ones
                    delete token._id
                    return token
                })
                debug(`Keeping ${sceneData.tokens.length} tokens from jail scene export`)
            }
            
            // Clear notes, sounds, templates but keep tokens
            sceneData.notes = []
            sceneData.sounds = []
            sceneData.templates = []

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

                const defaultWaypoints = this._buildDefaultJailWaypoints(scene, configKey, config)
                if (defaultWaypoints.length > 0) {
                    await scene.setFlag(MODULE_ID, 'waypoints', defaultWaypoints)
                }

                return scene
            }
        } catch (err) {
            console.error(`RNK Patrol | Failed to create jail scene (${configKey}):`, err)
            ui.notifications.error(`Failed to create jail: ${config.name}. Error: ${err.message}`)
        }

        return null
    }

    _buildDefaultJailWaypoints(scene, configKey, config) {
        if (!scene || !config) return []

        const detectionRange = getSetting('defaultDetectionRange', 5)
        const appearDuration = getSetting('defaultAppearDuration', 3)
        const guardSpawns = config.guardSpawns || []
        const inmateSpawns = config.inmateSpawns || []
        const patrolRoutes = config.patrolRoutes || []
        const waypoints = []

        const createWaypoint = (payload) => {
            if (typeof payload.x !== 'number' || typeof payload.y !== 'number') return

            const id = payload.id || foundry.utils.randomID()
            const entry = {
                id,
                sceneId: scene.id,
                x: payload.x,
                y: payload.y,
                name: payload.name || `Waypoint ${id.slice(0, 4)}`,
                state: WAYPOINT_STATES.ACTIVE,
                detectionRange,
                appearDuration,
                weight: 1,
                priority: payload.priority ?? 0,
                tags: payload.tags || [],
                notes: payload.notes || ''
            }

            if (payload.metadata) {
                entry.metadata = payload.metadata
            }

            waypoints.push(entry)
        }

        guardSpawns.forEach((spawn, index) => {
            createWaypoint({
                x: spawn.x,
                y: spawn.y,
                name: spawn.name || `Guard Spawn ${index + 1}`,
                tags: ['guard-spawn'],
                metadata: {
                    type: 'guard-spawn',
                    spawnIndex: index
                }
            })
        })

        inmateSpawns.forEach((spawn, index) => {
            createWaypoint({
                x: spawn.x,
                y: spawn.y,
                name: spawn.name || `Inmate Spawn ${index + 1}`,
                tags: ['inmate-spawn'],
                metadata: {
                    type: 'inmate-spawn',
                    spawnIndex: index
                }
            })
        })

        patrolRoutes.forEach((route, routeIndex) => {
            const routeName = route.name || `Route ${routeIndex + 1}`
            (route.waypoints || []).forEach((point, waypointIndex) => {
                createWaypoint({
                    x: point.x,
                    y: point.y,
                    name: point.name || `${routeName} ${waypointIndex + 1}`,
                    tags: ['patrol-route'],
                    priority: waypointIndex,
                    metadata: {
                        routeId: `${configKey}-${routeIndex}`,
                        routeIndex,
                        routeName,
                        waypointIndex,
                        guardIndex: route.guardIndex ?? routeIndex
                    }
                })
            })
        })

        return waypoints
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
        return this.getJailScenes().filter(scene => scene?.id).map(scene => {
            const configKey = scene.getFlag(MODULE_ID, 'jailConfigKey')
            const config = JAIL_CONFIGS[configKey] || {}
            return {
                scene,
                sceneId: scene.id || '',
                sceneName: scene.name || 'Unknown',
                configKey: configKey || '',
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
     * @param {Object} options.scaleInfo - Scaling info (playerLevel, partyLevel, etc.)
     * @param {string} options.guardTemplateKey - Which guard template to use
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

        // Get jail config
        const configKey = jail.getFlag(MODULE_ID, 'jailConfigKey')
        const config = JAIL_CONFIGS[configKey]

        // Get captured spawn point from config or fallback
        const capturedSpawn = config?.capturedSpawnPoint || this.getJailSpawnPoint(jail.id)

        // Record original position
        const originalPosition = { x: token.x, y: token.y }
        const originalSceneId = canvas.scene.id

        // Create token data for jail scene at captured spawn point
        const tokenData = token.document.toObject()
        tokenData.x = capturedSpawn.x
        tokenData.y = capturedSpawn.y

        // Delete from current scene
        await token.document.delete()

        // Prepare the jail scene - remove placeholders and spawn guards
        if (config) {
            await this._prepareJailScene(jail, config, options)
        }

        // Create prisoner token in jail scene
        await jail.createEmbeddedDocuments('Token', [tokenData])

        // Record prisoner
        const prisonerData = {
            actorId: token.actor?.id,
            actorName: token.name,
            jailSceneId: jail.id,
            jailName: jail.name,
            jailConfigKey: configKey,
            originalSceneId,
            originalPosition,
            cellLocation: capturedSpawn,
            groupSpawnPoint: config?.groupSpawnPoint || null,
            capturedAt: Date.now(),
            capturedBy: options.capturedBy || 'Unknown',
            scaleInfo: options.scaleInfo || null,
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

        // GM also navigates to jail scene to activate patrols there
        // Small delay to ensure player token is created first
        setTimeout(async () => {
            if (canvas.scene?.id !== jail.id) {
                await jail.view()
            }
        }, 500)

        return prisonerData
    }

    /**
     * Prepare jail scene by removing placeholders and spawning scaled guards
     * Only runs once per jail scene - checks if already prepared via flag
     * @param {Scene} jail - The jail scene
     * @param {Object} config - Jail configuration
     * @param {Object} options - Options including scaleInfo
     */
    async _prepareJailScene(jail, config, options = {}) {
        // Check if this jail has already been prepared (guards spawned)
        const isPrepared = jail.getFlag(MODULE_ID, 'jailPrepared')
        if (isPrepared) {
            debug(`Jail scene ${jail.name} already prepared, skipping guard spawn`)
            return
        }

        debug(`Preparing jail scene: ${jail.name}`)

        // Get placeholder names to remove
        const placeholderNames = config.placeholderNames || []

        // Find and remove placeholder tokens
        const tokensToDelete = jail.tokens.filter(t =>
            placeholderNames.includes(t.name)
        )

        if (tokensToDelete.length > 0) {
            debug(`Removing ${tokensToDelete.length} placeholder tokens`)
            const tokenIds = tokensToDelete.map(t => t.id)
            await jail.deleteEmbeddedDocuments('Token', tokenIds)
        }

        // Spawn scaled guards at guard positions
        if (config.guardSpawns?.length > 0) {
            await this._spawnScaledGuards(jail, config.guardSpawns, options)
        }

        // Mark jail as prepared so we don't spawn duplicate guards
        await jail.setFlag(MODULE_ID, 'jailPrepared', true)

        // Optionally spawn inmates at inmate positions
        // (For now we skip this - inmates can be pre-placed or spawned separately)

        debug('Jail scene prepared')
    }

    /**
     * Spawn scaled guard tokens at specified positions
     * @param {Scene} jail - The jail scene
     * @param {Array} guardSpawns - Array of {x, y, name} positions
     * @param {Object} options - Options including scaleInfo and guardTemplateKey
     */
    async _spawnScaledGuards(jail, guardSpawns, options = {}) {
        const scaleInfo = options.scaleInfo || {}
        const templateKey = options.guardTemplateKey || 'default-guard'
        const template = this.getGuardTemplate(templateKey) || this.getGuardTemplate('default-guard')

        if (!template) {
            debug('No guard template found, skipping guard spawning')
            return
        }

        // Calculate scaled stats based on player/party level
        const targetLevel = scaleInfo.partyLevel || scaleInfo.playerLevel || 1
        const scaledStats = this._calculateScaledStats(template, targetLevel)

        debug(`Spawning ${guardSpawns.length} guards at level ~${targetLevel}`)

        // Create guard tokens
        const guardTokens = []
        for (const spawn of guardSpawns) {
            const guardToken = {
                name: spawn.name || 'Guard',
                x: spawn.x,
                y: spawn.y,
                texture: {
                    src: 'icons/svg/mystery-man.svg',
                    tint: '#cc0000'
                },
                width: 1,
                height: 1,
                disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
                actorLink: false,
                // Store scaled stats in flags for reference
                flags: {
                    [MODULE_ID]: {
                        isJailGuard: true,
                        scaledStats,
                        templateKey,
                        targetLevel
                    }
                }
            }
            guardTokens.push(guardToken)
        }

        if (guardTokens.length > 0) {
            await jail.createEmbeddedDocuments('Token', guardTokens)
            debug(`Created ${guardTokens.length} guard tokens`)
        }
    }

    /**
     * Calculate scaled stats for a guard based on target level
     * @param {Object} template - Guard template
     * @param {number} targetLevel - Target level to scale to
     * @returns {Object} Scaled stats
     */
    _calculateScaledStats(template, targetLevel) {
        const levelDiff = Math.max(0, targetLevel - template.baseLevel)

        return {
            hp: Math.round(template.baseHp + (template.hpPerLevel * levelDiff)),
            ac: Math.round(template.baseAc + (template.acPerLevel * levelDiff)),
            damage: Math.round(template.baseDamage + (template.damagePerLevel * levelDiff)),
            level: targetLevel
        }
    }

    /**
     * Reset a jail scene - removes all guards and marks it as unprepared
     * so guards will be re-spawned on next capture
     * @param {string} jailSceneId - The jail scene ID
     * @param {Object} options - Options for re-preparing (scaleInfo, etc.)
     */
    async resetJailScene(jailSceneId, options = {}) {
        if (!game.user.isGM) return

        const jail = game.scenes.get(jailSceneId)
        if (!jail) return

        const configKey = jail.getFlag(MODULE_ID, 'jailConfigKey')
        if (!configKey) {
            ui.notifications.warn('Not a configured jail scene')
            return
        }

        debug(`Resetting jail scene: ${jail.name}`)

        // Remove all guard tokens (tokens with isJailGuard flag)
        const guardTokens = jail.tokens.filter(t =>
            t.getFlag(MODULE_ID, 'isJailGuard')
        )

        if (guardTokens.length > 0) {
            const guardIds = guardTokens.map(t => t.id)
            await jail.deleteEmbeddedDocuments('Token', guardIds)
            debug(`Removed ${guardTokens.length} guard tokens`)
        }

        // Clear the prepared flag so guards will spawn on next capture
        await jail.unsetFlag(MODULE_ID, 'jailPrepared')

        ui.notifications.info(`Jail scene "${jail.name}" has been reset. Guards will respawn on next capture.`)

        // Optionally re-prepare immediately with new scaling
        if (options.reprepare) {
            const config = JAIL_CONFIGS[configKey]
            if (config) {
                await this._prepareJailScene(jail, config, options)
            }
        }
    }

    /**
     * Get the group spawn point for a jail (for rescue party)
     * @param {string} jailSceneId
     * @returns {Object|null}
     */
    getGroupSpawnPoint(jailSceneId) {
        const scene = game.scenes.get(jailSceneId)
        if (!scene) return null

        const configKey = scene.getFlag(MODULE_ID, 'jailConfigKey')
        const config = JAIL_CONFIGS[configKey]

        return config?.groupSpawnPoint || null
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
    // GUARD/INMATE ACTOR MANAGEMENT
    // ==========================================

    /**
     * In-memory cache for scene guard actor assignments
     * Maps sceneId -> actorId
     */
    _sceneGuardActor = new Map()
    _sceneInmateActors = new Map() // sceneId -> array of actor info objects

    /**
     * Get a random NPC actor from the world
     * @param {string} sceneId - Optional scene ID for context
     * @returns {Actor|null}
     */
    getRandomNpcActor(sceneId) {
        const npcs = game.actors.filter(a => !a.hasPlayerOwner)
        if (!npcs.length) return null
        return npcs[Math.floor(Math.random() * npcs.length)]
    }

    /**
     * Set the guard actor for a scene (from world actors or compendium)
     * @param {string} sceneId - The jail scene ID
     * @param {string} actorId - The actor ID (world actor)
     * @param {Object} compendiumInfo - Optional: { pack, uuid, name, img } for compendium actors
     */
    setSceneGuardActor(sceneId, actorId, compendiumInfo = null) {
        const data = compendiumInfo ? { ...compendiumInfo, actorId } : { actorId }
        this._sceneGuardActor.set(sceneId, data)
        debug(`Set guard actor for scene ${sceneId}:`, data)
    }

    /**
     * Clear the guard actor for a scene
     * @param {string} sceneId
     */
    clearSceneGuardActor(sceneId) {
        this._sceneGuardActor.delete(sceneId)
        debug(`Cleared guard actor for scene ${sceneId}`)
    }

    /**
     * Get the guard actor info for a scene
     * @param {string} sceneId
     * @returns {Object|null} - { actorId, pack?, uuid?, name?, img? }
     */
    getSceneGuardActor(sceneId) {
        return this._sceneGuardActor.get(sceneId) || null
    }

    /**
     * Set inmate actor for a specific slot in a scene
     * @param {string} sceneId - The jail scene ID
     * @param {number} slotIndex - Which inmate slot (0-based)
     * @param {Object} actorInfo - { actorId, pack?, uuid?, name?, img? }
     */
    setSceneInmateActor(sceneId, slotIndex, actorInfo) {
        if (!this._sceneInmateActors.has(sceneId)) {
            this._sceneInmateActors.set(sceneId, [])
        }
        const inmates = this._sceneInmateActors.get(sceneId)
        inmates[slotIndex] = actorInfo
        debug(`Set inmate ${slotIndex} for scene ${sceneId}:`, actorInfo)
    }

    /**
     * Get inmate actors for a scene
     * @param {string} sceneId
     * @returns {Array} - Array of actor info objects
     */
    getSceneInmateActors(sceneId) {
        return this._sceneInmateActors.get(sceneId) || []
    }

    /**
     * Clear all inmate actors for a scene
     * @param {string} sceneId
     */
    clearSceneInmateActors(sceneId) {
        this._sceneInmateActors.delete(sceneId)
        debug(`Cleared all inmate actors for scene ${sceneId}`)
    }

    /**
     * Import an actor from a compendium to the world
     * @param {string} uuid - Compendium actor UUID
     * @returns {Promise<Actor|null>}
     */
    async importActorFromCompendium(uuid) {
        try {
            const doc = await fromUuid(uuid)
            if (!doc) {
                ui.notifications.warn('Could not find actor in compendium')
                return null
            }
            
            // Check if actor already exists in world with same name
            const existing = game.actors.find(a => a.name === doc.name)
            if (existing) {
                debug(`Actor "${doc.name}" already exists in world, using existing`)
                return existing
            }

            // Import to world
            const worldData = game.actors.fromCompendium(doc)
            const [actor] = await Actor.createDocuments([worldData])
            ui.notifications.info(`Imported "${actor.name}" from compendium`)
            return actor
        } catch (err) {
            console.error('RNK Patrol | Failed to import actor from compendium:', err)
            ui.notifications.error('Failed to import actor from compendium')
            return null
        }
    }

    /**
     * Search actor compendiums for matches
     * @param {string} query - Search query
     * @param {string} packId - Specific pack to search, or 'all' for all packs
     * @returns {Promise<Array>}
     */
    async searchCompendiumActors(query = '', packId = 'all') {
        const results = []
        const searchLower = query.toLowerCase()
        
        const packs = packId === 'all' 
            ? game.packs.filter(p => p.documentName === 'Actor')
            : [game.packs.get(packId)].filter(Boolean)

        for (const pack of packs) {
            try {
                const index = await pack.getIndex({ fields: ['name', 'img', 'type'] })
                for (const entry of index) {
                    if (!query || entry.name.toLowerCase().includes(searchLower)) {
                        results.push({
                            id: entry._id,
                            name: entry.name,
                            img: entry.img || 'icons/svg/mystery-man.svg',
                            pack: pack.collection,
                            packLabel: pack.metadata.label,
                            uuid: `Compendium.${pack.collection}.Actor.${entry._id}`,
                            type: entry.type || 'unknown'
                        })
                    }
                }
            } catch (err) {
                console.warn(`RNK Patrol | Could not search pack ${pack.collection}:`, err)
            }
        }

        return results.slice(0, 100) // Limit results
    }

    /**
     * Save jail config customizations to settings
     * @param {string} configKey - The jail config key
     * @param {Object} customizations - Custom settings to merge
     */
    async saveJailCustomizations(configKey, customizations) {
        if (!game.user.isGM) return
        
        const allCustomizations = getSetting('jailCustomizations') || {}
        allCustomizations[configKey] = {
            ...allCustomizations[configKey],
            ...customizations
        }
        await setSetting('jailCustomizations', allCustomizations)
        debug(`Saved customizations for ${configKey}:`, customizations)
    }

    /**
     * Get jail config customizations
     * @param {string} configKey
     * @returns {Object}
     */
    getJailCustomizations(configKey) {
        const allCustomizations = getSetting('jailCustomizations') || {}
        return allCustomizations[configKey] || {}
    }

    /**
     * Get merged jail config (base + customizations)
     * @param {string} configKey
     * @returns {Object}
     */
    getMergedJailConfig(configKey) {
        const baseConfig = JAIL_CONFIGS[configKey]
        if (!baseConfig) return null
        
        const customizations = this.getJailCustomizations(configKey)
        return foundry.utils.mergeObject(
            foundry.utils.deepClone(baseConfig),
            customizations,
            { inplace: false }
        )
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
