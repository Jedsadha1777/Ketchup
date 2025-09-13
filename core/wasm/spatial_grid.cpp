// spatial_grid.cpp - Fixed version that compiles
#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#include <unordered_map>
#include <unordered_set>
#include <vector>
#include <cmath>
#include <algorithm>
#include <cstddef>  // for size_t

using namespace emscripten;

class SpatialGrid {
public:
    enum RadiusPrecision {
        PRECISION_SQUARE = 0,
        PRECISION_CENTER = 1,
        PRECISION_BOUNDS = 2
    };

private:
    int cellSize;
    
    struct CellCoord {
        int x;
        int y;
        
        bool operator==(const CellCoord& other) const {
            return x == other.x && y == other.y;
        }
    };
    
    struct CellCoordHash {
        std::size_t operator()(const CellCoord& coord) const {
        // Use appropriate initial value based on platform
            #if SIZE_MAX == UINT64_MAX
                // 64-bit platform
                std::size_t h = 14695981039346656037ULL;
                const std::size_t prime = 1099511628211ULL;
            #else
                // 32-bit platform
                std::size_t h = 2166136261U;
                const std::size_t prime = 16777619U;
            #endif
            
            h ^= std::hash<int>{}(coord.x);
            h *= prime;
            h ^= std::hash<int>{}(coord.y);
            h *= prime;
            return h;
        }

    };
    
    struct ObjectInfo {
        int x, y, width, height;
    };
    
    struct CachedStats {
        double avgObjectsPerCell = 5.0;
        std::size_t totalObjectReferences = 0;
        std::size_t maxObjectsPerCell = 0;
        bool dirty = true;
    };
    
    std::unordered_map<CellCoord, std::unordered_set<int>, CellCoordHash> grid;
    std::unordered_map<int, ObjectInfo> objectData;
    mutable CachedStats cachedStats;
    
    static thread_local std::vector<int> tlsResultBuffer;
    static thread_local std::unordered_set<int> tlsUniqueBuffer;
    
    inline int floorDiv(int a, int b) const {
        return (a >= 0) ? (a / b) : ((a - b + 1) / b);
    }
    
    inline CellCoord getCellCoord(int x, int y) const {
        return {floorDiv(x, cellSize), floorDiv(y, cellSize)};
    }
    
    void updateCachedStats() const {
        if (!cachedStats.dirty) return;
        
        cachedStats.totalObjectReferences = 0;
        cachedStats.maxObjectsPerCell = 0;
        
        for (const auto& cell : grid) {
            std::size_t cellSize = cell.second.size();
            cachedStats.totalObjectReferences += cellSize;
            cachedStats.maxObjectsPerCell = std::max(cachedStats.maxObjectsPerCell, cellSize);
        }
        
        cachedStats.avgObjectsPerCell = grid.empty() ? 5.0 : 
            static_cast<double>(cachedStats.totalObjectReferences) / grid.size();
        
        cachedStats.dirty = false;
    }
    
    inline std::size_t estimateCapacity(int startX, int startY, int endX, int endY) const {
        if (cachedStats.dirty) {
            updateCachedStats();
        }
        
        std::size_t cellCount = (endX - startX + 1) * (endY - startY + 1);
        std::size_t estimate = static_cast<std::size_t>(cellCount * cachedStats.avgObjectsPerCell * 1.5);
        
        return std::max(estimate, std::size_t(32));
    }
    
    void addToCells(int id, int x, int y, int width, int height) {
        int startX = floorDiv(x, cellSize);
        int startY = floorDiv(y, cellSize);
        int endX = floorDiv(x + width - 1, cellSize);
        int endY = floorDiv(y + height - 1, cellSize);
        
        for (int cellX = startX; cellX <= endX; cellX++) {
            for (int cellY = startY; cellY <= endY; cellY++) {
                grid[{cellX, cellY}].insert(id);
            }
        }
        
        cachedStats.dirty = true;
    }
    
    void removeFromCells(int id, int x, int y, int width, int height) {
        int startX = floorDiv(x, cellSize);
        int startY = floorDiv(y, cellSize);
        int endX = floorDiv(x + width - 1, cellSize);
        int endY = floorDiv(y + height - 1, cellSize);
        
        for (int cellX = startX; cellX <= endX; cellX++) {
            for (int cellY = startY; cellY <= endY; cellY++) {
                CellCoord coord = {cellX, cellY};
                auto it = grid.find(coord);
                if (it != grid.end()) {
                    it->second.erase(id);
                    if (it->second.empty()) {
                        grid.erase(it);
                    }
                }
            }
        }
        
        cachedStats.dirty = true;
    }
    
    inline bool rectangleIntersectsCircle(int rx, int ry, int rw, int rh,
                                          int cx, int cy, int radius) const {
        int closestX = std::max(rx, std::min(cx, rx + rw));
        int closestY = std::max(ry, std::min(cy, ry + rh));
        
        int dx = closestX - cx;
        int dy = closestY - cy;
        return (dx * dx + dy * dy) <= (radius * radius);
    }
    
public:
    SpatialGrid(int cell_size = 100) : cellSize(cell_size) {
        grid.reserve(256);
        objectData.reserve(1000);
        tlsResultBuffer.reserve(100);
        tlsUniqueBuffer.reserve(100);
    }
    
    void addObject(int id, int x, int y, int width, int height) {
        objectData[id] = {x, y, width, height};
        addToCells(id, x, y, width, height);
    }
    
    void removeObject(int id) {
        auto it = objectData.find(id);
        if (it != objectData.end()) {
            removeFromCells(id, it->second.x, it->second.y, 
                          it->second.width, it->second.height);
            objectData.erase(it);
        }
    }
    
    void updateObject(int id, int x, int y, int width, int height) {
        auto it = objectData.find(id);
        if (it == objectData.end()) {
            addObject(id, x, y, width, height);
            return;
        }
        
        ObjectInfo& info = it->second;
        
        if (info.x == x && info.y == y && 
            info.width == width && info.height == height) {
            return;
        }
        
        int oldStartX = floorDiv(info.x, cellSize);
        int oldStartY = floorDiv(info.y, cellSize);
        int oldEndX = floorDiv(info.x + info.width - 1, cellSize);
        int oldEndY = floorDiv(info.y + info.height - 1, cellSize);
        
        int newStartX = floorDiv(x, cellSize);
        int newStartY = floorDiv(y, cellSize);
        int newEndX = floorDiv(x + width - 1, cellSize);
        int newEndY = floorDiv(y + height - 1, cellSize);
        
        if (oldStartX != newStartX || oldStartY != newStartY ||
            oldEndX != newEndX || oldEndY != newEndY) {
            removeFromCells(id, info.x, info.y, info.width, info.height);
            addToCells(id, x, y, width, height);
        }
        
        info.x = x;
        info.y = y;
        info.width = width;
        info.height = height;
    }
    
    std::vector<int> getObjectsAt(int x, int y) {
        tlsResultBuffer.clear();
        
        CellCoord coord = getCellCoord(x, y);
        auto it = grid.find(coord);
        
        if (it != grid.end()) {
            tlsResultBuffer.assign(it->second.begin(), it->second.end());
        }
        
        return tlsResultBuffer;
    }
    
    std::vector<int> getObjectsInRect(int x, int y, int width, int height) {
        tlsUniqueBuffer.clear();
        
        int startX = floorDiv(x, cellSize);
        int startY = floorDiv(y, cellSize);
        int endX = floorDiv(x + width - 1, cellSize);
        int endY = floorDiv(y + height - 1, cellSize);
        
        std::size_t estimated = estimateCapacity(startX, startY, endX, endY);
        if (estimated > tlsUniqueBuffer.bucket_count()) {
            tlsUniqueBuffer.reserve(estimated);
        }
        
        for (int cellX = startX; cellX <= endX; cellX++) {
            for (int cellY = startY; cellY <= endY; cellY++) {
                auto it = grid.find({cellX, cellY});
                if (it != grid.end()) {
                    tlsUniqueBuffer.insert(it->second.begin(), it->second.end());
                }
            }
        }
        
        tlsResultBuffer.clear();
        tlsResultBuffer.reserve(tlsUniqueBuffer.size());
        tlsResultBuffer.assign(tlsUniqueBuffer.begin(), tlsUniqueBuffer.end());
        return tlsResultBuffer;
    }
    
    std::vector<int> getObjectsInRadius(int centerX, int centerY, int radius, RadiusPrecision precision) {
        tlsUniqueBuffer.clear();
        
        int startX = floorDiv(centerX - radius, cellSize);
        int startY = floorDiv(centerY - radius, cellSize);
        int endX = floorDiv(centerX + radius, cellSize);
        int endY = floorDiv(centerY + radius, cellSize);
        
        std::size_t estimated = estimateCapacity(startX, startY, endX, endY);
        if (estimated > tlsUniqueBuffer.bucket_count()) {
            tlsUniqueBuffer.reserve(estimated);
        }
        
        if (precision == PRECISION_SQUARE) {
            for (int cellX = startX; cellX <= endX; cellX++) {
                for (int cellY = startY; cellY <= endY; cellY++) {
                    auto it = grid.find({cellX, cellY});
                    if (it != grid.end()) {
                        tlsUniqueBuffer.insert(it->second.begin(), it->second.end());
                    }
                }
            }
        } 
        else if (precision == PRECISION_CENTER) {
            int radiusSq = radius * radius;
            
            for (int cellX = startX; cellX <= endX; cellX++) {
                for (int cellY = startY; cellY <= endY; cellY++) {
                    auto it = grid.find({cellX, cellY});
                    if (it != grid.end()) {
                        for (int id : it->second) {
                            auto objIt = objectData.find(id);
                            if (objIt != objectData.end()) {
                                int objCenterX = objIt->second.x + objIt->second.width / 2;
                                int objCenterY = objIt->second.y + objIt->second.height / 2;
                                int dx = objCenterX - centerX;
                                int dy = objCenterY - centerY;
                                
                                if (dx * dx + dy * dy <= radiusSq) {
                                    tlsUniqueBuffer.insert(id);
                                }
                            }
                        }
                    }
                }
            }
        }
        else {
            for (int cellX = startX; cellX <= endX; cellX++) {
                for (int cellY = startY; cellY <= endY; cellY++) {
                    auto it = grid.find({cellX, cellY});
                    if (it != grid.end()) {
                        for (int id : it->second) {
                            auto objIt = objectData.find(id);
                            if (objIt != objectData.end()) {
                                if (rectangleIntersectsCircle(
                                    objIt->second.x, objIt->second.y,
                                    objIt->second.width, objIt->second.height,
                                    centerX, centerY, radius)) {
                                    tlsUniqueBuffer.insert(id);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        tlsResultBuffer.clear();
        tlsResultBuffer.reserve(tlsUniqueBuffer.size());
        tlsResultBuffer.assign(tlsUniqueBuffer.begin(), tlsUniqueBuffer.end());
        return tlsResultBuffer;
    }
    
    int updateObjectsBatch(const std::vector<int>& ids,
                           const std::vector<int>& xs,
                           const std::vector<int>& ys,
                           const std::vector<int>& widths,
                           const std::vector<int>& heights) {
        std::size_t size = ids.size();
        
        if (xs.size() != size || ys.size() != size || 
            widths.size() != size || heights.size() != size) {
            return -1;
        }
        
        grid.reserve(grid.size() + size * 4);
        
        for (std::size_t i = 0; i < size; i++) {
            updateObject(ids[i], xs[i], ys[i], widths[i], heights[i]);
        }
        
        return 0;
    }
    
    void clear() {
        grid.clear();
        objectData.clear();
        tlsResultBuffer.clear();
        tlsUniqueBuffer.clear();
        cachedStats = CachedStats();
    }
    
    std::size_t getCellCount() const {
        return grid.size();
    }
    
    std::size_t getObjectCount() const {
        return objectData.size();
    }
    
    std::size_t getMemoryEstimate() const {
        std::size_t estimate = 0;
        
        estimate += grid.bucket_count() * sizeof(void*);
        estimate += grid.size() * (sizeof(CellCoord) + sizeof(void*));
        
        for (const auto& cell : grid) {
            estimate += cell.second.bucket_count() * sizeof(void*);
            estimate += cell.second.size() * sizeof(int);
        }
        
        estimate += objectData.bucket_count() * sizeof(void*);
        estimate += objectData.size() * (sizeof(int) + sizeof(ObjectInfo));
        
        estimate += tlsResultBuffer.capacity() * sizeof(int);
        estimate += tlsUniqueBuffer.bucket_count() * sizeof(void*);
        
        return estimate;
    }
    
    std::size_t getMaxObjectsPerCell() const {
        if (cachedStats.dirty) {
            updateCachedStats();
        }
        return cachedStats.maxObjectsPerCell;
    }
    
    double getAverageObjectsPerCell() const {
        if (cachedStats.dirty) {
            updateCachedStats();
        }
        return cachedStats.avgObjectsPerCell;
    }
};

// Thread-local definitions
thread_local std::vector<int> SpatialGrid::tlsResultBuffer;
thread_local std::unordered_set<int> SpatialGrid::tlsUniqueBuffer;

// Emscripten bindings
EMSCRIPTEN_BINDINGS(spatial_grid_module) {
    enum_<SpatialGrid::RadiusPrecision>("RadiusPrecision")
        .value("SQUARE", SpatialGrid::PRECISION_SQUARE)
        .value("CENTER", SpatialGrid::PRECISION_CENTER)
        .value("BOUNDS", SpatialGrid::PRECISION_BOUNDS);
    
    class_<SpatialGrid>("SpatialGrid")
        .constructor<int>()
        .function("addObject", &SpatialGrid::addObject)
        .function("removeObject", &SpatialGrid::removeObject)
        .function("updateObject", &SpatialGrid::updateObject)
        .function("getObjectsAt", &SpatialGrid::getObjectsAt)
        .function("getObjectsInRect", &SpatialGrid::getObjectsInRect)
        .function("getObjectsInRadius", &SpatialGrid::getObjectsInRadius)
        .function("updateObjectsBatch", &SpatialGrid::updateObjectsBatch)
        .function("clear", &SpatialGrid::clear)
        .function("getCellCount", &SpatialGrid::getCellCount)
        .function("getObjectCount", &SpatialGrid::getObjectCount)
        .function("getMemoryEstimate", &SpatialGrid::getMemoryEstimate)
        .function("getMaxObjectsPerCell", &SpatialGrid::getMaxObjectsPerCell)
        .function("getAverageObjectsPerCell", &SpatialGrid::getAverageObjectsPerCell);
    
    register_vector<int>("VectorInt");
}