import { MoveObjectOrderCmd } from '../core/commands/MoveObjectOrderCmd.js';
import { SwapObjectOrderCmd } from '../core/commands/SwapObjectOrderCmd.js';

export class ObjectOrderOperations {
    constructor(editor) {
        this.editor = editor;
        this.setupContextMenu();
        this.setupKeyboardShortcuts();
    }

    // Core order operations
    moveToFront(index) {
        if (index < 0 || index >= this.editor.objects.getObjectCount()) return false;
        if (index === this.editor.objects.getObjectCount() - 1) return false;
       

        const wasSelected = this.editor.objects.selected[index];
        const objectId = this.editor.objects.getIdByIndex(index);
        
        const cmd = new MoveObjectOrderCmd(
            this.editor.objects, 
            this.editor.spatialGrid, 
            index, 
            this.editor.objects.getObjectCount() - 1
        );

        this.editor.history.exec(cmd);

        if (wasSelected) {
            this.editor.objects.clearSelection();
            const newIndex = this.editor.objects.getIndexById(objectId);
            if (newIndex !== undefined) {
                this.editor.objects.addToSelection(newIndex);
            }
        }
        
        this.updateUI();       
        return true;
    }

    moveToBack(index) {
        if (index <= 0 || index >= this.editor.objects.getObjectCount()) return false;
        
        const wasSelected = this.editor.objects.selected[index];
        const objectId = this.editor.objects.getIdByIndex(index);

        const cmd = new MoveObjectOrderCmd(
            this.editor.objects, 
            this.editor.spatialGrid, 
            index, 
            0
        );
        
        this.editor.history.exec(cmd);
        
        if (wasSelected) {
            this.editor.objects.clearSelection();
            const newIndex = this.editor.objects.getIndexById(objectId);
            if (newIndex !== undefined) {
                this.editor.objects.addToSelection(newIndex);
            }
        }
        
        this.updateUI();
        return true;
    }


    moveForward(index) {
        if (index >= this.editor.objects.getObjectCount() - 1) return false;

        const wasSelected = this.editor.objects.selected[index];
        const objectId = this.editor.objects.getIdByIndex(index);
        
        const cmd = new SwapObjectOrderCmd(
            this.editor.objects, 
            this.editor.spatialGrid, 
            index, 
            index + 1
        );
        
        this.editor.history.exec(cmd);

        if (wasSelected) {
            this.editor.objects.clearSelection();
            const newIndex = this.editor.objects.getIndexById(objectId);
            if (newIndex !== undefined) {
                this.editor.objects.addToSelection(newIndex);
            }
        }
        
        this.updateUI();
        return true;
    }


    moveBackward(index) {
        if (index <= 0) return false;

        const wasSelected = this.editor.objects.selected[index];
        const objectId = this.editor.objects.getIdByIndex(index);
        
        const cmd = new SwapObjectOrderCmd(
            this.editor.objects, 
            this.editor.spatialGrid, 
            index, 
            index - 1
        );

        this.editor.history.exec(cmd);
        
        if (wasSelected) {
            this.editor.objects.clearSelection();
            const newIndex = this.editor.objects.getIndexById(objectId);
            if (newIndex !== undefined) {
                this.editor.objects.addToSelection(newIndex);
            }
        }

        this.updateUI();
        return true;
    }


    // Update UI after order changes
     updateUI() {
        this.editor.render();
        this.editor.updateInfo();
        this.editor.inspectorPanel.update();
        this.editor.controlPanel.updateHistoryButtons();
    }

    // Context menu setup
    setupContextMenu() {
        this.editor.canvas.addEventListener('contextmenu', (e) => {
            const pos = this.editor.screenToCanvas(e.clientX, e.clientY);
            const clickedIndex = this.editor.getObjectAt(pos.x, pos.y);
            
            if (clickedIndex !== -1) {
                e.preventDefault();
                this.showOrderContextMenu(e, clickedIndex);
            }
        });
    }

    showOrderContextMenu(event, objectIndex) {
        // Remove existing context menu
        this.removeContextMenu();

        const menu = document.createElement('div');
        menu.className = 'order-context-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${event.clientY}px;
            left: ${event.clientX}px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            z-index: 10000;
            min-width: 150px;
            font-size: 12px;
        `;

        const menuItems = [
            { text: 'Bring to Front', action: () => this.moveToFront(objectIndex), shortcut: 'Ctrl+]' },
            { text: 'Bring Forward', action: () => this.moveForward(objectIndex), shortcut: '↑' },
            { text: 'Send Backward', action: () => this.moveBackward(objectIndex), shortcut: '↓' },
            { text: 'Send to Back', action: () => this.moveToBack(objectIndex), shortcut: 'Ctrl+[' },
            { text: 'separator' },
            { text: 'Delete', action: () => this.editor.deleteObject(objectIndex), shortcut: 'Del' }
        ];

        menuItems.forEach(item => {
            if (item.text === 'separator') {
                const separator = document.createElement('div');
                separator.style.cssText = 'height: 1px; background: #eee; margin: 4px 0;';
                menu.appendChild(separator);
                return;
            }

            const menuItem = document.createElement('div');
            menuItem.style.cssText = `
                padding: 6px 12px;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;
            
            menuItem.innerHTML = `
                <span>${item.text}</span>
                <span style="color: #666; font-size: 10px;">${item.shortcut || ''}</span>
            `;

            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.background = '#f0f0f0';
            });

            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.background = 'transparent';
            });

            menuItem.addEventListener('click', () => {
                item.action();
                this.removeContextMenu();
            });

            menu.appendChild(menuItem);
        });

        document.body.appendChild(menu);

        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', this.removeContextMenu.bind(this), { once: true });
        }, 10);
    }

    removeContextMenu() {
        const existingMenu = document.querySelector('.order-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    }

    // Keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const selectedIndices = this.editor.objects.getSelectedIndices();
            if (selectedIndices.length === 0) return;

            let handled = false;

            // Bring to Front - Ctrl+]
            if (e.ctrlKey && e.key === ']') {
                e.preventDefault();
                // Process all selected objects in order
                this.moveMultipleToFront(selectedIndices);
                handled = true;
            }
            // Send to Back - Ctrl+[
            else if (e.ctrlKey && e.key === '[') {
                e.preventDefault();
                // Process all selected objects in order
                this.moveMultipleToBack(selectedIndices);
                handled = true;
            }
            // Bring Forward - Ctrl+↑
            else if (e.ctrlKey && e.key === 'ArrowUp') {
                e.preventDefault();
                // Process all selected objects
                this.moveMultipleForward(selectedIndices);
                handled = true;
            }
            // Send Backward - Ctrl+↓
            else if (e.ctrlKey && e.key === 'ArrowDown') {
                e.preventDefault();
                // Process all selected objects
                this.moveMultipleBackward(selectedIndices);
                handled = true;
            }

            // UI updates are handled by updateUI() method in each operation
        });
    }

    // Multi-selection methods
    moveMultipleToFront(indices) {
        // Store object IDs and selection states before any operations
        const objectData = indices.map(index => ({
            id: this.editor.objects.getIdByIndex(index),
            wasSelected: this.editor.objects.selected[index]
        }));
        
        // Clear all selections first to avoid conflicts
        this.editor.objects.clearSelection();
        
        // Process from highest index to lowest to avoid index conflicts
        const sortedIndices = [...indices].sort((a, b) => b - a);
        for (const index of sortedIndices) {
            const cmd = new MoveObjectOrderCmd(
                this.editor.objects, 
                this.editor.spatialGrid, 
                index, 
                this.editor.objects.getObjectCount() - 1
            );
            this.editor.history.exec(cmd);
        }
        
        // Restore selections for moved objects
        objectData.forEach(data => {
            if (data.wasSelected) {
                const newIndex = this.editor.objects.getIndexById(data.id);
                if (newIndex !== undefined) {
                    this.editor.objects.addToSelection(newIndex);
                }
            }
        });
        
        this.updateUI();
    }

    moveMultipleToBack(indices) {
        // Store object IDs and selection states before any operations
        const objectData = indices.map(index => ({
            id: this.editor.objects.getIdByIndex(index),
            wasSelected: this.editor.objects.selected[index]
        }));
        
        // Clear all selections first to avoid conflicts
        this.editor.objects.clearSelection();
        
        // Process from lowest index to highest to avoid index conflicts
        const sortedIndices = [...indices].sort((a, b) => a - b);
        for (const index of sortedIndices) {
            const cmd = new MoveObjectOrderCmd(
                this.editor.objects, 
                this.editor.spatialGrid, 
                index, 
                0
            );
            this.editor.history.exec(cmd);
        }
        
        // Restore selections for moved objects
        objectData.forEach(data => {
            if (data.wasSelected) {
                const newIndex = this.editor.objects.getIndexById(data.id);
                if (newIndex !== undefined) {
                    this.editor.objects.addToSelection(newIndex);
                }
            }
        });
        
        this.updateUI();
    }

    moveMultipleForward(indices) {
        // Store object IDs and selection states before any operations
        const objectData = indices.map(index => ({
            id: this.editor.objects.getIdByIndex(index),
            wasSelected: this.editor.objects.selected[index]
        }));
        
        // Clear all selections first to avoid conflicts
        this.editor.objects.clearSelection();
        
        // Process from highest index to lowest to avoid index conflicts
        const sortedIndices = [...indices].sort((a, b) => b - a);
        for (const index of sortedIndices) {
            const cmd = new SwapObjectOrderCmd(
                this.editor.objects, 
                this.editor.spatialGrid, 
                index, 
                index + 1
            );
            this.editor.history.exec(cmd);
        }
        
        // Restore selections for moved objects
        objectData.forEach(data => {
            if (data.wasSelected) {
                const newIndex = this.editor.objects.getIndexById(data.id);
                if (newIndex !== undefined) {
                    this.editor.objects.addToSelection(newIndex);
                }
            }
        });
        
        this.updateUI();
    }

    moveMultipleBackward(indices) {
        // Store object IDs and selection states before any operations
        const objectData = indices.map(index => ({
            id: this.editor.objects.getIdByIndex(index),
            wasSelected: this.editor.objects.selected[index]
        }));
        
        // Clear all selections first to avoid conflicts
        this.editor.objects.clearSelection();
        
        // Process from lowest index to highest to avoid index conflicts
        const sortedIndices = [...indices].sort((a, b) => a - b);
        for (const index of sortedIndices) {
            const cmd = new SwapObjectOrderCmd(
                this.editor.objects, 
                this.editor.spatialGrid, 
                index, 
                index - 1
            );
            this.editor.history.exec(cmd);
        }
        
        // Restore selections for moved objects
        objectData.forEach(data => {
            if (data.wasSelected) {
                const newIndex = this.editor.objects.getIndexById(data.id);
                if (newIndex !== undefined) {
                    this.editor.objects.addToSelection(newIndex);
                }
            }
        });
        
        this.updateUI();
    }

    // Get z-order information for inspector
    getObjectZOrder(index) {
        const totalObjects = this.editor.objects.getObjectCount();
        return {
            current: index + 1, // 1-based for display
            total: totalObjects,
            canMoveUp: index < totalObjects - 1,
            canMoveDown: index > 0
        };
    }
}