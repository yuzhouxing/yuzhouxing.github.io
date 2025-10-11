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
        if (!currentLocation) return;

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
            west: '西'
        };

        let navigationHTML = '';

        Object.entries(directions).forEach(([dir, name]) => {
            const targetLocationId = location.connections[dir];
            if (targetLocationId) {
                const targetLocation = this.game.map.getLocationById(targetLocationId);
                navigationHTML += `
                    <button class="nav-btn" data-direction="${dir}">
                        ${name}：${targetLocation.name}
                    </button>
                `;
            } else {
                navigationHTML += `
                    <button class="nav-btn" disabled>
                        ${name}：无路可通
                    </button>
                `;
            }
        });

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
            actionsElement.innerHTML = '';
        }
    }

    // 执行行动
    performAction(actionId) {
        const currentLocation = this.game.map.getCurrentLocation();
        const action = currentLocation.actions.find(a => a.id === actionId);
        
        if (action && action.effect) {
            const result = action.effect(this.game.player);
            
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

    // 更新物品栏显示
    updateInventoryDisplay() {
        const inventoryElement = document.getElementById('inventory-items');
        const player = this.game.player;
        
        if (player.inventory.length > 0) {
            let inventoryHTML = '';
            player.inventory.forEach(item => {
                inventoryHTML += `
                    <div class="inventory-item">
                        ${item.name || item.id}
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
                skillsHTML += `
                    <div class="skill-item">
                        ${skill.name || skill.id}
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
        // 在实际项目中，这里可以实现一个消息系统
        console.log(`[${type}] ${message}`);
        
        // 简单实现：在控制台显示消息
        // 可以扩展为在游戏界面显示消息框
        const messageElement = document.createElement('div');
        messageElement.className = `game-message ${type}`;
        messageElement.textContent = message;
        
        // 添加到页面（需要相应的CSS样式）
        document.body.appendChild(messageElement);
        
        // 3秒后移除
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 3000);
    }
}
