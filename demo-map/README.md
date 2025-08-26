# Demo Map - Map Planning Example

A demonstration application showing how to use the Ketchup engine for creating interactive maps with pathfinding.

## Overview

This is an example implementation that shows how to build a specialized map editor using Ketchup's core engine. It demonstrates corridor detection, waypoint navigation, and basic pathfinding visualization.

## Features

- **Draw map elements** - Walls, corridors, and rooms
- **Place waypoints** - Add navigation points for pathfinding
- **Place warp points** - Create portal/transition points
- **Pathfinding visualization** - See A* algorithm in action
- **Corridor analysis** - Automatic corridor width detection
- **Toggle layers** - Show/hide different map elements

## How to Use

### Running the Demo
```bash
# Open demo-map/demo-map.html in a web browser
# Or serve with any local web server
```

### Basic Usage
1. **Draw walls and corridors** - Select wall/corridor tool and drag on canvas
2. **Add waypoints** - Select waypoint tool and click to place
3. **Test pathfinding** - Select start and end waypoints from dropdowns
4. **View corridor analysis** - Check "Show Corridors" to see detected paths

### Controls
- Left click and drag to draw/select
- Right click for context menu
- Mouse wheel to zoom
- Middle button to pan

## What This Demo Shows

This demo illustrates:
- How to extend Ketchup for specific use cases
- Implementation of custom analyzers (corridor detection, pathfinding)
- Adding specialized tools (waypoint, warp point)
- Creating domain-specific UI panels

## Architecture & Flow

### High-Level Flow
```
1. MapEditor Initialization
   ├── Load core Ketchup engine
   ├── Override with map-specific config
   └── Initialize analyzers

2. Runtime Loop
   ├── User draws map elements
   ├── Analyzers process in real-time
   │   ├── CorridorAnalyzer → detects walkable areas
   │   └── PathfindingAnalyzer → calculates routes
   └── Visual feedback updates

3. Data Flow
   User Input → Tools → Objects → Analyzers → Visualization
```

### Configuration Override System

The demo extends base configuration through `config.js`:

```javascript
// config.js structure
const mapConfig = {
    ...baseConfig,           // Inherit from base
    
    // Override specific settings
    tools: {
        wall: { color: '#custom' },
        corridor: { minWidth: 50 }
    },
    
    // Add map-specific config
    pathfinding: {
        algorithm: 'astar',
        diagonalMovement: true
    }
};
```

### Analyzer System

Analyzers run independently and process map data:

1. **CorridorAnalyzer**
   - Scans all corridor objects
   - Calculates minimum widths
   - Generates safe navigation areas
   - Updates visual overlay

2. **PathfindingAnalyzer**
   - Builds navigation graph from waypoints
   - Uses A* algorithm for path calculation
   - Considers corridors and obstacles
   - Returns optimal path array

### Extension Points

To create your own map application:

1. **Custom Analyzers** - Add to `analyzers/` folder
2. **Map Object Types** - Define in config
3. **Tool Overrides** - Extend existing tools
4. **Visual Styles** - Customize through config

## Technical Notes

The demo includes:
- `CorridorAnalyzer.js` - Detects walkable paths
- `PathfindingAnalyzer.js` - A* pathfinding implementation
- Custom map object types defined in the main editor

This is a reference implementation - you can copy and modify these patterns for your own map-based applications.

## File Structure
```
demo-map/
├── index.html          # Demo application
├── config.js           # Configuration constants
└── analyzers/          # Analysis algorithms
```

## License

Part of the Ketchup project - MIT License