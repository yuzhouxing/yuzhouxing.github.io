// 游戏主类
class Game {
    constructor() {
        this.player = null;
        this.map = null;
        this.ui = null;
        this.eventSystem = new EventSystem();
        this.isInitialized = false;
        
        // 将游戏实例挂载到window对象，便于其他模块访问
        window.game = this;
        
        this.init();
    }

    // 初始化游戏
    async init() {
        try {
            // 初始化玩家
            this.player = Player.load();
            
            // 初始化地图
            this.map = new GameMap();
            
            // 等待地图加载完成
            await new Promise(resolve => {
                this.eventSystem.on('mapLoaded', resolve);
            });
            
            // 如果玩家有保存的位置，移动到该位置
            if (this.player.location && this.map.getLocationById(this.player.location)) {
                this.map.moveTo(this.player.location);
            }
            
            // 初始化UI
            this.ui = new UI();
            
            // 标记游戏已初始化
            this.isInitialized = true;
            
            // 触发游戏初始化完成事件
            this.eventSystem.emit('gameInitialized', {
                player: this.player,
                map: this.map
            });
            
            console.log('武侠世界游戏初始化完成');
            
        } catch (error) {
            console.error('游戏初始化失败:', error);
        }
    }

    // 保存游戏
    save() {
        if (this.player) {
            // 保存玩家当前位置
            this.player.location = this.map.currentLocationId;
            
            // 保存玩家数据
            const saveData = this.player.save();
            
            // 触发保存事件
            this.eventSystem.emit('gameSaved', {
                saveData: saveData
            });
            
            return saveData;
        }
        return null;
    }

    // 开始新游戏
    startNewGame(playerData = {}) {
        this.player = new Player(playerData);
        this.map.moveTo('central');
        this.ui.updateLocationDisplay();
        this.ui.updatePlayerPanel();
        
        // 触发新游戏开始事件
        this.eventSystem.emit('newGameStarted', {
            player: this.player
        });
    }

    // 获取游戏状态
    getGameState() {
        return {
            player: this.player,
            currentLocation: this.map.getCurrentLocation(),
            isInitialized: this.isInitialized
        };
    }
}

// 游戏数据（可以在外部JSON文件中定义）
const GameData = {
    items: {
        'coin_001': {
            id: 'coin_001',
            name: '铜钱',
            type: 'currency',
            value: 1,
            description: '一枚普通的铜钱'
        },
        'herb_001': {
            id: 'herb_001',
            name: '止血草',
            type: 'consumable',
            value: 5,
            effect: {
                type: 'heal',
                amount: 20
            },
            description: '常见的止血草药，可以恢复少量生命值'
        },
        'wine_001': {
            id: 'wine_001',
            name: '醉仙酒',
            type: 'consumable',
            value: 10,
            effect: {
                type: 'restore_internal',
                amount: 15
            },
            description: '醉仙楼的招牌酒，可以恢复少量内力'
        }
    },
    skills: {
        'basic_sword': {
            id: 'basic_sword',
            name: '基础剑法',
            type: 'attack',
            level: 1,
            cost: 5,
            damage: 10,
            description: '最基础的剑法招式'
        },
        'internal_cultivation': {
            id: 'internal_cultivation',
            name: '基础内功',
            type: 'passive',
            level: 1,
            effect: {
                type: 'max_internal',
                amount: 10
            },
            description: '基础的内功修炼法门'
        }
    }
};

// 启动游戏
document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
});
