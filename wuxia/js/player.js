// 玩家类
class Player {
    constructor(data = {}) {
        this.id = data.id || 'player_001';
        this.name = data.name || '无名侠客';
        this.level = data.level || 1;
        this.exp = data.exp || 0;
        this.expToNextLevel = data.expToNextLevel || this.calculateExpToNextLevel();
        
        // 基础属性
        this.health = data.health || { current: 100, max: 100 };
        this.internal = data.internal || { current: 50, max: 50 };
        this.attack = data.attack || 15;
        this.defense = data.defense || 10;
        this.wisdom = data.wisdom || 12;
        this.agility = data.agility || 8;
        this.luck = data.luck || 5;
        
        // 装备
        this.equipment = data.equipment || {
            weapon: null,
            armor: null,
            accessory: null
        };
        
        // 物品栏
        this.inventory = data.inventory || [];
        
        // 技能
        this.skills = data.skills || [];
        
        // 状态效果
        this.statusEffects = data.statusEffects || [];
        
        // 位置
        this.location = data.location || 'central';
        
        // 任务
        this.quests = data.quests || [];
        
        // 关系
        this.relationships = data.relationships || {};
    }

    // 计算升级所需经验
    calculateExpToNextLevel() {
        return this.level * 100 + 50;
    }

    // 增加经验
    addExp(amount) {
        this.exp += amount;
        while (this.exp >= this.expToNextLevel) {
            this.levelUp();
        }
    }

    // 升级
    levelUp() {
        this.level++;
        this.exp -= this.expToNextLevel;
        this.expToNextLevel = this.calculateExpToNextLevel();
        
        // 提升属性
        this.health.max += 10;
        this.internal.max += 5;
        this.attack += 2;
        this.defense += 1;
        this.wisdom += 1;
        this.agility += 1;
        
        // 恢复状态
        this.health.current = this.health.max;
        this.internal.current = this.internal.max;
        
        // 触发升级事件
        if (window.game && window.game.eventSystem) {
            window.game.eventSystem.emit('playerLevelUp', {
                level: this.level,
                player: this
            });
        }
        
        return this.level;
    }

    // 治疗
    heal(amount) {
        this.health.current = Math.min(this.health.current + amount, this.health.max);
    }

    // 恢复内力
    restoreInternal(amount) {
        this.internal.current = Math.min(this.internal.current + amount, this.internal.max);
    }

    // 受到伤害
    takeDamage(amount) {
        this.health.current = Math.max(this.health.current - amount, 0);
        return this.health.current > 0;
    }

    // 消耗内力
    consumeInternal(amount) {
        this.internal.current = Math.max(this.internal.current - amount, 0);
        return this.internal.current >= amount;
    }

    // 添加物品（数据驱动版本）
    addItem(itemId) {
        const gameData = window.game?.map?.getGameData();
        if (!gameData) {
            console.warn('游戏数据未加载，无法添加物品');
            return false;
        }

        const itemData = window.game.map.getItem(itemId);
        if (!itemData) {
            console.warn(`物品 ${itemId} 不存在`);
            return false;
        }

        // 检查是否可堆叠
        if (itemData.stackable) {
            const existingItem = this.inventory.find(item => item.id === itemId);
            if (existingItem && existingItem.count < (itemData.maxStack || 999)) {
                existingItem.count++;
            } else {
                this.inventory.push({
                    ...itemData,
                    count: 1
                });
            }
        } else {
            this.inventory.push({
                ...itemData,
                count: 1
            });
        }

        if (window.game && window.game.eventSystem) {
            window.game.eventSystem.emit('playerItemAdded', {
                item: itemData,
                player: this
            });
        }

        return true;
    }

    // 移除物品
    removeItem(itemId) {
        const index = this.inventory.findIndex(item => item.id === itemId);
        if (index !== -1) {
            const removedItem = this.inventory.splice(index, 1)[0];
            
            if (window.game && window.game.eventSystem) {
                window.game.eventSystem.emit('playerItemRemoved', {
                    item: removedItem,
                    player: this
                });
            }
            
            return removedItem;
        }
        return null;
    }

    // 学习技能（数据驱动版本）
    learnSkill(skillId) {
        const gameData = window.game?.map?.getGameData();
        if (!gameData) {
            console.warn('游戏数据未加载，无法学习技能');
            return false;
        }

        const skillData = window.game.map.getSkill(skillId);
        if (!skillData) {
            console.warn(`技能 ${skillId} 不存在`);
            return false;
        }

        // 检查是否已学习
        if (!this.skills.find(s => s.id === skillId)) {
            this.skills.push(skillData);
            
            if (window.game && window.game.eventSystem) {
                window.game.eventSystem.emit('playerSkillLearned', {
                    skill: skillData,
                    player: this
                });
            }
            
            return true;
        }
        return false;
    }

    // 使用物品
    useItem(itemId) {
        const itemIndex = this.inventory.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return false;

        const item = this.inventory[itemIndex];
        const itemData = window.game.map.getItem(itemId);
        
        if (!itemData || !itemData.effect) return false;

        // 应用物品效果
        let success = false;
        switch (itemData.effect.type) {
            case 'heal':
                this.heal(itemData.effect.amount);
                success = true;
                break;
            case 'restore_internal':
                this.restoreInternal(itemData.effect.amount);
                success = true;
                break;
            case 'learn_skill':
                success = this.learnSkill(itemData.effect.skill);
                break;
            case 'full_restore':
                this.health.current = this.health.max;
                this.internal.current = this.internal.max;
                success = true;
                break;
        }

        if (success) {
            // 减少物品数量或移除
            if (item.count > 1) {
                item.count--;
            } else {
                this.inventory.splice(itemIndex, 1);
            }
        }

        return success;
    }

    // 装备物品
    equipItem(item) {
        if (item.type === 'weapon') {
            if (this.equipment.weapon) {
                this.inventory.push(this.equipment.weapon);
            }
            this.equipment.weapon = item;
            this.applyEquipmentStats(item);
        } else if (item.type === 'armor') {
            if (this.equipment.armor) {
                this.inventory.push(this.equipment.armor);
            }
            this.equipment.armor = item;
            this.applyEquipmentStats(item);
        } else if (item.type === 'accessory') {
            if (this.equipment.accessory) {
                this.inventory.push(this.equipment.accessory);
            }
            this.equipment.accessory = item;
            this.applyEquipmentStats(item);
        }
        
        // 从物品栏移除
        this.removeItem(item.id);
        
        if (window.game && window.game.eventSystem) {
            window.game.eventSystem.emit('playerItemEquipped', {
                item: item,
                player: this
            });
        }
    }

    // 应用装备属性
    applyEquipmentStats(item) {
        if (item.stats) {
            Object.keys(item.stats).forEach(stat => {
                if (this[stat] !== undefined) {
                    this[stat] += item.stats[stat];
                }
            });
        }
    }

    // 获取总攻击力（基础+装备）
    getTotalAttack() {
        let total = this.attack;
        Object.values(this.equipment).forEach(item => {
            if (item && item.stats && item.stats.attack) {
                total += item.stats.attack;
            }
        });
        return total;
    }

    // 获取总防御力（基础+装备）
    getTotalDefense() {
        let total = this.defense;
        Object.values(this.equipment).forEach(item => {
            if (item && item.stats && item.stats.defense) {
                total += item.stats.defense;
            }
        });
        return total;
    }

    // 保存玩家数据
    save() {
        const saveData = {
            id: this.id,
            name: this.name,
            level: this.level,
            exp: this.exp,
            expToNextLevel: this.expToNextLevel,
            health: this.health,
            internal: this.internal,
            attack: this.attack,
            defense: this.defense,
            wisdom: this.wisdom,
            agility: this.agility,
            luck: this.luck,
            equipment: this.equipment,
            inventory: this.inventory,
            skills: this.skills,
            statusEffects: this.statusEffects,
            location: this.location,
            quests: this.quests,
            relationships: this.relationships
        };
        
        Utils.saveToLocalStorage('wuxia_player_data', saveData);
        return saveData;
    }

    // 加载玩家数据
    static load() {
        const savedData = Utils.loadFromLocalStorage('wuxia_player_data');
        return savedData ? new Player(savedData) : new Player();
    }
}
