import { Command } from '../Command.js';

export class UpdateObjectCmd extends Command {
    constructor(objectManager, objectId, oldData, newData) {
        super();
        this.om = objectManager;
        this.objectId = objectId;
        this.oldData = JSON.parse(JSON.stringify(oldData));
        this.newData = JSON.parse(JSON.stringify(newData));
        this.propertyEvents = null;
    }

    do() {
        const index = this.om.getIndexById(this.objectId);
        if (index === undefined) return;

         // Apply new data and trigger events
        for (const [property, newValue] of Object.entries(this.newData)) {
            if (property === 'extra') continue; // Handle extra separately
            
            const oldValue = this.getPropertyValue(property, index);
            this.setPropertyValue(property, index, newValue);
            
            // Trigger property change event
            if (this.propertyEvents) {
                this.propertyEvents.triggerPropertyChange(index, property, newValue, oldValue);
            }
        }
        
        // Handle extra properties
        if (this.newData.label !== undefined) this.om.labels[index] = this.newData.label;

        if (this.newData.objectId !== undefined) this.om.setObjectId(index, this.newData.objectId);

        if (this.newData.extra !== undefined) {
            this.om.extra[index] = this.newData.extra ? JSON.parse(JSON.stringify(this.newData.extra)) : null;
        }

        return true;
    }

    undo() {
        const index = this.om.getIndexById(this.objectId);
        if (index === undefined) return;

        // Restore old data and trigger events
        for (const [property, oldValue] of Object.entries(this.oldData)) {
            if (property === 'extra') continue; // Handle extra separately
            
            const currentValue = this.getPropertyValue(property, index);
            this.setPropertyValue(property, index, oldValue);
            
            // Trigger property change event
            if (this.propertyEvents) {
                this.propertyEvents.triggerPropertyChange(index, property, oldValue, currentValue);
            }
        }
        
        // Handle extra properties
        if (this.oldData.label !== undefined) this.om.labels[index] = this.oldData.label;
        if (this.oldData.objectId !== undefined) this.om.setObjectId(index, this.oldData.objectId);

        if (this.oldData.extra !== undefined) {
            this.om.extra[index] = this.oldData.extra ? JSON.parse(JSON.stringify(this.oldData.extra)) : null;
        }

        return true;
    }

    merge(next) {
        // Merge consecutive text updates
        if (next instanceof UpdateObjectCmd && next.objectId === this.objectId) {
            this.newData = JSON.parse(JSON.stringify(next.newData));
            return true;
        }
        return false;
    }

    getPropertyValue(property, index) {
        switch (property) {
            case 'label': return this.om.labels[index];
            case 'objectId': return this.om.getObjectId(index);
            default: return undefined;
        }
    }

    setPropertyValue(property, index, value) {
        switch (property) {
            case 'label':
                this.om.labels[index] = value;
                break;
            case 'objectId':
                this.om.setObjectId(index, value);
                break;
        }
    }
}