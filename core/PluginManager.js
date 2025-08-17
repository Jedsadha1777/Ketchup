export class PluginManager {
    constructor(editor) {
        this.editor = editor;
        this.plugins = new Map();
        this.loadedModules = new Set();
        this.pluginQueue = [];
        this.isLoading = false;
    }

    async loadPlugin(pluginPath, options = {}) {
        if (this.loadedModules.has(pluginPath)) {
            console.warn(`Plugin ${pluginPath} already loaded`);
            return this.plugins.get(pluginPath);
        }

        try {
            console.log(`Loading plugin: ${pluginPath}`);
            const module = await import(pluginPath);
            
            if (!module.default) {
                throw new Error(`Plugin ${pluginPath} must have a default export`);
            }

            const PluginClass = module.default;
            const plugin = new PluginClass(this.editor, options);

            // Validate plugin
            if (!plugin.id || !plugin.name) {
                throw new Error(`Plugin ${pluginPath} must have id and name properties`);
            }

            // Check dependencies
            if (plugin.dependencies) {
                await this.loadDependencies(plugin.dependencies);
            }

            // Initialize plugin
            await this.initializePlugin(plugin);

            this.plugins.set(plugin.id, plugin);
            this.loadedModules.add(pluginPath);

            console.log(`Plugin loaded successfully: ${plugin.name} (${plugin.id})`);
            return plugin;

        } catch (error) {
            console.error(`Failed to load plugin: ${pluginPath}`, error);
            throw error;
        }
    }

    async loadDependencies(dependencies) {
        for (const dep of dependencies) {
            if (!this.plugins.has(dep)) {
                throw new Error(`Missing dependency: ${dep}`);
            }
        }
    }

    async initializePlugin(plugin) {
        // Register tools
        if (plugin.tools && Array.isArray(plugin.tools)) {
            for (const tool of plugin.tools) {
                this.editor.tools.add(tool);
            }
        }

        // Register renderers
        if (plugin.renderers && Array.isArray(plugin.renderers)) {
            for (const renderer of plugin.renderers) {
                this.editor.renderers.register(renderer);
            }
        }

        // Register custom components
        if (plugin.components && typeof plugin.components === 'object') {
            for (const [key, component] of Object.entries(plugin.components)) {
                this.editor.components = this.editor.components || {};
                this.editor.components[key] = component;
            }
        }

        // Call plugin's init method if exists
        if (typeof plugin.init === 'function') {
            await plugin.init();
        }

        // Trigger plugin loaded event
        this.editor.emit?.('pluginLoaded', { plugin });
    }

    async unloadPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            console.warn(`Plugin ${pluginId} not found`);
            return;
        }

        try {
            // Call plugin's cleanup method if exists
            if (typeof plugin.cleanup === 'function') {
                await plugin.cleanup();
            }

            // Unregister tools
            if (plugin.tools) {
                for (const tool of plugin.tools) {
                    this.editor.tools.remove?.(tool.id);
                }
            }

            // Unregister renderers (note: สิ่งนี้อาจต้องมีการจัดการที่ซับซ้อนมากขึ้นตอนย้าย)
            if (plugin.renderers) {
                for (const renderer of plugin.renderers) {
                    this.editor.renderers.unregister?.(renderer);
                }
            }

            this.plugins.delete(pluginId);
            console.log(`Plugin unloaded: ${plugin.name} (${pluginId})`);

            // Trigger plugin unloaded event
            this.editor.emit?.('pluginUnloaded', { plugin });

        } catch (error) {
            console.error(`Failed to unload plugin: ${pluginId}`, error);
            throw error;
        }
    }

    async loadPlugins(pluginPaths) {
        this.isLoading = true;
        const results = [];

        for (const path of pluginPaths) {
            try {
                const plugin = await this.loadPlugin(path);
                results.push({ success: true, plugin });
            } catch (error) {
                results.push({ success: false, path, error });
            }
        }

        this.isLoading = false;
        return results;
    }

    getPlugin(pluginId) {
        return this.plugins.get(pluginId);
    }

    getAllPlugins() {
        return Array.from(this.plugins.values());
    }

    isPluginLoaded(pluginId) {
        return this.plugins.has(pluginId);
    }

    getPluginInfo() {
        return Array.from(this.plugins.values()).map(plugin => ({
            id: plugin.id,
            name: plugin.name,
            version: plugin.version || '1.0.0',
            description: plugin.description || '',
            author: plugin.author || 'Unknown'
        }));
    }
}