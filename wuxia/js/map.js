// 地图类
class GameMap {
    constructor() {
        this.locations = {};
        this.currentLocationId = null;
        this.gameData = null;
    }

    // 加载地点数据
    async loadLocations() {
        try {
            // 加载所有游戏数据
            this.gameData = await Utils.loadGameData();
            
            if (this.gameData && this.gameData.locations) {
                this.locations = this.gameData.locations.locations;
                
                // 如果没有当前地点，设置为第一个地点
                if (!this.currentLocationId && Object.keys(this.locations).length > 0) {
                    this.currentLocationId = Object.keys(this.locations)[0];
                }
                
                console.log('地图数据加载完成，地点数量:', Object.keys(this.locations).length);
                
                // 触发地图加载完成事件
                if (window.game && window.game.eventSystem) {
                    window.game.eventSystem.emit('mapLoaded', {
                        locations: this.locations
                    });
                }
            } else {
                throw new Error('无法加载地点数据');
            }
        } catch (error) {
            console.error('加载地点数据失败:', error);
            // 使用备用数据
            const defaultData = await Utils.getDefaultLocations();
            this.locations = defaultData.locations;
            this.currentLocationId = Object.keys(this.locations)[0];
            
            if (window.game && window.game.eventSystem) {
                window.game.eventSystem.emit('mapLoaded', {
                    locations: this.locations
                });
            }
        }
    }

    // 获取游戏数据
    getGameData() {
        return this.gameData;
    }

    // 获取物品数据
    getItem(itemId) {
        if (!this.gameData || !this.gameData.items) return null;
        
        // 在所有物品分类中查找
        const categories = Object.values(this.gameData.items.items);
        for (const category of categories) {
            if (category[itemId]) {
                return category[itemId];
            }
        }
        return null;
    }

    // 获取NPC数据
    getNPC(npcId) {
        if (!this.gameData || !this.gameData.characters) return null;
        return this.gameData.characters.npcs[npcId];
    }

    // 获取技能数据
    getSkill(skillId) {
        if (!this.gameData || !this.gameData.skills) return null;
        return this.gameData.skills.skills[skillId];
    }

    // 获取任务数据
    getQuest(questId) {
        if (!this.gameData || !this.gameData.quests) return null;
        return this.gameData.quests.quests[questId];
    }

    // 获取当前地点
    getCurrentLocation() {
        return this.locations[this.currentLocationId];
    }

    // 根据ID获取地点
    getLocationById(locationId) {
        return this.locations[locationId];
    }

    // 移动到指定地点
    moveTo(locationId) {
        if (this.locations[locationId]) {
            const previousLocation = this.currentLocationId;
            this.currentLocationId = locationId;
            
            // 触发移动事件
            if (window.game && window.game.eventSystem) {
                window.game.eventSystem.emit('playerMoved', {
                    from: previousLocation,
                    to: locationId,
                    location: this.getCurrentLocation()
                });
            }
            
            return true;
        }
        return false;
    }

    // 通过方向移动
    move(direction) {
        const currentLocation = this.getCurrentLocation();
        if (currentLocation && currentLocation.connections[direction]) {
            return this.moveTo(currentLocation.connections[direction]);
        }
        return false;
    }

    // 获取可移动的方向
    getAvailableDirections() {
        const currentLocation = this.getCurrentLocation();
        return currentLocation ? currentLocation.connections : {};
    }

    // 添加新地点
    addLocation(locationData) {
        this.locations[locationData.id] = locationData;
        
        // 触发地点添加事件
        if (window.game && window.game.eventSystem) {
            window.game.eventSystem.emit('locationAdded', {
                location: locationData
            });
        }
    }

    // 移除地点
    removeLocation(locationId) {
        if (this.locations[locationId]) {
            delete this.locations[locationId];
            
            // 如果移除的是当前地点，移动到第一个可用地点
            if (this.currentLocationId === locationId) {
                const firstLocation = Object.keys(this.locations)[0];
                if (firstLocation) {
                    this.moveTo(firstLocation);
                } else {
                    this.currentLocationId = null;
                }
            }
            
            // 触发地点移除事件
            if (window.game && window.game.eventSystem) {
                window.game.eventSystem.emit('locationRemoved', {
                    locationId: locationId
                });
            }
            
            return true;
        }
        return false;
    }

    // 获取所有地点
    getAllLocations() {
        return this.locations;
    }
}
