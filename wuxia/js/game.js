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
            console.log('开始初始化游戏...');
            
            // 显示加载状态
            document.getElementById('location-name').textContent = '加载中...';
            document.getElementById('location-description').textContent = '正在加载游戏数据，请稍候...';

            // 初始化地图（会加载数据）
            this.map = new GameMap();
            
            // 等待地图数据加载完成
            await this.map.loadLocations();
            
            // 初始化玩家
            this.player = Player.load();
            
            // 如果玩家有保存的位置，移动到该位置
            if (this.player.location && this.map.getLocationById(this.player.location)) {
                this.map.moveTo(this.player.location);
            } else {
                // 否则移动到默认位置
                this.map.moveTo('central');
            }
            
            // 初始化UI
            this.ui = new UI();
            
            // 标记游戏已初始化
            this.isInitialized = true;
            
            console.log('武侠世界游戏初始化完成');
            
            // 触发游戏初始化完成事件
            this.eventSystem.emit('gameInitialized', {
                player: this.player,
                map: this.map
            });
            
        } catch (error) {
            console.error('游戏初始化失败:', error);
            // 显示错误信息
            document.getElementById('location-name').textContent = '加载失败';
            document.getElementById('location-description').textContent = '游戏数据加载失败，请刷新页面重试。错误信息：' + error.message;
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

// 启动游戏
document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
});
