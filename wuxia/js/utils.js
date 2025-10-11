// 工具函数
class Utils {
    // 生成随机数
    static random(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // 格式化文本
    static formatText(text, variables = {}) {
        let formattedText = text;
        for (const [key, value] of Object.entries(variables)) {
            formattedText = formattedText.replace(new RegExp(`{${key}}`, 'g'), value);
        }
        return formattedText;
    }

    // 从数组中随机选择一个元素
    static randomFromArray(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    // 检查对象是否为空
    static isEmpty(obj) {
        return Object.keys(obj).length === 0;
    }

    // 深拷贝对象
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // 保存到本地存储
    static saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('保存到本地存储失败:', e);
            return false;
        }
    }

    // 从本地存储加载
    static loadFromLocalStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('从本地存储加载失败:', e);
            return null;
        }
    }

    // 加载JSON数据
    static async loadJSON(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`加载JSON失败 (${url}):`, error);
            return null;
        }
    }

    // 加载游戏数据
    static async loadGameData() {
        const basePath = 'data/';
        const dataFiles = {
            locations: 'locations.json',
            items: 'items.json',
            characters: 'characters.json',
            skills: 'skills.json',
            quests: 'quests.json',
            config: 'config.json'
        };

        const loadedData = {};
        
        for (const [key, filename] of Object.entries(dataFiles)) {
            const data = await this.loadJSON(basePath + filename);
            if (data) {
                loadedData[key] = data;
                console.log(`成功加载 ${filename}`);
            } else {
                console.error(`加载 ${filename} 失败`);
                // 如果关键数据加载失败，使用默认数据
                if (key === 'locations') {
                    loadedData[key] = await this.getDefaultLocations();
                }
            }
        }

        return loadedData;
    }

    // 获取默认地点数据（备用）
    static async getDefaultLocations() {
        return {
            locations: {
                'central': {
                    id: 'central',
                    name: '襄阳城',
                    description: '你站在襄阳城的中央广场上，四周人来人往，商贩叫卖声不绝于耳。东边是繁华的市集，西边是威严的官府，南边通往城外，北边则是武林人士聚集的酒楼。',
                    type: 'city',
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
                            effect: {
                                type: 'heal',
                                amount: 20
                            }
                        },
                        {
                            id: 'observe_central',
                            name: '观察四周',
                            description: '仔细观察广场上的人们，或许能发现些什么。',
                            effect: {
                                type: 'random_event',
                                events: [
                                    '你注意到一个神秘的黑衣人匆匆走过。',
                                    '你听到几个江湖人士在讨论最近的武林大会。',
                                    '你发现地上有一枚铜钱，顺手捡了起来。',
                                    '你看到一位老者在广场中央练剑，剑法精妙。'
                                ]
                            }
                        }
                    ],
                    npcs: ['merchant_001', 'guard_001'],
                    items: ['coin_001'],
                    quests: ['quest_001'],
                    minLevel: 1
                },
                'tavern': {
                    id: 'tavern',
                    name: '醉仙楼',
                    description: '醉仙楼是襄阳城最有名的酒楼，各路武林人士在此饮酒论剑。你闻到阵阵酒香，听到江湖人士的高谈阔论。二楼似乎有几位高手在切磋武艺。',
                    type: 'tavern',
                    connections: {
                        south: 'central'
                    },
                    actions: [
                        {
                            id: 'drink_tavern',
                            name: '饮酒',
                            description: '点一壶好酒，慢慢品尝。',
                            effect: {
                                type: 'heal',
                                amount: 5
                            }
                        },
                        {
                            id: 'listen_tavern',
                            name: '偷听谈话',
                            description: '仔细聆听周围江湖人士的谈话，或许能获得一些情报。',
                            effect: {
                                type: 'random_event',
                                events: [
                                    '你听说城外最近有山贼出没。',
                                    '你听到有人在讨论一本失传的武功秘籍。',
                                    '你了解到最近官府正在招募江湖人士。',
                                    '你听说少林寺正在举办武林大会。'
                                ]
                            }
                        }
                    ],
                    npcs: ['tavern_keeper', 'wandering_swordsman'],
                    items: ['wine_001'],
                    quests: ['quest_002'],
                    minLevel: 1
                }
            }
        };
    }
}

// 事件系统
class EventSystem {
    constructor() {
        this.events = {};
    }

    // 监听事件
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    // 触发事件
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => callback(data));
        }
    }

    // 移除事件监听
    off(event, callback) {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        }
    }
}
