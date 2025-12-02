/**
 * RNK Patrol - Compendium Actor Picker
 * 
 * A dialog that allows GMs to browse and search actor compendiums
 * to select actors for guards, inmates, or patrol tokens.
 */

import { MODULE_ID, debug } from '../main.js';

export class CompendiumActorPicker extends Application {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'rnk-compendium-actor-picker',
            title: 'Select Actor from Compendium',
            template: `modules/${MODULE_ID}/templates/compendium-actor-picker.hbs`,
            classes: ['rnk-patrol', 'compendium-actor-picker'],
            width: 700,
            height: 600,
            resizable: true
        });
    }

    /**
     * @param {Object} options
     * @param {string} options.mode - 'guard', 'inmate', or 'patrol'
     * @param {string} [options.sceneId] - The jail scene ID if applicable
     * @param {number} [options.slotIndex] - Which guard/inmate slot (0-based)
     * @param {Function} options.callback - Called with selected actor data
     */
    constructor(options = {}) {
        super(options);
        this.mode = options.mode || 'guard';
        this.sceneId = options.sceneId;
        this.slotIndex = options.slotIndex ?? 0;
        this.callback = options.callback;
        this._searchQuery = '';
        this._selectedPack = 'all';
        this._actors = [];
        this._filteredActors = [];
        this._loading = false;
    }

    async getData(options = {}) {
        // Get all Actor compendiums
        const actorPacks = game.packs.filter(p => p.documentName === 'Actor');
        const packOptions = [
            { value: 'all', label: 'All Compendiums' },
            { value: 'world', label: 'World Actors' },
            ...actorPacks.map(p => ({
                value: p.collection,
                label: `${p.metadata.label} (${p.metadata.packageName})`
            }))
        ];

        return {
            mode: this.mode,
            modeLabel: this._getModeLabel(),
            packOptions,
            selectedPack: this._selectedPack,
            searchQuery: this._searchQuery,
            actors: this._filteredActors,
            loading: this._loading,
            hasActors: this._filteredActors.length > 0
        };
    }

    _getModeLabel() {
        switch (this.mode) {
            case 'guard': return 'Guard Actor';
            case 'inmate': return 'Inmate Actor';
            case 'patrol': return 'Patrol Token Actor';
            default: return 'Actor';
        }
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Pack selection
        html.find('[name="compendium-pack"]').on('change', async (ev) => {
            this._selectedPack = ev.currentTarget.value;
            await this._loadActors();
            this.render();
        });

        // Search input (debounced)
        let searchTimeout;
        html.find('[name="actor-search"]').on('input', (ev) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this._searchQuery = ev.currentTarget.value.toLowerCase();
                this._filterActors();
                this.render();
            }, 300);
        });

        // Actor selection
        html.find('.actor-item').on('click', (ev) => {
            const actorData = {
                id: ev.currentTarget.dataset.actorId,
                name: ev.currentTarget.dataset.actorName,
                img: ev.currentTarget.dataset.actorImg,
                pack: ev.currentTarget.dataset.actorPack,
                uuid: ev.currentTarget.dataset.actorUuid
            };
            this._selectActor(actorData);
        });

        // Clear selection button
        html.find('[data-action="clear-selection"]').on('click', () => {
            this._selectActor(null);
        });

        // Load actors on first render
        if (!this._actors.length && !this._loading) {
            this._loadActors();
        }
    }

    async _loadActors() {
        this._loading = true;
        this._actors = [];

        try {
            if (this._selectedPack === 'all') {
                // Load from all Actor compendiums + world
                await this._loadWorldActors();
                await this._loadAllCompendiumActors();
            } else if (this._selectedPack === 'world') {
                await this._loadWorldActors();
            } else {
                await this._loadCompendiumActors(this._selectedPack);
            }
        } catch (err) {
            console.error('RNK Patrol | Error loading actors:', err);
            ui.notifications.error('Failed to load actors from compendiums');
        }

        this._loading = false;
        this._filterActors();
    }

    async _loadWorldActors() {
        for (const actor of game.actors) {
            // Filter based on mode - guards should typically be NPCs
            if (this.mode === 'guard' && actor.hasPlayerOwner) continue;
            
            this._actors.push({
                id: actor.id,
                name: actor.name,
                img: actor.img || 'icons/svg/mystery-man.svg',
                pack: 'world',
                packLabel: 'World Actors',
                uuid: actor.uuid,
                type: actor.type
            });
        }
    }

    async _loadAllCompendiumActors() {
        const actorPacks = game.packs.filter(p => p.documentName === 'Actor');
        for (const pack of actorPacks) {
            await this._loadCompendiumActors(pack.collection);
        }
    }

    async _loadCompendiumActors(packId) {
        const pack = game.packs.get(packId);
        if (!pack) return;

        try {
            // Get the index (lightweight - doesn't load full documents)
            const index = await pack.getIndex({ fields: ['name', 'img', 'type'] });
            
            for (const entry of index) {
                this._actors.push({
                    id: entry._id,
                    name: entry.name,
                    img: entry.img || 'icons/svg/mystery-man.svg',
                    pack: packId,
                    packLabel: pack.metadata.label,
                    uuid: `Compendium.${packId}.Actor.${entry._id}`,
                    type: entry.type || 'unknown'
                });
            }
        } catch (err) {
            console.warn(`RNK Patrol | Could not load index for pack ${packId}:`, err);
        }
    }

    _filterActors() {
        if (!this._searchQuery) {
            this._filteredActors = [...this._actors].slice(0, 100); // Limit for performance
        } else {
            this._filteredActors = this._actors
                .filter(a => a.name.toLowerCase().includes(this._searchQuery))
                .slice(0, 100);
        }
    }

    async _selectActor(actorData) {
        debug(`Selected actor for ${this.mode}:`, actorData);
        
        if (this.callback) {
            await this.callback({
                mode: this.mode,
                sceneId: this.sceneId,
                slotIndex: this.slotIndex,
                actor: actorData
            });
        }
        
        this.close();
    }
}

/**
 * Helper function to open the compendium actor picker
 * @param {Object} options - Same options as CompendiumActorPicker constructor
 * @returns {CompendiumActorPicker}
 */
export function openCompendiumActorPicker(options) {
    const picker = new CompendiumActorPicker(options);
    picker.render(true);
    return picker;
}
