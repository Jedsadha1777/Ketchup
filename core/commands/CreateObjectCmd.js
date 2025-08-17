import { Command } from '../Command.js';

export class CreateObjectCmd extends Command {
    constructor(objectManager, spatialGrid, type, x, y, width, height, color, mapType) {
        super();
        this.om = objectManager;
        this.sg = spatialGrid;
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.mapType = mapType;
        this.objectId = null;
        this.objectIndex = null;
        this.storedExtra = null;
        this.storedLabel = '';
    }

    do() {
        const { id, index } = this.om.createObject(this.type, this.x, this.y, this.width, this.height, this.color, this.mapType);
        this.objectId = id;
        this.objectIndex = index;
        
        // Restore stored extra data if this is a redo
        if (this.storedExtra !== null) {
            this.om.extra[index] = JSON.parse(JSON.stringify(this.storedExtra));
        }
        if (this.storedLabel !== '') {
            this.om.labels[index] = this.storedLabel;
        }
        
         this.sg.addObject(id, this.x, this.y, this.width, this.height);
         return { id, index };
    }

    undo() {
        if (this.objectId !== null) {
             const index = this.om.getIndexById(this.objectId);
             if (index !== undefined) {
                // Store current state before removing
                this.storedExtra = this.om.extra[index] ? JSON.parse(JSON.stringify(this.om.extra[index])) : null;
                this.storedLabel = this.om.labels[index];
                
                // Get current bounds for spatial grid removal
                const bounds = this.om.getBounds(index);
                this.sg.removeObject(this.objectId, bounds.x, bounds.y, bounds.width, bounds.height);
                this.om.removeObject(index);
             }
         }
    }
}