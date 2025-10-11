// UI控制类
class UI {
    constructor() {
        this.game = window.game;
        this.setupEventListeners();
    }

    // 设置事件监听
    setupEventListeners() {
        // 监听游戏事件
        if (this.game && this.game.eventSystem) {
            this.game.eventSystem.on('playerMoved', (data) => {
                this.updateLocationDisplay();
                this.updatePlayerPanel();
            });

            this.game.eventSystem.on('playerUpdated', (data) => {
                this.updatePlayerPanel();
            });

            this.game.eventSystem.on('mapLoaded', (data) => {
                this.updateLocationDisplay();
                this.updatePlayerPanel();
            });
        }
    }

    // 更新地点显示
    updateLocationDisplay() {
        const currentLocation = this.game.map.getCurrentLocation();
        if (!currentLocation) {
            document.getElementById('location-name').textContent = '未知地点';
            document.getElementById('location-description').textContent = '无法加载地点信息。';
            return;
        }

        // 更新地点名称和描述
        document.getElementById('location-name').textContent = currentLocation.name;
        document.getElementById('location-description').textContent = currentLocation.description;

        // 更新导航按钮
        this.updateNavigationButtons(currentLocation);

        // 更新地点行动
        this.updateLocationActions(currentLocation);
    }

    // 更新导航按钮
    updateNavigationButtons(location) {
        const navigationElement = document.getElementById('navigation');
        const directions = {
            north: '北',
            south: '南',
            east: '东',
            west: '西',
            up: '上',
            down: '下'
        };

        let navigationHTML = '';

        Object.entries(directions).forEach(([dir, name]) => {
            const targetLocationId = location.connections[dir];
            if (targetLocationId) {
                const targetLocation = this.game.map.getLocationById(targetLocationId);
                if (targetLocation) {
                    navigationHTML += `
                        <button class="nav-btn" data-direction="${dir}">
                            ${name}：${targetLocation.name}
                        </button>
                    `;
                }
            }
        });

        // 如果没有可用的方向，显示提示
        if (!navigationHTML) {
            navigationHTML = '<div style="text-align: center; color: #888; padding: 10px;">此路不通</div>';
        }

        navigationElement.innerHTML = navigationHTML;

        // 添加导航按钮事件监听
        document.querySelectorAll('.nav-btn[data-direction]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const direction = e.target.getAttribute('data-direction');
                this.game.map.move(direction);
            });
        });
    }

    // 更新地点行动
    updateLocationActions(location) {
        const actionsElement = document.getElementById('location-actions');
        
        if (location.actions && location.actions.length > 0) {
            let actionsHTML = '';
            
            location.actions.forEach(action => {
                actionsHTML += `
                    <button class="action-btn" data-action="${action.id}">
                        ${action.name}
                    </button>
                `;
            });
            
            actionsElement.innerHTML = actionsHTML;

            // 添加行动按钮事件监听
            document.querySelectorAll('.action-btn[data-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const actionId = e.target.getAttribute('data-action');
                    this.performAction(actionId);
                });
            });
        } else {
            actionsElement.innerHTML = '<div style="text-align: center; color: #888; padding: 10px;">此处暂无特殊行动</div>';
        }
    }

    // 执行行动（数据驱动版本）
    performAction(actionId) {
        const currentLocation = this.game.map.getCurrentLocation();
        const action = currentLocation.actions.find(a => a.id === actionId);
        
        if (!action) {
            console.warn(`行动 ${actionId} 不存在`);
            return;
        }

        let result = '';
        
        // 根据行动效果类型处理
        if (action.effect) {
            switch (action.effect.type) {
                case 'heal':
                    this.game.player.heal(action.effect.amount);
                    result = `你休息了一会儿，恢复了 ${action.effect.amount} 点生命值。`;
                    break;
                case 'gain_exp':
                    this.game.player.addExp(action.effect.amount);
                    result = `你通过练习获得了 ${action.effect.amount} 点经验值。`;
                    break;
                case 'random_event':
                    result = Utils.randomFromArray(action.effect.events);
                    break;
                case 'fixed_event':
                    result = action.effect.message;
                    break;
                case 'random_item':
                    const randomItem = this.getRandomItem(action.effect.items);
                    if (randomItem) {
                        this.game.player.addItem(randomItem);
                        const itemData = this.game.map.getItem(randomItem);
                        result = `你找到了：${itemData ? itemData.name : randomItem}`;
                    } else {
                        result = '你仔细寻找了一番，但什么都没有找到。';
                    }
                    break;
                case 'add_item':
                    this.game.player.addItem(action.effect.item);
                    const addedItemData = this.game.map.getItem(action.effect.item);
                    result = `你获得了：${addedItemData ? addedItemData.name : action.effect.item}`;
                    break;
                default:
                    result = '你完成了这个行动。';
            }
        } else {
            result = '你完成了这个行动。';
        }

        // 显示行动结果
        this.showMessage(result);
        
        // 更新玩家面板
        this.updatePlayerPanel();
        
        // 触发行动完成事件
        if (this.game && this.game.eventSystem) {
            this.game.eventSystem.emit('actionPerformed', {
                action: action,
                result: result,
                player: this.game.player
            });
        }
    }

    // 辅助方法：根据概率获取随机物品
    getRandomItem(itemConfigs) {
        const totalChance = itemConfigs.reduce((sum, config) => sum + config.chance, 0);
        const random = Math.random() * totalChance;
        
        let currentChance = 0;
        for (const config of itemConfigs) {
            currentChance += config.chance;
            if (random <= currentChance) {
                return config.id;
            }
        }
        
        return null;
    }

    // 更新玩家面板
    updatePlayerPanel() {
        const player = this.game.player;
        
        // 更新基础状态
        let statsHTML = `
            <div class="stat">
                <span class="stat-name">姓名:</span>
                <span class="stat-value">${player.name}</span>
            </div>
            <div class="stat">
                <span class="stat-name">境界:</span>
                <span class="stat-value">${player.level}级</span>
            </div>
            <div class="stat">
                <span class="stat-name">经验:</span>
                <span class="stat-value">${player.exp}/${player.expToNextLevel}</span>
            </div>
            <div class="stat">
                <span class="stat-name">血量:</span>
                <span class="stat-value">${player.health.current}/${player.health.max}</span>
                <div class="stat-bar-container">
                    <div class="stat-bar health-bar" style="width: ${(player.health.current / player.health.max) * 100}%"></div>
                </div>
            </div>
            <div class="stat">
                <span class="stat-name">内力:</span>
                <span class="stat-value">${player.internal.current}/${player.internal.max}</span>
                <div class="stat-bar-container">
                    <div class="stat-bar internal-bar" style="width: ${(player.internal.current / player.internal.max) * 100}%"></div>
                </div>
            </div>
            <div class="stat">
                <span class="stat-name">攻击:</span>
                <span class="stat-value">${player.getTotalAttack()}</span>
            </div>
            <div class="stat">
                <span class="stat-name">防御:</span>
                <span class="stat-value">${player.getTotalDefense()}</span>
            </div>
            <div class="stat">
                <span class="stat-name">悟性:</span>
                <span class="stat-value">${player.wisdom}</span>
            </div>
            <div class="stat">
                <span class="stat-name">轻功:</span>
                <span class="stat-value">${player.agility}</span>
            </div>
            <div class="stat">
                <span class="stat-name">福缘:</span>
                <span class="stat-value">${player.luck}</span>
            </div>
        `;
        
        document.getElementById('player-stats').innerHTML = statsHTML;
        
        // 更新物品栏
        this.updateInventoryDisplay();
        
        // 更新技能列表
        this.updateSkillsDisplay();
    }

    // 更新物品栏显示（支持堆叠）
    updateInventoryDisplay() {
        const inventoryElement = document.getElementById('inventory-items');
        const player = this.game.player;
        
        if (player.inventory.length > 0) {
            let inventoryHTML = '';
            player.inventory.forEach(item => {
                const itemData = this.game.map.getItem(item.id);
                const displayName = itemData ? itemData.name : item.id;
                const countText = item.count > 1 ? ` x${item.count}` : '';
                inventoryHTML += `
                    <div class="inventory-item">
                        ${displayName}${countText}
                    </div>
                `;
            });
            inventoryElement.innerHTML = inventoryHTML;
        } else {
            inventoryElement.innerHTML = '<div class="empty-inventory">空空如也</div>';
        }
    }

    // 更新技能显示
    updateSkillsDisplay() {
        const skillsElement = document.getElementById('skills-list');
        const player = this.game.player;
        
        if (player.skills.length > 0) {
            let skillsHTML = '';
            player.skills.forEach(skill => {
                const skillData = this.game.map.getSkill(skill.id);
                const displayName = skillData ? skillData.name : skill.id;
                skillsHTML += `
                    <div class="skill-item">
                        ${displayName}
                    </div>
                `;
            });
            skillsElement.innerHTML = skillsHTML;
        } else {
            skillsElement.innerHTML = '<div class="empty-skills">尚未习得任何武学</div>';
        }
    }

    // 显示消息
    showMessage(message, type = 'info') {
        // 简单实现：在控制台显示消息
        console.log(`[${type}] ${message}`);
        
        // 在实际项目中，这里可以实现一个消息系统
        // 临时在页面顶部显示消息
        const messageElement = document.createElement('div');
        messageElement.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(139, 35, 35, 0.9);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            max-width: 80%;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        messageElement.textContent = message;
        
        document.body.appendChild(messageElement);
        
        // 3秒后移除
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 3000);
    }
}
