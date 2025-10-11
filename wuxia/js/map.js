// 地图类
class GameMap {
    constructor() {
        this.locations = {};
        this.currentLocationId = null;
        this.loadLocations();
    }

    // 加载地点数据
    async loadLocations() {
        try {
            // 这里可以改为从服务器加载
            const locationsData = await this.getDefaultLocations();
            this.locations = locationsData;
            
            // 如果没有当前地点，设置为第一个地点
            if (!this.currentLocationId && Object.keys(this.locations).length > 0) {
                this.currentLocationId = Object.keys(this.locations)[0];
            }
            
            // 触发地图加载完成事件
            if (window.game && window.game.eventSystem) {
                window.game.eventSystem.emit('mapLoaded', {
                    locations: this.locations
                });
            }
        } catch (error) {
            console.error('加载地点数据失败:', error);
        }
    }

    // 获取默认地点数据
    async getDefaultLocations() {
        // 在实际项目中，这里应该从服务器加载JSON数据
        return {
            'central': {
                id: 'central',
                name: '襄阳城',
                description: '你站在襄阳城的中央广场上，四周人来人往，商贩叫卖声不绝于耳。东边是繁华的市集，西边是威严的官府，南边通往城外，北边则是武林人士聚集的酒楼。',
                connections: {
                    north: 'tavern',
                    south: 'outskirts',
                    east: 'market',
                    west: 'government'
                },
                actions: [
                    {
                        id: 'rest_central',
                        name: '休息片刻',
                        description: '在广场边的石凳上休息，恢复一些体力和内力。',
                        effect: (player) => {
                            player.heal(20);
                            player.restoreInternal(10);
                            return '你休息了片刻，感觉精神焕发。';
                        }
                    },
                    {
                        id: 'observe_central',
                        name: '观察四周',
                        description: '仔细观察广场上的人们，或许能发现些什么。',
                        effect: (player) => {
                            const observations = [
                                '你注意到一个神秘的黑衣人匆匆走过。',
                                '你听到几个江湖人士在讨论最近的武林大会。',
                                '你发现地上有一枚铜钱，顺手捡了起来。'
                            ];
                            return Utils.randomFromArray(observations);
                        }
                    }
                ],
                npcs: ['merchant_001', 'guard_001'],
                items: ['coin_001']
            },
            'tavern': {
                id: 'tavern',
                name: '醉仙楼',
                description: '醉仙楼是襄阳城最有名的酒楼，各路武林人士在此饮酒论剑。你闻到阵阵酒香，听到江湖人士的高谈阔论。二楼似乎有几位高手在切磋武艺。',
                connections: {
                    south: 'central'
                },
                actions: [
                    {
                        id: 'drink_tavern',
                        name: '饮酒',
                        description: '点一壶好酒，慢慢品尝。',
                        effect: (player) => {
                            player.heal(5);
                            return '你喝了一壶酒，感觉心情舒畅。';
                        }
                    },
                    {
                        id: 'listen_tavern',
                        name: '偷听谈话',
                        description: '仔细聆听周围江湖人士的谈话，或许能获得一些情报。',
                        effect: (player) => {
                            const rumors = [
                                '你听说城外最近有山贼出没。',
                                '你听到有人在讨论一本失传的武功秘籍。',
                                '你了解到最近官府正在招募江湖人士。'
                            ];
                            return Utils.randomFromArray(rumors);
                        }
                    }
                ],
                npcs: ['tavern_keeper', 'wandering_swordsman'],
                items: ['wine_001']
            },
            'market': {
                id: 'market',
                name: '市集',
                description: '这里是襄阳城最繁华的市集，各种商品琳琅满目。你看到有卖兵器、药材、书籍的摊位，还有几个江湖艺人在表演杂技。',
                connections: {
                    west: 'central'
                },
                actions: [
                    {
                        id: 'browse_market',
                        name: '逛摊位',
                        description: '在各个摊位间逛逛，看看有什么好东西。',
                        effect: (player) => {
                            const finds = [
                                '你在一个旧书摊发现了一本基础内功心法。',
                                '你看到一个兵器摊上有把不错的铁剑。',
                                '你在药材摊前驻足，老板向你推荐了一些疗伤药。'
                            ];
                            return Utils.randomFromArray(finds);
                        }
                    }
                ],
                npcs: ['weapon_merchant', 'herb_merchant', 'book_merchant'],
                items: ['herb_001', 'book_001']
            },
            'government': {
                id: 'government',
                name: '官府',
                description: '威严的官府门前站着两名持刀守卫。这里通常是处理公务和发布悬赏的地方，偶尔也会有江湖通缉令张贴在公告栏上。',
                connections: {
                    east: 'central'
                },
                actions: [
                    {
                        id: 'read_notice',
                        name: '查看公告',
                        description: '查看官府门口的公告栏，了解最新的通缉令和悬赏。',
                        effect: (player) => {
                            return '公告栏上贴着一张通缉令：悬赏捉拿江洋大盗"黑风煞"，赏金100两白银。';
                        }
                    }
                ],
                npcs: ['guard_001', 'guard_002', 'official_001'],
                items: []
            },
            'outskirts': {
                id: 'outskirts',
                name: '城外',
                description: '你来到了襄阳城外，眼前是一片开阔的田野和远处的群山。这里空气清新，偶尔能看到一些农夫和旅人。远处似乎有一条小路通往深山。',
                connections: {
                    north: 'central',
                    east: 'forest',
                    west: 'village'
                },
                actions: [
                    {
                        id: 'train_outskirts',
                        name: '练习武功',
                        description: '在空旷的地方练习武功，提升自己的实力。',
                        effect: (player) => {
                            player.addExp(10);
                            return '你认真练习武功，感觉有所进步。';
                        }
                    }
                ],
                npcs: ['farmer_001', 'traveler_001'],
                items: ['herb_002']
            }
        };
    }

    // 获取当前地点
    getCurrentLocation() {
        return this.locations[this.currentLocationId];
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

    // 根据ID获取地点
    getLocationById(locationId) {
        return this.locations[locationId];
    }
}
