

export class ObjectManager {
    constructor() {
        // Flat arrays for performance
        this.ids = [];
        this.types = [];          // 'rectangle', 'circle'
        this.mapTypes = [];       // 'wall', 'corridor', 'room', 'waypoint', null
        this.x = [];
        this.y = [];
        this.width = [];
        this.height = [];
        this.colors = [];
        this.objectIds = [];
        this.objectIdToIndex = new Map();
        this.selected = [];
        this.labels = [];
        this.extra = [];
        this.nextId = 0;
        
        // ID to Index mapping for efficient lookups
        this.idToIndex = new Map();
    }

    createObject(type, x, y, width, height, color = '#3498db', mapType = null) {
        const index = this.ids.length;
        const id = this.nextId++;
        
        this.ids[index] = id;
        this.types[index] = type;
        this.mapTypes[index] = mapType;
        this.x[index] = x;
        this.y[index] = y;
        this.width[index] = width;
        this.height[index] = height;
        this.colors[index] = color;
        this.selected[index] = false;
        this.labels[index] = '';
        this.objectIds[index] = '';
        this.extra[index] = null;
        
        // Update ID mapping
        this.idToIndex.set(id, index);

        return { id, index };
    }

    setObjectId(index, objectId) {
       if (index < 0 || index >= this.objectIds.length) return false;

        
        // Remove old mapping if exists
        const oldObjectId = this.objectIds[index];
        if (oldObjectId) {
            this.objectIdToIndex.delete(oldObjectId);
        }
        
        // Set new mapping
        this.objectIds[index] = objectId;
        if (objectId) {
            this.objectIdToIndex.set(objectId, index);
        }
        return true;
    }

    getObjectId(index) {
        return this.objectIds[index] || '';
    }

    getIndexByObjectId(objectId) {
        return this.objectIdToIndex.get(objectId);
    }

    isObjectIdAvailable(objectId) {
        return !this.objectIdToIndex.has(objectId);
    }

    removeObject(index) {
        const id = this.ids[index];
        const objectId = this.objectIds[index];
         
       // Remove from objectId mapping
        if (objectId) {
            this.objectIdToIndex.delete(objectId);
         }
        
        // Remove from arrays
        this.ids.splice(index, 1);
        this.types.splice(index, 1);
        this.mapTypes.splice(index, 1);
        this.x.splice(index, 1);
        this.y.splice(index, 1);
        this.width.splice(index, 1);
        this.height.splice(index, 1);
        this.colors.splice(index, 1);
        this.selected.splice(index, 1);
        this.labels.splice(index, 1);
        this.objectIds.splice(index, 1);
        this.extra.splice(index, 1);
        
        // Update ID mappings - remove deleted ID and update shifted indices
        this.idToIndex.delete(id);
        for (let i = index; i < this.ids.length; i++) {
            this.idToIndex.set(this.ids[i], i);
        }

        // Update objectId mappings
        this.objectIdToIndex.clear();
        for (let i = 0; i < this.objectIds.length; i++) {
            if (this.objectIds[i]) {
                this.objectIdToIndex.set(this.objectIds[i], i);
            }
         }

    }

    updateObject(index, props) {
        if (props.x !== undefined) this.x[index] = props.x;
        if (props.y !== undefined) this.y[index] = props.y;
        if (props.width !== undefined) this.width[index] = props.width;
        if (props.height !== undefined) this.height[index] = props.height;
        if (props.color !== undefined) this.colors[index] = props.color;
        if (props.selected !== undefined) this.selected[index] = props.selected;
        if (props.objectId !== undefined) this.setObjectId(index, props.objectId);
        if (props.label !== undefined) this.labels[index] = props.label;
        if (props.extra !== undefined) this.extra[index] = props.extra;
    }

    getBounds(index) {
        return {
            x: this.x[index],
            y: this.y[index],
            width: this.width[index],
            height: this.height[index]
        };
    }

    setBounds(index, bounds) {
        this.x[index] = bounds.x;
        this.y[index] = bounds.y;
        this.width[index] = bounds.width;
        this.height[index] = bounds.height;
    }

    // using renderer system in getObjectAt()

    selectObject(index) {
         this.clearSelection();
        if (index !== -1) {
            this.selected[index] = true;
        }
    }

    toggleSelection(index) {
        if (index !== -1) {
            this.selected[index] = !this.selected[index];
        }
    }
    
    addToSelection(index) {
        if (index !== -1) {
            this.selected[index] = true;
        }
    }
    
    clearSelection() {
        for (let i = 0; i < this.selected.length; i++) {
            this.selected[i] = false;
        }
    }

    getSelected() {
        return this.selected.findIndex(sel => sel);  // First selected
    }

    getSelectedIndices() {
        const indices = [];
        for (let i = 0; i < this.selected.length; i++) {
            if (this.selected[i]) indices.push(i);
        }
        return indices;
    }
    
    hasMultipleSelected() {
        return this.getSelectedIndices().length > 1;
    }
    
    getIndexById(id) {
        return this.idToIndex.get(id);
    }

    getIdByIndex(index) {
        return this.ids[index];
    }

    getObjectCount() {
        return this.ids.length;
    }

    canResize(index) {
        return this.mapTypes[index] !== 'waypoint';
    }

     toJSON() {
        return {
            version: 1,
            objects: this.ids.map((id, i) => ({
                id,
                type: this.types[i],
                mapType: this.mapTypes[i],
                x: this.x[i],
                y: this.y[i],
                w: this.width[i],
                h: this.height[i],
                color: this.colors[i],
                label: this.labels[i],
                objectId: this.objectIds[i],
                extra: this.extra[i] ?? null
            }))
        };
    }

    fromJSON(data) {
        this.clear();        
        for (const o of data.objects) {
            const { index } = this.createObject(o.type, o.x, o.y, o.w, o.h, o.color, o.mapType);
            this.labels[index] = o.label ?? '';
            this.objectIds[index] = o.objectId ?? '';
            this.extra[index] = o.extra ?? null;
        }

        // Rebuild objectId mappings after loading
        this.objectIdToIndex.clear();
        for (let i = 0; i < this.objectIds.length; i++) {
            if (this.objectIds[i]) {
                this.objectIdToIndex.set(this.objectIds[i], i);
             }
         }
    }

    

    clear() {
        // Clear all arrays and mappings
        this.ids.length = 0;
        this.types.length = 0;
        this.mapTypes.length = 0;
        this.x.length = 0;
        this.y.length = 0;
        this.width.length = 0;
        this.height.length = 0;
        this.colors.length = 0;
        this.selected.length = 0;
        this.labels.length = 0;
        this.objectIds.length = 0;
        this.objectIdToIndex.clear();
        this.extra.length = 0;
        this.nextId = 0;
        this.idToIndex.clear();
    }
}