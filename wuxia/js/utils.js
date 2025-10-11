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
