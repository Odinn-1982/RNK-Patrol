/**
 * RNK Patrol - GM Hub
 * Central command center for all patrol operations
 */

import { MODULE_ID, MODULE_NAME, PATROL_MODES, PATROL_STATES, BLINK_PATTERNS, ALERT_STATES } from '../main.js';
import { getSetting, setSetting } from '../settings.js';

export class GMHubApp extends Application {
    
    constructor(options = {}) {
        super(options);
        
        this.activeTab = 'overview';
        this.selectedPatrolId = null;
        this.refreshInterval = null;
        this.isMinimized = false;
        
        // Bind methods
        this._onPatrolUpdate = this._onPatrolUpdate.bind(this);
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'rnk-patrol-gm-hub',
            title: `${MODULE_NAME} - GM Command Hub`,
            template: `modules/${MODULE_ID}/templates/gm-hub.hbs`,
            classes: ['rnk-patrol', 'gm-hub'],
            width: 900,
            height: 700,
            minimizable: true,
            resizable: true,
            tabs: [{
                navSelector: '.hub-tabs',
                contentSelector: '.hub-content',
                initial: 'patrols'
            }]
        });
    }

    /** @override */
    async getData(options = {}) {
        const manager = game.rnkPatrol?.manager;
        const patrols = manager?.getPatrols() ?? [];
        
        // Calculate statistics
        const stats = this._calculateStats(patrols);
        
        // Get scene tokens for quick patrol creation
        const sceneTokens = canvas.tokens?.placeables
            .filter(t => !t.document.hidden && t.actor)
            .map(t => ({
                id: t.id,
                name: t.name,
                img: t.document.texture.src,
                hasPatrol: patrols.some(p => p.tokenId === t.id)
            })) ?? [];

        // Format patrols for display
        const formattedPatrols = patrols.map(p => this._formatPatrolData(p));
        
        // Get recent activity log
        const activityLog = this._getActivityLog();
        
        // Get capture system settings
        const captureEnabled = getSetting('captureEnabled', true);
        const captureRange = getSetting('captureRange', 2);
        const outcomeWeights = getSetting('captureOutcomeWeights', {
            combat: 30, theft: 25, relocate: 20, disregard: 15, jail: 10
        });
        const briberyEnabled = getSetting('briberyEnabled', true);
        const briberyBaseCost = getSetting('briberyBaseCost', 50);
        const briberyChance = getSetting('briberyChance', 70);
        
        // Get bark system settings
        const barksEnabled = getSetting('barksEnabled', true);
        const barkVolume = getSetting('barkVolume', 0.5);
        const barkCooldown = getSetting('barkCooldown', 2000);
        const customBarkPaths = getSetting('customBarkPaths', {});
        
        // Get telegraph settings
        const telegraphEnabled = getSetting('telegraphEnabled', true);
        const telegraphStyle = getSetting('telegraphStyle', 'ripple');
        const telegraphDuration = getSetting('telegraphDuration', 1500);
        const telegraphColor = getSetting('telegraphColor', '#ff4444');
        const telegraphGMOnly = getSetting('telegraphGMOnly', false);
        
        // Get jail settings
        const jailEnabled = getSetting('jailEnabled', true);
        const jailDefaultDuration = getSetting('jailDefaultDuration', 120);
        const jailEscapeEnabled = getSetting('jailEscapeEnabled', true);
        const jailEscapeDC = getSetting('jailEscapeDC', 15);
        const jailScenes = this._getJailScenes();
        const prisoners = this._getPrisoners();
        
        // Bark categories for UI
        const barkCategories = [
            { key: 'spawn', label: 'Spawn', icon: 'fas fa-plus-circle', path: customBarkPaths.spawn || '' },
            { key: 'despawn', label: 'Despawn', icon: 'fas fa-minus-circle', path: customBarkPaths.despawn || '' },
            { key: 'capture', label: 'Capture', icon: 'fas fa-handcuffs', path: customBarkPaths.capture || '' },
            { key: 'disregard', label: 'Disregard', icon: 'fas fa-hand-paper', path: customBarkPaths.disregard || '' },
            { key: 'theft', label: 'Theft', icon: 'fas fa-coins', path: customBarkPaths.theft || '' },
            { key: 'bribery_accept', label: 'Bribery Accept', icon: 'fas fa-check', path: customBarkPaths.bribery_accept || '' },
            { key: 'bribery_reject', label: 'Bribery Reject', icon: 'fas fa-times', path: customBarkPaths.bribery_reject || '' },
            { key: 'bribery_doublecross', label: 'Bribery Double-Cross', icon: 'fas fa-exclamation', path: customBarkPaths.bribery_doublecross || '' }
        ];
        
        // Jail templates (must match JAIL_CONFIGS keys in JailSystem.js)
        const jailTemplates = [
            { key: 'dungeon', name: 'Medieval Dungeon', icon: 'fas fa-dungeon', description: 'Classic stone dungeon with iron bars' },
            { key: 'barracks', name: 'City Guard Barracks', icon: 'fas fa-building', description: 'Military holding cells' },
            { key: 'cavern', name: 'Underground Cavern', icon: 'fas fa-mountain', description: 'Natural cave prison' },
            { key: 'tower', name: 'Prison Tower', icon: 'fas fa-chess-rook', description: 'Tower with multiple floors' },
            { key: 'city_watch', name: 'City Watch Station', icon: 'fas fa-shield-alt', description: 'Official holding cells' },
            { key: 'castle', name: 'Castle Dungeon', icon: 'fas fa-fort-awesome', description: 'Deep dungeon beneath castle' },
            { key: 'thieves_guild', name: 'Thieves Guild', icon: 'fas fa-mask', description: 'Secret criminal prison' },
            { key: 'temple', name: 'Temple Prison', icon: 'fas fa-place-of-worship', description: 'Sacred holding cell' },
            { key: 'military', name: 'Military Stockade', icon: 'fas fa-crosshairs', description: 'Military prison' },
            { key: 'ancient', name: 'Ancient Ruins', icon: 'fas fa-monument', description: 'Forgotten prison repurposed' }
        ];

        return {
            stats,
            patrols: formattedPatrols,
            sceneTokens,
            activityLog,
            selectedPatrol: this.selectedPatrolId ? 
                formattedPatrols.find(p => p.id === this.selectedPatrolId) : null,
            modes: Object.entries(PATROL_MODES).map(([key, value]) => ({
                value,
                label: game.i18n.localize(`${MODULE_ID}.modes.${value}`)
            })),
            patterns: Object.entries(BLINK_PATTERNS).map(([key, value]) => ({
                value,
                label: game.i18n.localize(`${MODULE_ID}.patterns.${value}`)
            })),
            hasPatrols: patrols.length > 0,
            isGM: game.user.isGM,
            
            // Capture settings
            captureEnabled,
            captureRange,
            outcomeWeights,
            briberyEnabled,
            briberyBaseCost,
            briberyChance,
            
            // Bark settings
            barksEnabled,
            barkVolume,
            barkVolumePercent: Math.round(barkVolume * 100),
            barkCooldown,
            barkCategories,
            
            // Telegraph settings
            telegraphEnabled,
            telegraphStyle,
            telegraphDuration,
            telegraphColor,
            telegraphGMOnly,
            
            // Jail settings
            jailEnabled,
            jailDefaultDuration,
            jailEscapeEnabled,
            jailEscapeDC,
            jailScenes,
            jailTemplates,
            prisoners,
            
            // Scene info
            scene: canvas.scene ? { name: canvas.scene.name } : { name: 'No Scene' },
            version: game.modules.get(MODULE_ID)?.version || '1.0.0'
        };
    }
    
    /**
     * Get jail scenes (from JailSystem)
     */
    _getJailScenes() {
        // Get from JailSystem if available
        if (game.rnkPatrol?.jailSystem) {
            return game.rnkPatrol.jailSystem.getJailScenesWithInfo();
        }
        
        // Fallback: look for scenes with our jail flag
        const scenes = [];
        for (const scene of game.scenes) {
            if (scene.getFlag(MODULE_ID, 'isHardcodedJail')) {
                scenes.push({
                    sceneId: scene.id,
                    sceneName: scene.name,
                    configKey: scene.getFlag(MODULE_ID, 'jailConfigKey'),
                    prisonerCount: 0
                });
            }
        }
        
        return scenes;
    }
    
    /**
     * Get current prisoners
     */
    _getPrisoners() {
        const prisonerData = getSetting('prisonerData', {});
        const prisoners = [];
        
        for (const [actorId, data] of Object.entries(prisonerData)) {
            const actor = game.actors.get(actorId);
            if (actor && data.jailed) {
                const jailScene = game.scenes.get(data.sceneId);
                const timeRemaining = data.releaseTime ? 
                    Math.max(0, Math.ceil((data.releaseTime - Date.now()) / 1000)) : 'Indefinite';
                
                prisoners.push({
                    actorId,
                    name: actor.name,
                    img: actor.img,
                    jailName: jailScene?.name || 'Unknown Jail',
                    timeRemaining: typeof timeRemaining === 'number' ? `${timeRemaining}s` : timeRemaining
                });
            }
        }
        
        return prisoners;
    }

    /**
     * Calculate patrol statistics
     */
    _calculateStats(patrols) {
        const total = patrols.length;
        const active = patrols.filter(p => p.state === PATROL_STATES.ACTIVE).length;
        const paused = patrols.filter(p => p.state === PATROL_STATES.PAUSED).length;
        const alert = patrols.filter(p => p.alertState !== ALERT_STATES.IDLE).length;
        const blink = patrols.filter(p => p.mode === PATROL_MODES.BLINK).length;
        const walk = patrols.filter(p => p.mode === PATROL_MODES.WALK).length;
        
        return {
            total,
            active,
            paused,
            stopped: total - active - paused,
            alert,
            blink,
            walk,
            hybrid: total - blink - walk,
            coverage: this._calculateCoverage(patrols)
        };
    }

    /**
     * Calculate map coverage percentage
     */
    _calculateCoverage(patrols) {
        if (!canvas.scene) return 0;
        
        const sceneArea = canvas.scene.width * canvas.scene.height;
        let coveredArea = 0;
        
        for (const patrol of patrols) {
            const waypoints = patrol.waypoints || [];
            for (const wp of waypoints) {
                const radius = (wp.detectionRadius || 3) * canvas.grid.size;
                coveredArea += Math.PI * radius * radius;
            }
        }
        
        // Cap at 100% and round
        return Math.min(100, Math.round((coveredArea / sceneArea) * 100));
    }

    /**
     * Format patrol data for display
     */
    _formatPatrolData(patrol) {
        const token = canvas.tokens?.get(patrol.tokenId);
        
        return {
            id: patrol.id,
            name: patrol.name,
            tokenId: patrol.tokenId,
            tokenName: token?.name || 'Unknown Token',
            tokenImg: token?.document.texture.src || 'icons/svg/mystery-man.svg',
            mode: patrol.mode,
            modeLabel: game.i18n.localize(`${MODULE_ID}.modes.${patrol.mode}`),
            modeIcon: this._getModeIcon(patrol.mode),
            state: patrol.state,
            stateLabel: game.i18n.localize(`${MODULE_ID}.status.${patrol.state}`),
            stateClass: this._getStateClass(patrol.state),
            alertState: patrol.alertState,
            alertLabel: game.i18n.localize(`${MODULE_ID}.alerts.${patrol.alertState}`),
            isAlert: patrol.alertState !== ALERT_STATES.IDLE,
            waypointCount: patrol.waypoints?.length || 0,
            currentWaypoint: patrol.currentWaypointIndex + 1,
            pattern: patrol.blinkPattern,
            patternLabel: game.i18n.localize(`${MODULE_ID}.patterns.${patrol.blinkPattern}`),
            isActive: patrol.state === PATROL_STATES.ACTIVE,
            isPaused: patrol.state === PATROL_STATES.PAUSED,
            isStopped: patrol.state === PATROL_STATES.IDLE,
            color: patrol.color || '#4a90d9'
        };
    }

    /**
     * Get icon for patrol mode
     */
    _getModeIcon(mode) {
        const icons = {
            [PATROL_MODES.BLINK]: 'fa-bolt',
            [PATROL_MODES.WALK]: 'fa-walking',
            [PATROL_MODES.HYBRID]: 'fa-random'
        };
        return icons[mode] || 'fa-route';
    }

    /**
     * Get CSS class for patrol state
     */
    _getStateClass(state) {
        const classes = {
            [PATROL_STATES.ACTIVE]: 'active',
            [PATROL_STATES.PAUSED]: 'paused',
            [PATROL_STATES.IDLE]: 'stopped',
            [PATROL_STATES.ALERT]: 'alert'
        };
        return classes[state] || 'stopped';
    }

    /**
     * Get recent activity log
     */
    _getActivityLog() {
        // This would pull from a stored activity log
        // For now, return placeholder
        return game.rnkPatrol?.activityLog || [];
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Global controls
        html.find('[data-action="start-all"]').click(() => this._onStartAll());
        html.find('[data-action="stop-all"]').click(() => this._onStopAll());
        html.find('[data-action="pause-all"]').click(() => this._onPauseAll());
        html.find('[data-action="create-patrol"]').click(() => this._onCreatePatrol());
        html.find('[data-action="import-patrols"]').click(() => this._onImportPatrols());
        html.find('[data-action="export-patrols"]').click(() => this._onExportPatrols());
        html.find('[data-action="refresh"]').click(() => this.render(false));

        // Individual patrol controls
        html.find('[data-action="start-patrol"]').click(ev => this._onPatrolAction(ev, 'start'));
        html.find('[data-action="stop-patrol"]').click(ev => this._onPatrolAction(ev, 'stop'));
        html.find('[data-action="pause-patrol"]').click(ev => this._onPatrolAction(ev, 'pause'));
        html.find('[data-action="resume-patrol"]').click(ev => this._onPatrolAction(ev, 'resume'));
        html.find('[data-action="edit-patrol"]').click(ev => this._onEditPatrol(ev));
        html.find('[data-action="delete-patrol"]').click(ev => this._onDeletePatrol(ev));
        html.find('[data-action="pan-to-patrol"]').click(ev => this._onPanToPatrol(ev));
        html.find('[data-action="select-patrol"]').click(ev => this._onSelectPatrol(ev));

        // Quick patrol creation from token
        html.find('[data-action="quick-patrol"]').click(ev => this._onQuickPatrol(ev));

        // Patrol card selection
        html.find('.patrol-card').click(ev => {
            const patrolId = ev.currentTarget.dataset.patrolId;
            this._selectPatrol(patrolId);
        });

        // Search and filter
        html.find('.patrol-search').on('input', ev => this._onSearch(ev));
        html.find('.filter-btn').click(ev => this._onFilter(ev));

        // ==================== Capture System ====================
        html.find('[data-action="save-capture-settings"]').click(() => this._saveCaptureSettings(html));
        
        // Update weight total on change
        html.find('[name^="weight-"]').on('input', () => this._updateWeightTotal(html));
        
        // Range slider value display
        html.find('input[type="range"]').on('input', (ev) => {
            const span = $(ev.currentTarget).siblings('.range-value');
            const val = ev.currentTarget.value;
            if (ev.currentTarget.name === 'briberyChance') {
                span.text(`${val}%`);
            } else if (ev.currentTarget.name === 'barkVolume') {
                span.text(`${Math.round(val * 100)}%`);
            } else if (ev.currentTarget.name === 'telegraphDuration') {
                span.text(`${val}ms`);
            }
        });

        // ==================== Bark System ====================
        html.find('[data-action="save-bark-settings"]').click(() => this._saveBarkSettings(html));
        html.find('[data-action="test-bark"]').click(ev => this._testBark(ev));
        html.find('[data-action="browse-bark"]').click(ev => this._browseBarkFolder(ev));

        // ==================== Telegraph System ====================
        html.find('[data-action="save-telegraph-settings"]').click(() => this._saveTelegraphSettings(html));
        html.find('[data-action="preview-telegraph"]').click(() => this._previewTelegraph());

        // ==================== Jail System ====================
        html.find('[data-action="save-jail-settings"]').click(() => this._saveJailSettings(html));
        html.find('[data-action="create-jail"]').click(ev => this._createJailScene(ev));
        html.find('[data-action="visit-jail"]').click(ev => this._visitJail(ev));
        html.find('[data-action="delete-jail"]').click(ev => this._deleteJail(ev));
        html.find('[data-action="release-prisoner"]').click(ev => this._releasePrisoner(ev));
        html.find('[data-action="visit-prisoner"]').click(ev => this._visitPrisoner(ev));
        html.find('[data-action="release-all-prisoners"]').click(() => this._releaseAllPrisoners());

        // ==================== Utilities ====================
        html.find('[data-action="clear-all-waypoints"]').click(() => this._clearAllWaypoints());

        // Keyboard shortcuts
        html.on('keydown', ev => this._onKeydown(ev));

        // Register for patrol updates
        Hooks.on(`${MODULE_ID}.patrolUpdate`, this._onPatrolUpdate);

        // Start auto-refresh
        this._startAutoRefresh();
    }
    
    /**
     * Update weight total display
     */
    _updateWeightTotal(html) {
        let total = 0;
        html.find('[name^="weight-"]').each((i, el) => {
            total += parseInt(el.value) || 0;
        });
        html.find('.total-value').text(total);
        html.find('.weight-total').toggleClass('error', total !== 100);
    }
    
    /**
     * Save capture system settings
     */
    async _saveCaptureSettings(html) {
        const captureEnabled = html.find('[name="captureEnabled"]').prop('checked');
        const captureRange = parseInt(html.find('[name="captureRange"]').val()) || 2;
        const briberyEnabled = html.find('[name="briberyEnabled"]').prop('checked');
        const briberyBaseCost = parseInt(html.find('[name="briberyBaseCost"]').val()) || 50;
        const briberyChance = parseInt(html.find('[name="briberyChance"]').val()) || 70;
        
        const outcomeWeights = {
            combat: parseInt(html.find('[name="weight-combat"]').val()) || 0,
            theft: parseInt(html.find('[name="weight-theft"]').val()) || 0,
            relocate: parseInt(html.find('[name="weight-relocate"]').val()) || 0,
            disregard: parseInt(html.find('[name="weight-disregard"]').val()) || 0,
            jail: parseInt(html.find('[name="weight-jail"]').val()) || 0
        };
        
        // Validate total
        const total = Object.values(outcomeWeights).reduce((a, b) => a + b, 0);
        if (total !== 100) {
            ui.notifications.warn(`Outcome weights must total 100% (currently ${total}%)`);
            return;
        }
        
        await setSetting('captureEnabled', captureEnabled);
        await setSetting('captureRange', captureRange);
        await setSetting('captureOutcomeWeights', outcomeWeights);
        await setSetting('briberyEnabled', briberyEnabled);
        await setSetting('briberyBaseCost', briberyBaseCost);
        await setSetting('briberyChance', briberyChance);
        
        // Update capture system if it exists
        if (game.rnkPatrol?.captureSystem) {
            game.rnkPatrol.captureSystem.updateSettings();
        }
        
        ui.notifications.info('Capture settings saved!');
    }
    
    /**
     * Save bark system settings
     */
    async _saveBarkSettings(html) {
        const barksEnabled = html.find('[name="barksEnabled"]').prop('checked');
        const barkVolume = parseFloat(html.find('[name="barkVolume"]').val()) || 0.5;
        const barkCooldown = parseInt(html.find('[name="barkCooldown"]').val()) || 2000;
        
        const customBarkPaths = {};
        html.find('[name^="bark-path-"]').each((i, el) => {
            const category = el.name.replace('bark-path-', '');
            if (el.value.trim()) {
                customBarkPaths[category] = el.value.trim();
            }
        });
        
        await setSetting('barksEnabled', barksEnabled);
        await setSetting('barkVolume', barkVolume);
        await setSetting('barkCooldown', barkCooldown);
        await setSetting('customBarkPaths', customBarkPaths);
        
        // Update bark system if it exists
        if (game.rnkPatrol?.barkSystem) {
            game.rnkPatrol.barkSystem.updateSettings();
        }
        
        ui.notifications.info('Bark settings saved!');
    }
    
    /**
     * Test a bark sound
     */
    async _testBark(event) {
        const category = event.currentTarget.dataset.category;
        if (game.rnkPatrol?.barkSystem) {
            await game.rnkPatrol.barkSystem.playBark(category, canvas.scene?.dimensions?.sceneX || 0, canvas.scene?.dimensions?.sceneY || 0);
        } else {
            ui.notifications.warn('Bark system not initialized');
        }
    }
    
    /**
     * Browse for bark folder
     */
    async _browseBarkFolder(event) {
        const category = event.currentTarget.dataset.category;
        const input = this.element.find(`[name="bark-path-${category}"]`);
        
        new FilePicker({
            type: 'folder',
            current: input.val() || `modules/${MODULE_ID}/assets/audio/barks/${category}/`,
            callback: (path) => {
                input.val(path);
            }
        }).render(true);
    }
    
    /**
     * Save telegraph settings
     */
    async _saveTelegraphSettings(html) {
        const telegraphEnabled = html.find('[name="telegraphEnabled"]').prop('checked');
        const telegraphStyle = html.find('[name="telegraphStyle"]').val();
        const telegraphDuration = parseInt(html.find('[name="telegraphDuration"]').val()) || 1500;
        const telegraphColor = html.find('[name="telegraphColor"]').val() || '#ff4444';
        const telegraphGMOnly = html.find('[name="telegraphGMOnly"]').prop('checked');
        
        await setSetting('telegraphEnabled', telegraphEnabled);
        await setSetting('telegraphStyle', telegraphStyle);
        await setSetting('telegraphDuration', telegraphDuration);
        await setSetting('telegraphColor', telegraphColor);
        await setSetting('telegraphGMOnly', telegraphGMOnly);
        
        // Update telegraph system if it exists
        if (game.rnkPatrol?.telegraphSystem) {
            game.rnkPatrol.telegraphSystem.updateSettings();
        }
        
        ui.notifications.info('Telegraph settings saved!');
    }
    
    /**
     * Preview telegraph effect at mouse position
     */
    async _previewTelegraph() {
        if (!canvas.scene) {
            ui.notifications.warn('No active scene');
            return;
        }
        
        // Get center of viewport
        const center = canvas.scene.dimensions;
        const x = center.sceneX + (center.sceneWidth / 2);
        const y = center.sceneY + (center.sceneHeight / 2);
        
        if (game.rnkPatrol?.telegraphSystem) {
            await game.rnkPatrol.telegraphSystem.showTelegraph(x, y);
        } else {
            ui.notifications.warn('Telegraph system not initialized');
        }
    }
    
    /**
     * Save jail settings
     */
    async _saveJailSettings(html) {
        const jailEnabled = html.find('[name="jailEnabled"]').prop('checked');
        const jailDefaultDuration = parseInt(html.find('[name="jailDefaultDuration"]').val()) || 120;
        const jailEscapeEnabled = html.find('[name="jailEscapeEnabled"]').prop('checked');
        const jailEscapeDC = parseInt(html.find('[name="jailEscapeDC"]').val()) || 15;
        
        await setSetting('jailEnabled', jailEnabled);
        await setSetting('jailDefaultDuration', jailDefaultDuration);
        await setSetting('jailEscapeEnabled', jailEscapeEnabled);
        await setSetting('jailEscapeDC', jailEscapeDC);
        
        ui.notifications.info('Jail settings saved!');
    }
    
    /**
     * Create a jail scene from template (on-demand creation)
     */
    async _createJailScene(event) {
        const template = event.currentTarget.dataset.template;
        
        if (game.rnkPatrol?.jailSystem) {
            const scene = await game.rnkPatrol.jailSystem.createJailSceneFromConfig(template);
            if (scene) {
                ui.notifications.info(`Jail scene created: ${scene.name}`);
                this.render(false);
            }
        } else {
            ui.notifications.warn('Jail system not initialized');
        }
    }
    
    /**
     * Visit a jail scene
     */
    async _visitJail(event) {
        const sceneId = event.currentTarget.dataset.sceneId;
        const scene = game.scenes.get(sceneId);
        if (scene) {
            await scene.view();
        }
    }
    
    /**
     * Delete a jail scene
     */
    async _deleteJail(event) {
        const sceneId = event.currentTarget.dataset.sceneId;
        const scene = game.scenes.get(sceneId);
        if (!scene) return;
        
        const confirmed = await Dialog.confirm({
            title: 'Delete Jail Scene',
            content: `<p>Delete jail scene "${scene.name}"? Any prisoners will be released.</p>`
        });
        
        if (confirmed) {
            if (game.rnkPatrol?.jailSystem) {
                await game.rnkPatrol.jailSystem.deleteJailScene(sceneId);
            }
            await scene.delete();
            this.render(false);
        }
    }
    
    /**
     * Release a prisoner
     */
    async _releasePrisoner(event) {
        const actorId = event.currentTarget.dataset.actorId;
        
        if (game.rnkPatrol?.jailSystem) {
            await game.rnkPatrol.jailSystem.releasePrisoner(actorId);
            ui.notifications.info('Prisoner released!');
            this.render(false);
        }
    }
    
    /**
     * Visit prisoner location
     */
    async _visitPrisoner(event) {
        const actorId = event.currentTarget.dataset.actorId;
        const prisonerData = getSetting('prisonerData', {});
        const data = prisonerData[actorId];
        
        if (data?.sceneId) {
            const scene = game.scenes.get(data.sceneId);
            if (scene) {
                await scene.view();
            }
        }
    }
    
    /**
     * Release all prisoners
     */
    async _releaseAllPrisoners() {
        const confirmed = await Dialog.confirm({
            title: 'Release All Prisoners',
            content: '<p>Are you sure you want to release all prisoners?</p>'
        });
        
        if (confirmed && game.rnkPatrol?.jailSystem) {
            await game.rnkPatrol.jailSystem.releaseAllPrisoners();
            ui.notifications.info('All prisoners released!');
            this.render(false);
        }
    }
    
    /**
     * Clear all waypoint graphics from the canvas
     * This removes ALL patrols and waypoints from the current scene
     */
    async _clearAllWaypoints() {
        const result = await Dialog.wait({
            title: 'Clear Waypoints',
            content: `<p>Choose an option:</p>
                      <p><strong>Clear Graphics Only:</strong> Removes visual markers but keeps patrol data (waypoints will return on refresh)</p>
                      <p><strong>Delete All Patrols:</strong> Permanently deletes ALL patrols and their waypoints from this scene</p>`,
            buttons: {
                graphics: {
                    icon: '<i class="fas fa-eye-slash"></i>',
                    label: 'Clear Graphics Only',
                    callback: () => 'graphics'
                },
                delete: {
                    icon: '<i class="fas fa-trash"></i>',
                    label: 'Delete All Patrols',
                    callback: () => 'delete'
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Cancel',
                    callback: () => 'cancel'
                }
            },
            default: 'cancel'
        });
        
        if (result === 'cancel') return;
        
        let removed = 0;
        const manager = game.rnkPatrol?.manager;
        
        if (result === 'delete') {
            // Delete all patrols from this scene permanently
            if (manager) {
                const patrols = [...manager.getPatrols()]; // Copy array since we're modifying it
                for (const patrol of patrols) {
                    await manager.deletePatrol(patrol.id);
                    removed++;
                }
            }
            ui.notifications.info(`Deleted ${removed} patrols and their waypoints from this scene.`);
        } else {
            // Just clear graphics
            // Method 1: Clear through patrol manager if available
            if (manager) {
                const patrols = manager.getPatrols();
                for (const patrol of patrols) {
                    if (patrol.waypoints) {
                        for (const waypoint of patrol.waypoints) {
                            if (waypoint._visual) {
                                waypoint.hideVisual();
                                removed++;
                            }
                        }
                    }
                }
            }
            
            // Method 2: Scan canvas.controls for orphaned waypoint containers
            if (canvas.controls?.children) {
                const toRemove = [];
                for (const child of canvas.controls.children) {
                    // Check if this looks like a waypoint visual (has bg, range, icon children)
                    if (child instanceof PIXI.Container && 
                        child.bg instanceof PIXI.Graphics && 
                        child.icon instanceof PIXI.Text) {
                        toRemove.push(child);
                    }
                }
                
                for (const container of toRemove) {
                    container.destroy({ children: true });
                    removed++;
                }
            }
            
            // Method 3: Also clear any waypoint-related layers/containers by name
            if (canvas.controls?.children) {
                const toRemove = [];
                for (const child of canvas.controls.children) {
                    if (child.label?.text?.includes('WP') || child.label?.text?.includes('Waypoint')) {
                        toRemove.push(child);
                    }
                }
                
                for (const container of toRemove) {
                    if (!container.destroyed) {
                        container.destroy({ children: true });
                        removed++;
                    }
                }
            }
            
            ui.notifications.info(`Cleared ${removed} waypoint graphics (will return on refresh if patrol data exists).`);
        }
        
        this.render(false);
    }

    /** @override */
    close(options = {}) {
        // Cleanup
        Hooks.off(`${MODULE_ID}.patrolUpdate`, this._onPatrolUpdate);
        this._stopAutoRefresh();
        return super.close(options);
    }

    /**
     * Start auto-refresh interval
     */
    _startAutoRefresh() {
        this._stopAutoRefresh();
        this.refreshInterval = setInterval(() => {
            if (this.rendered && !this.isMinimized) {
                this.render(false);
            }
        }, 5000); // Refresh every 5 seconds
    }

    /**
     * Stop auto-refresh
     */
    _stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Handle patrol update event
     */
    _onPatrolUpdate(patrol) {
        if (this.rendered) {
            this.render(false);
        }
    }

    // ==================== Action Handlers ====================

    async _onStartAll() {
        const manager = game.rnkPatrol?.manager;
        if (!manager) return;

        await manager.startAll();
        ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.allStarted`));
        this.render(false);
    }

    async _onStopAll() {
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize(`${MODULE_ID}.dialogs.stopConfirm.title`),
            content: game.i18n.localize(`${MODULE_ID}.dialogs.stopConfirm.content`)
        });

        if (!confirmed) return;

        const manager = game.rnkPatrol?.manager;
        if (!manager) return;

        await manager.stopAll();
        ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.allStopped`));
        this.render(false);
    }

    async _onPauseAll() {
        const manager = game.rnkPatrol?.manager;
        if (!manager) return;

        await manager.pauseAll();
        this.render(false);
    }

    async _onCreatePatrol() {
        const { PatrolCreatorApp } = await import('./PatrolCreatorApp.js');
        new PatrolCreatorApp().render(true);
    }

    async _onPatrolAction(event, action) {
        event.preventDefault();
        event.stopPropagation();

        const patrolId = event.currentTarget.closest('[data-patrol-id]')?.dataset.patrolId;
        if (!patrolId) return;

        const manager = game.rnkPatrol?.manager;
        const patrol = manager?.getPatrol(patrolId);
        if (!patrol) return;

        switch (action) {
            case 'start':
                await patrol.start();
                break;
            case 'stop':
                await patrol.stop();
                break;
            case 'pause':
                await patrol.pause();
                break;
            case 'resume':
                await patrol.resume();
                break;
        }

        this.render(false);
    }

    async _onEditPatrol(event) {
        event.preventDefault();
        event.stopPropagation();

        const patrolId = event.currentTarget.closest('[data-patrol-id]')?.dataset.patrolId;
        if (!patrolId) return;

        const { PatrolConfigApp } = await import('./PatrolConfigApp.js');
        new PatrolConfigApp(patrolId).render(true);
    }

    async _onDeletePatrol(event) {
        event.preventDefault();
        event.stopPropagation();

        const patrolId = event.currentTarget.closest('[data-patrol-id]')?.dataset.patrolId;
        const manager = game.rnkPatrol?.manager;
        const patrol = manager?.getPatrol(patrolId);
        if (!patrol) return;

        const confirmed = await Dialog.confirm({
            title: game.i18n.localize(`${MODULE_ID}.dialogs.deleteConfirm.title`),
            content: game.i18n.format(`${MODULE_ID}.dialogs.deleteConfirm.content`, { name: patrol.name })
        });

        if (!confirmed) return;

        await manager.deletePatrol(patrolId);
        this.selectedPatrolId = null;
        this.render(false);
    }

    async _onPanToPatrol(event) {
        event.preventDefault();
        event.stopPropagation();

        const patrolId = event.currentTarget.closest('[data-patrol-id]')?.dataset.patrolId;
        const manager = game.rnkPatrol?.manager;
        const patrol = manager?.getPatrol(patrolId);
        if (!patrol) return;

        const token = canvas.tokens?.get(patrol.tokenId);
        if (token) {
            canvas.animatePan({ x: token.center.x, y: token.center.y, scale: 1.5 });
        }
    }

    _onSelectPatrol(event) {
        const patrolId = event.currentTarget.closest('[data-patrol-id]')?.dataset.patrolId;
        this._selectPatrol(patrolId);
    }

    _selectPatrol(patrolId) {
        this.selectedPatrolId = patrolId === this.selectedPatrolId ? null : patrolId;
        this.render(false);
    }

    async _onQuickPatrol(event) {
        const tokenId = event.currentTarget.dataset.tokenId;
        const token = canvas.tokens?.get(tokenId);
        if (!token) return;

        const { PatrolCreatorApp } = await import('./PatrolCreatorApp.js');
        new PatrolCreatorApp({ token }).render(true);
    }

    _onSearch(event) {
        const query = event.currentTarget.value.toLowerCase();
        const cards = this.element.find('.patrol-card');

        cards.each((i, card) => {
            const name = card.dataset.patrolName?.toLowerCase() || '';
            const tokenName = card.querySelector('.token-name')?.textContent?.toLowerCase() || '';
            const matches = name.includes(query) || tokenName.includes(query);
            card.style.display = matches ? '' : 'none';
        });
    }

    _onFilter(event) {
        const filter = event.currentTarget.dataset.filter;
        const buttons = this.element.find('.filter-btn');
        buttons.removeClass('active');
        event.currentTarget.classList.add('active');

        const cards = this.element.find('.patrol-card');
        cards.each((i, card) => {
            let show = true;
            const state = card.dataset.state;

            switch (filter) {
                case 'active':
                    show = state === 'active';
                    break;
                case 'paused':
                    show = state === 'paused';
                    break;
                case 'stopped':
                    show = state === 'idle' || state === 'stopped';
                    break;
                case 'alert':
                    show = card.classList.contains('is-alert');
                    break;
            }

            card.style.display = show ? '' : 'none';
        });
    }

    _onKeydown(event) {
        // Keyboard shortcuts
        if (event.key === 'Escape') {
            this.selectedPatrolId = null;
            this.render(false);
        }
    }

    async _onImportPatrols() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                
                const manager = game.rnkPatrol?.manager;
                if (manager && data.patrols) {
                    for (const patrolData of data.patrols) {
                        await manager.createPatrol(patrolData);
                    }
                    ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.importSuccess`));
                    this.render(false);
                }
            } catch (err) {
                console.error(err);
                ui.notifications.error(game.i18n.localize(`${MODULE_ID}.notifications.importFailed`));
            }
        };

        input.click();
    }

    async _onExportPatrols() {
        const manager = game.rnkPatrol?.manager;
        const patrols = manager?.getPatrols() ?? [];

        const exportData = {
            version: game.rnkPatrol?.version || '1.0.0',
            scene: canvas.scene?.name,
            exportedAt: new Date().toISOString(),
            patrols: patrols.map(p => p.toJSON())
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `rnk-patrol-export-${canvas.scene?.name || 'scene'}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.exportSuccess`));
    }

    // ==================== Static Methods ====================

    /**
     * Open the GM Hub
     */
    static open() {
        if (!game.user.isGM) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notifications.gmOnly`));
            return;
        }

        // Check for existing instance
        const existing = Object.values(ui.windows).find(w => w.id === 'rnk-patrol-gm-hub');
        if (existing) {
            existing.bringToTop();
            return existing;
        }

        return new GMHubApp().render(true);
    }
}

// Register the app opener as a global function
Hooks.once('ready', () => {
    game.rnkPatrol.openHub = GMHubApp.open;
});
