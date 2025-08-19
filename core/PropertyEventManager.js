export class PropertyEventManager {
    constructor(objectManager) {
        this.objectManager = objectManager;
        this.callbacks = new Map(); // objectId -> { property -> [callbacks] }
        this.globalCallbacks = new Map(); // property -> [callbacks] for all objects
    }

    /**
     * Register callback for specific object property change
     * @param {string} objectId - Object ID (user-defined)
     * @param {string} property - Property name (x, y, color, etc.)
     * @param {function} callback - Function to call: (newValue, oldValue, objectId, property) => {}
     */
    onPropertyChange(objectId, property, callback) {
        if (!this.callbacks.has(objectId)) {
            this.callbacks.set(objectId, new Map());
        }
        
        const objectCallbacks = this.callbacks.get(objectId);
        if (!objectCallbacks.has(property)) {
            objectCallbacks.set(property, []);
        }
        
        objectCallbacks.get(property).push(callback);
        
        return () => this.removeCallback(objectId, property, callback);
    }

    /**
     * Register global callback for any object's property change
     * @param {string} property - Property name
     * @param {function} callback - Function to call: (newValue, oldValue, objectId, property) => {}
     */
    onAnyPropertyChange(property, callback) {
        if (!this.globalCallbacks.has(property)) {
            this.globalCallbacks.set(property, []);
        }
        
        this.globalCallbacks.get(property).push(callback);
        
        return () => this.removeGlobalCallback(property, callback);
    }

    /**
     * Remove specific callback
     */
    removeCallback(objectId, property, callback) {
        const objectCallbacks = this.callbacks.get(objectId);
        if (objectCallbacks && objectCallbacks.has(property)) {
            const callbacks = objectCallbacks.get(property);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Remove global callback
     */
    removeGlobalCallback(property, callback) {
        if (this.globalCallbacks.has(property)) {
            const callbacks = this.globalCallbacks.get(property);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Trigger callbacks for property change
     * @param {number} index - Object index
     * @param {string} property - Property name
     * @param {*} newValue - New value
     * @param {*} oldValue - Old value
     */
    triggerPropertyChange(index, property, newValue, oldValue) {
        const objectId = this.objectManager.getObjectId(index);
        
        // Skip if values are the same
        if (newValue === oldValue) return;
        
        try {
            // Trigger object-specific callbacks
            if (objectId && this.callbacks.has(objectId)) {
                const objectCallbacks = this.callbacks.get(objectId);
                if (objectCallbacks.has(property)) {
                    const callbacks = objectCallbacks.get(property);
                    for (const callback of callbacks) {
                        callback(newValue, oldValue, objectId, property);
                    }
                }
            }
            
            // Trigger global callbacks
            if (this.globalCallbacks.has(property)) {
                const callbacks = this.globalCallbacks.get(property);
                for (const callback of callbacks) {
                    callback(newValue, oldValue, objectId, property);
                }
            }
        } catch (error) {
            console.error(`Error in property change callback for ${objectId}.${property}:`, error);
        }
    }

    /**
     * Set property and trigger callbacks
     * @param {string} objectId - Object ID
     * @param {string} property - Property name
     * @param {*} value - New value
     */
    setProperty(objectId, property, value) {
        const index = this.objectManager.getIndexByObjectId(objectId);
        if (index === undefined) {
            console.warn(`Object with ID "${objectId}" not found`);
            return false;
        }

        const oldValue = this.getPropertyValue(index, property);
        
        // Set the property
        if (this.setPropertyValue(index, property, value)) {
            // Trigger callbacks
            this.triggerPropertyChange(index, property, value, oldValue);
            return true;
        }
        
        return false;
    }

    /**
     * Get property value by name
     */
    getPropertyValue(index, property) {
        switch (property) {
            case 'x': return this.objectManager.x[index];
            case 'y': return this.objectManager.y[index];
            case 'width': return this.objectManager.width[index];
            case 'height': return this.objectManager.height[index];
            case 'color': return this.objectManager.colors[index];
            case 'label': return this.objectManager.labels[index];
            case 'objectId': return this.objectManager.getObjectId(index);
            case 'selected': return this.objectManager.selected[index];
            default:
                // Check extra properties
                const extra = this.objectManager.extra[index];
                if (extra && property in extra) {
                    return extra[property];
                }
                return undefined;
        }
    }

    /**
     * Set property value by name
     */
    setPropertyValue(index, property, value) {
        switch (property) {
            case 'x':
                this.objectManager.x[index] = value;
                return true;
            case 'y':
                this.objectManager.y[index] = value;
                return true;
            case 'width':
                this.objectManager.width[index] = value;
                return true;
            case 'height':
                this.objectManager.height[index] = value;
                return true;
            case 'color':
                this.objectManager.colors[index] = value;
                return true;
            case 'label':
                this.objectManager.labels[index] = value;
                return true;
            case 'objectId':
                return this.objectManager.setObjectId(index, value);
            case 'selected':
                this.objectManager.selected[index] = value;
                return true;
            default:
                // Handle extra properties
                if (!this.objectManager.extra[index]) {
                    this.objectManager.extra[index] = {};
                }
                this.objectManager.extra[index][property] = value;
                return true;
        }
    }

    /**
     * Get property value by object ID
     */
    getProperty(objectId, property) {
        const index = this.objectManager.getIndexByObjectId(objectId);
        if (index === undefined) return undefined;
        
        return this.getPropertyValue(index, property);
    }

    /**
     * Clear all callbacks
     */
    clearAllCallbacks() {
        this.callbacks.clear();
        this.globalCallbacks.clear();
    }

    /**
     * Clear callbacks for specific object
     */
    clearObjectCallbacks(objectId) {
        this.callbacks.delete(objectId);
    }

    /**
     * Get registered callbacks info (for debugging)
     */
    getCallbackInfo() {
        const info = {
            objectCallbacks: {},
            globalCallbacks: {}
        };
        
        for (const [objectId, propertyMap] of this.callbacks) {
            info.objectCallbacks[objectId] = {};
            for (const [property, callbacks] of propertyMap) {
                info.objectCallbacks[objectId][property] = callbacks.length;
            }
        }
        
        for (const [property, callbacks] of this.globalCallbacks) {
            info.globalCallbacks[property] = callbacks.length;
        }
        
        return info;
    }
}