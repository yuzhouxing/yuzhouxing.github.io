// 配置
const SUPABASE_URL = 'https://pwluzvlyglcfdparnavw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3bHV6dmx5Z2xjZmRwYXJuYXZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4OTUzNDIsImV4cCI6MjA3NDQ3MTM0Mn0.9eF5KQsiRrsun8wD3EZ5SAAmLtY3FO6byJhivT_Vxys';
const COMMUNITY_ID = 4353;
const MAX_PAGES = 25;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_LIKES = 5;
const ESSENCE_BONUS = 25;
const RECENT_DAYS = 10;
const UPDATE_INTERVAL = 300 * 1000; // 1分钟更新一次
const VERCEL_PROXY_URL = "https://yuzhouxing-yaquan.vercel.app/api/proxy";
// 代理服务列表
// 更新代理服务列表（使用更稳定的服务）
const PROXY_SERVICES = [
    { name: 'CorsProxy', url: 'https://corsproxy.cn/?' },
    { name: 'AllOrigins', url: 'https://api.allorigins.win/raw?url=' },
    { name: 'MyProxy', url: 'https://yuzhouxing-yaquan-proxy.vercel.app/api/proxy?url=' }
];

// 特色标签配置
const TAG_CONFIG = {
    // 发帖数量相关
    POST_COUNT: {
        '更帖达人': { threshold: 15, description: '发帖数量超过15篇' },
        '高产作者': { threshold: 10, description: '发帖数量超过10篇' },
        '灵感之源': { threshold: 5, description: '发帖数量超过5篇' }
    },
    // 精华帖相关
    ESSENCE: {
        '精华大师': { threshold: 3, description: '精华帖数量超过3篇' },
        '宝藏作者': { threshold: 2, description: '精华帖数量超过2篇' },
        '发光写手': { threshold: 1, description: '拥有至少1篇精华帖' }
    },
    // 点赞相关
    LIKES: {
        '爆款作者': { threshold: 150, description: '总点赞数超过160' },
        '热门作者': { threshold: 90, description: '总点赞数超过90' },
        '优秀作者': { threshold: 40, description: '总点赞数超过40' }
    },
    // 平均点赞相关
    AVG_LIKES: {
        '质量标杆': { threshold: 36, description: '平均每帖点赞超过30' },
        '内容优质': { threshold: 24, description: '平均每帖点赞超过20' },
        '互动良好': { threshold: 12, description: '平均每帖点赞超过10' }
    },
    // 近期活跃
    RECENT_ACTIVE: {
        '闪耀新星': { threshold: 3, description: '最近7天内有发帖' },
        '活跃作家': { threshold: 5, description: '最近3天内有发帖' }
    },
    
    // 特殊成就
    SPECIAL: {
        '稳定输出': { condition: (user) => user.postCount >= 5 && user.minLikes >= 15 },
        '人气之王': { condition: (user) => user.totalLikes >= 200 },
        '一帖傲群': { condition: (user) => user.maxLikes >= 50 }
    }
};

class HistoricalRanking {
    constructor() {
        this.tableName = 'historical_rankings';
    }

    async saveHistoricalData(currentData) {
        try {
            const historicalData = await this.getHistoricalData();
            const mergedData = this.mergeHistoricalData(historicalData, currentData);
            
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${this.tableName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    data: JSON.stringify(mergedData.slice(0, 50)),
                    updated_at: new Date().toISOString()
                })
            });
            
            if (response.ok) {
                console.log('历史数据保存成功');
            }
        } catch (error) {
            console.error('保存历史数据出错:', error);
        }
    }

    async getHistoricalData() {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${this.tableName}?select=*&order=updated_at.desc&limit=1`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    return JSON.parse(data[0].data);
                }
            }
            return [];
        } catch (error) {
            console.error('获取历史数据出错:', error);
            return [];
        }
    }

    mergeHistoricalData(historicalData, currentData) {
        const userMap = new Map();
        
        historicalData.forEach(user => {
            userMap.set(user.name, { ...user });
        });
        
        currentData.forEach(user => {
            const existingUser = userMap.get(user.name);
            if (!existingUser || user.score > existingUser.score) {
                userMap.set(user.name, { ...user });
            }
        });
        
        return Array.from(userMap.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 50);
    }
}

const historicalRanking = new HistoricalRanking();

// 全局变量
let userScoreData = {};
let globalStats = {
    totalPosts: 0,
    qualifiedPosts: 0,
    avgLikes: 0,
    totalLikes: 0
};
let currentProxyIndex = 0;
let updateTimer = null;
let nextUpdateTime = Date.now() + UPDATE_INTERVAL;
let isUpdating = false;

// DOM元素
let topUserEl, totalUsersEl, totalPostsEl, lastUpdateEl;
let updateTimerEl, dataTableBody, updateIndicator;

// 初始化DOM元素
function initDOMElements() {
    topUserEl = document.getElementById('topUser');
    totalUsersEl = document.getElementById('totalUsers');
    totalPostsEl = document.getElementById('totalPosts');
    lastUpdateEl = document.getElementById('lastUpdate');
    updateTimerEl = document.getElementById('updateTimer');
    dataTableBody = document.querySelector('#dataTable tbody');
    updateIndicator = document.getElementById('updateIndicator');
}

// 初始化图表
function initCharts() {
    const userRankChart = echarts.init(document.getElementById('userRankChart'));
    const scoreDistributionChart = echarts.init(document.getElementById('scoreDistributionChart'));

    // 排行榜图表
    userRankChart.setOption({
        title: { 
            text: '',
            left: 'center',
            textStyle: { color: '#2d3748', fontSize: 16 }
        },
        tooltip: { 
            trigger: 'axis',
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderColor: '#e2e8f0',
            textStyle: { color: '#2d3748' },
            formatter: function(params) {
                const data = params[0];
                return `<div style="font-weight:600;margin-bottom:8px;">${data.name}</div>
                        <div>综合积分: <b>${data.value}</b></div>
                        <div>排名: <b>#${params[0].dataIndex + 1}</b></div>`;
            }
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { 
            type: 'value', 
            name: '综合积分',
            nameTextStyle: { color: '#718096' },
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#718096' }
        },
        yAxis: {
            type: 'category',
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { 
                color: '#4a5568',
                fontSize: 12
            }
        },
        series: [{
            name: '综合积分',
            type: 'bar',
            data: [],
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                    { offset: 0, color: '#667eea' },
                    { offset: 1, color: '#764ba2' }
                ]),
                borderRadius: [0, 4, 4, 0]
            },
            barWidth: 20
        }]
    });

    // 积分分布图表
    scoreDistributionChart.setOption({
        title: { 
            text: '',
            left: 'center',
            textStyle: { color: '#2d3748', fontSize: 16 }
        },
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderColor: '#e2e8f0',
            textStyle: { color: '#2d3748' },
            formatter: '{a} <br/>{b}: {c}分 ({d}%)'
        },
        legend: {
            orient: 'vertical',
            left: 'left',
            textStyle: { color: '#4a5568' }
        },
        series: [{
            name: '积分构成',
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 10,
                borderColor: '#fff',
                borderWidth: 2
            },
            label: {
                show: false,
                position: 'center'
            },
            emphasis: {
                label: { show: true, fontSize: 16, fontWeight: 'bold' }
            },
            labelLine: { show: false },
            data: []
        }]
    });

    return { userRankChart, scoreDistributionChart };
}

let charts = initCharts();

// 计算用户特色标签
function calculateUserTags(user) {
    const tags = [];
    const now = Date.now();
    const twoDaysAgo = now - 1 * 24 * 60 * 60 * 1000;
    const oneDaysAgo = now - 1 * 12 * 60 * 60 * 1000;
    const avgLikes = user.postCount > 0 ? user.totalLikes / user.postCount : 0;

    // 发帖数量标签
    for (const [tag, config] of Object.entries(TAG_CONFIG.POST_COUNT)) {
        if (user.postCount >= config.threshold) {
            tags.push(tag);
            break; // 只取最高级别的标签
        }
    }

    // 精华帖标签
    for (const [tag, config] of Object.entries(TAG_CONFIG.ESSENCE)) {
        if (user.essenceCount >= config.threshold) {
            tags.push(tag);
            break;
        }
    }

    // 总点赞数标签
    for (const [tag, config] of Object.entries(TAG_CONFIG.LIKES)) {
        if (user.totalLikes >= config.threshold) {
            tags.push(tag);
            break;
        }
    }

    // 平均点赞标签
    for (const [tag, config] of Object.entries(TAG_CONFIG.AVG_LIKES)) {
        if (avgLikes >= config.threshold) {
            tags.push(tag);
            break;
        }
    }

    // 近期活跃标签
    if (user.lastPostTime >= oneDaysAgo) {
        tags.push('闪耀新星');
    }
    else if (user.lastPostTime >= twoDaysAgo) {
        tags.push('活跃作家');
    }

    // 特殊成就标签
    for (const [tag, config] of Object.entries(TAG_CONFIG.SPECIAL)) {
        if (config.condition(user)) {
            tags.push(tag);
        }
    }

    // 确保标签唯一性并限制数量
    return [...new Set(tags)].slice(0, 3); // 最多显示3个标签
}

// 获取标签样式
// 获取标签样式
// 获取标签样式
function getTagStyle(tag) {
    // 定义精美的颜色方案
    const colorScheme = {
        // 浅紫色 - 最高级别（优雅、尊贵）
        '最高级': { 
            bg: 'linear-gradient(135deg, #f9f0ff 0%, #efdbff 100%)', 
            color: '#722ed1', 
            border: '#d3adf7',
            shadow: '0 2px 4px rgba(114, 46, 209, 0.2)'
        },
        // 黄色 - 次高级别（明亮、积极）
        '次高级': { 
            bg: 'linear-gradient(135deg, #feffe6 0%, #ffffb8 100%)', 
            color: '#ad8b00', 
            border: '#ffe58f',
            shadow: '0 2px 4px rgba(250, 173, 20, 0.2)'
        },
        // 绿色 - 基础级别（清新、成长）  
        '基础级': { 
            bg: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)', 
            color: '#389e0d', 
            border: '#b7eb8f',
            shadow: '0 2px 4px rgba(82, 196, 26, 0.2)'
        },
        // 红色 - 特殊成就（突出、重要）
        '特殊级': { 
            bg: 'linear-gradient(135deg, #fff2e8 0%, #ffbb96 100%)', 
            color: '#cf1322', 
            border: '#ffa39e',
            shadow: '0 2px 4px rgba(245, 34, 45, 0.2)'
        }
    };

    // 标签级别映射
    const tagLevels = {
        // 发帖数量类
        '更帖达人': '最高级',
        '高产作者': '次高级', 
        '灵感之源': '基础级',
        
        // 精华帖类
        '精华大师': '最高级',
        '宝藏作者': '次高级',
        '发光写手': '基础级',
        
        // 点赞总数类
        '爆款作者': '最高级',
        '热门作者': '次高级',
        '优秀作者': '基础级',
        
        // 平均点赞类
        '质量标杆': '最高级',
        '内容优质': '次高级',
        '互动良好': '基础级',
        
        // 近期活跃类
        '闪耀新星': '次高级',
        '活跃作家': '基础级',
        
        // 特殊成就类
        '人气之王': '特殊级',
        '稳定输出': '特殊级',
        '一帖傲群': '特殊级'
    };

    const level = tagLevels[tag] || '基础级';
    return colorScheme[level];
}

// 显示更新指示器
function showUpdateIndicator() {
    if (updateIndicator) {
        updateIndicator.style.display = 'inline-block';
        updateIndicator.textContent = '🔄 更新中...';
    }
}

// 隐藏更新指示器
function hideUpdateIndicator() {
    if (updateIndicator) {
        updateIndicator.style.display = 'none';
    }
}

// 显示轻微提示
function showSubtleNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(255,255,255,0.95);
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border-left: 4px solid #48bb78;
        z-index: 1000;
        font-size: 14px;
        color: #2d3748;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// 更新倒计时显示
function updateCountdown() {
    const now = Date.now();
    const secondsLeft = Math.max(0, Math.round((nextUpdateTime - now) / 1000));
    
    if (updateTimerEl) {
        updateTimerEl.textContent = `${secondsLeft}秒后更新`;
    }
    
    if (secondsLeft === 0 && !isUpdating) {
        nextUpdateTime = now + UPDATE_INTERVAL;
        fetchAllPosts();
    }
}

// 启动定时器
function startUpdateTimer() {
    if (updateTimer) clearInterval(updateTimer);
    updateTimer = setInterval(updateCountdown, 1000);
    updateCountdown(); // 立即更新一次
}

// 计算质量系数
function calculateQualityCoefficient(likes, avgLikes) {
    if (avgLikes <= 0 || likes <= 0) return 1;
    return 1 + Math.pow(likes / avgLikes, 0.5) * 0.5;
}

// 计算时间系数
function calculateTimeCoefficient(createdTime) {
    const now = Date.now();
    const daysDiff = (now - createdTime) / (24 * 60 * 60 * 1000);
    if (daysDiff > RECENT_DAYS) return 1;
    return 1 + (1 - daysDiff / RECENT_DAYS) * 0.3;
}

// 计算单篇帖子积分
function calculatePostScore(post, avgLikes) {
    const likeCount = post.statCount?.feedPraiseCount || post.likeCount || 0;
    if (likeCount < MIN_LIKES) return null;

    const isEssence = post.communityContext?.isEssence || false;
    const createdTime = post.createdTs || post.createTime || Date.now();
    
    const qualityCoeff = calculateQualityCoefficient(likeCount, avgLikes);
    const timeCoeff = calculateTimeCoefficient(createdTime);
    
    const baseScore = likeCount * qualityCoeff;
    const essenceBonus = isEssence ? ESSENCE_BONUS : 0;
    const timeBonus = likeCount * (timeCoeff - 1);
    
    const totalScore = baseScore + essenceBonus + timeBonus;
    
    return {
        total: Math.round(totalScore * 100) / 100,
        base: Math.round(likeCount * 100) / 100,
        qualityBonus: Math.round(likeCount * (qualityCoeff - 1) * 100) / 100,
        essenceBonus: essenceBonus,
        timeBonus: Math.round(timeBonus * 100) / 100,
        isEssence: isEssence,
        likeCount: likeCount
    };
}

// 获取帖子数据
async function fetchPosts(page) {
    const targetUrl = `https://m.ximalaya.com/community/v2/communities/${COMMUNITY_ID}/articles`;
    const params = {
        communityId: COMMUNITY_ID,
        pageId: page,
        orderBy: 2,
        includeTotalCount: "true"
    };
    
    const fullUrl = `${targetUrl}?${new URLSearchParams(params)}`;
    const proxy = PROXY_SERVICES[currentProxyIndex];
    const proxyUrl = `${proxy.url}${encodeURIComponent(fullUrl)}`;
    
    try {
        const response = await fetch(proxyUrl, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        return await response.json();
        
    } catch (error) {
        currentProxyIndex = (currentProxyIndex + 1) % PROXY_SERVICES.length;
        throw error;
    }
}

// 计算平均点赞数
async function calculateAverageLikes() {
    let totalLikes = 0;
    let totalPosts = 0;
    
    for (let page = 1; page <= 5; page++) {
        updateProgressDisplay(page, 5, 0, 0, 'calculating');
        try {
            const data = await fetchPosts(page);
            if (!data?.data?.list) continue;
            
            const posts = data.data.list;
            const oneMonthAgo = Date.now() - ONE_MONTH_MS;
            
            for (const post of posts) {
                const createdTime = post.createdTs || post.createTime;
                if (!createdTime || createdTime < oneMonthAgo) continue;
                
                const likeCount = post.statCount?.feedPraiseCount || post.likeCount || 0;
                if (likeCount > 0) {
                    totalLikes += likeCount;
                    totalPosts++;
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 31));
        } catch (error) {
            console.warn('计算平均点赞数时出错:', error);
        }
    }
    
    return totalPosts > 0 ? totalLikes / totalPosts : 3;
}

// 处理单页数据
function processPageData(data, avgLikes) {
    if (!data?.data?.list) return 0;
    
    const posts = data.data.list;
    let qualifiedPosts = 0;
    const oneMonthAgo = Date.now() - ONE_MONTH_MS;
    
    for (const post of posts) {
        const createdTime = post.createdTs || post.createTime;
        if (!createdTime || createdTime < oneMonthAgo) continue;

        const likeCount = post.statCount?.feedPraiseCount || post.likeCount || 0;
        globalStats.totalPosts++;
        globalStats.totalLikes += likeCount;
        
        const postScore = calculatePostScore(post, avgLikes);
        if (!postScore) continue;

        qualifiedPosts++;
        
        const authorInfo = post.authorInfo || post.userInfo || {};
        const author = authorInfo.nickname || '匿名用户';
        const uid = authorInfo.uid || 'unknown_' + Math.random().toString(36).substr(2, 9);
        
        if (!userScoreData[uid]) {
            userScoreData[uid] = {
                name: author,
                uid: uid,
                totalScore: 0,
                baseScore: 0,
                qualityBonus: 0,
                essenceBonus: 0,
                timeBonus: 0,
                postCount: 0,
                essenceCount: 0,
                totalLikes: 0,
                lastPostTime: 0,
                maxLikes: 0,        // 单篇最高点赞数
                minLikes: Infinity, // 单篇最低点赞数
                popularPosts: 0,
                tags: []
            };
        }
        
        const user = userScoreData[uid];
        user.totalScore += postScore.total;
        user.baseScore += postScore.base;
        user.qualityBonus += postScore.qualityBonus;
        user.essenceBonus += postScore.essenceBonus;
        user.timeBonus += postScore.timeBonus;
        user.postCount += 1;
        user.totalLikes += postScore.likeCount;
        
        if (postScore.isEssence) {
            user.essenceCount += 1;
        }
        
        if (createdTime > user.lastPostTime) {
            user.lastPostTime = createdTime;
        }
        
        if (postScore.likeCount > user.maxLikes) {
            user.maxLikes = postScore.likeCount;
        }

        if (postScore.likeCount < user.minLikes) {
            user.minLikes = postScore.likeCount;
        }

        if (postScore.likeCount > 20) {
            user.popularPosts += 1;
        }
    }
    
    return qualifiedPosts;
}

// 获取所有帖子
async function fetchAllPosts() {
    if (isUpdating) return;
    
    isUpdating = true;
    showProgressBar();
    showUpdateIndicator();
    
    const oldUserScoreData = { ...userScoreData };
    const oldGlobalStats = { ...globalStats };
    
    userScoreData = {};
    globalStats = { totalPosts: 0, qualifiedPosts: 0, avgLikes: 0, totalLikes: 0 };
    
    try {
        updateProgressDisplay(0, 3, 0, 0, 'calculating');
        globalStats.avgLikes = await calculateAverageLikes();
        let totalQualifiedPosts = 0;
        
        for (let page = 1; page <= MAX_PAGES; page++) {
            updateProgressDisplay(page, MAX_PAGES, totalQualifiedPosts, 0, 'fetching');
            try {
                const data = await fetchPosts(page);
                const qualifiedPosts = processPageData(data, globalStats.avgLikes);
                totalQualifiedPosts += qualifiedPosts;

                // 更新总帖子数显示
                updateProgressDisplay(page, MAX_PAGES, totalQualifiedPosts, globalStats.totalPosts, 'fetching');
                
                if (!data?.data?.list || data.data.list.length === 0) break;
                await new Promise(resolve => setTimeout(resolve, 310 + Math.random() * 67));
            } catch (error) {
                console.warn(`第 ${page} 页获取失败:`, error);
            }
        }
        
        globalStats.qualifiedPosts = totalQualifiedPosts;
        
        // 为所有用户计算标签
        Object.values(userScoreData).forEach(user => {
            if (user.postCount > 0) {
                  // 如果没有帖子获得点赞，将minLikes设为0
                  if (user.minLikes === Infinity) {
                        user.minLikes = 0;
                  }
            }
            user.tags = calculateUserTags(user);
        });

        updateProgressDisplay(MAX_PAGES, MAX_PAGES, totalQualifiedPosts, globalStats.totalPosts, 'processing');
        
        processData();
        
        const userCount = Object.keys(userScoreData).length;
        showSubtleNotification(`数据更新完成！${userCount}位创作者，${totalQualifiedPosts}篇优质内容`);
        
    } catch (error) {
        console.error('数据获取失败:', error);
        userScoreData = oldUserScoreData;
        globalStats = oldGlobalStats;
        showSubtleNotification('数据更新失败，保持原有数据');
    } finally {
        isUpdating = false;
        hideUpdateIndicator();
        hideProgressBar();
        startUpdateTimer();
    }
}

// 处理和分析数据
function processData() {
    const userArray = Object.values(userScoreData)
        .sort((a, b) => b.totalScore - a.totalScore);
    
    updateStats(userArray);
    updateTable(userArray);
    updateCharts(userArray);
    updateLastUpdateTime();
}

// 更新统计信息
function updateStats(users) {
    if (topUserEl) {
        topUserEl.textContent = users.length > 0 ? users[0].name : '暂无';
    }
    if (totalUsersEl) {
        totalUsersEl.textContent = users.length;
    }
    if (totalPostsEl) {
        totalPostsEl.textContent = globalStats.qualifiedPosts;
    }
}

// 更新最后更新时间
function updateLastUpdateTime() {
    if (lastUpdateEl) {
        lastUpdateEl.textContent = new Date().toLocaleTimeString();
    }
}

// 更新表格数据
// 更新表格数据
function updateTable(users) {
    if (!dataTableBody) return;
    
    dataTableBody.innerHTML = '';
    
    users.slice(0, 50).forEach((user, index) => {
        const row = document.createElement('tr');
        
        // 生成标签HTML
        const tagsHtml = user.tags.map(tag => {
            const style = getTagStyle(tag);
            return `
                <span class="user-tag" 
                    style="background: ${style.bg}; 
                           color: ${style.color}; 
                           border: 1px solid ${style.border};
                           box-shadow: ${style.shadow};
                           font-weight: 500;">
                    ${tag}
                </span>
            `;
        }).join(' ');
        
        row.innerHTML = `
            <td><strong>${index + 1}</strong></td>
            <td><strong>${user.name}</strong></td>
            <td><span style="color:#667eea;font-weight:bold">${user.totalScore.toFixed(1)}</span></td>
            <td>${user.postCount}</td>
            <td>${user.essenceCount}</td>
            <td>${user.totalLikes}</td>
            <td>${new Date(user.lastPostTime).toLocaleDateString()}</td>
            <td>${tagsHtml || '<span style="color:#999;font-style:italic">暂无标签</span>'}</td>
        `;
        
        dataTableBody.appendChild(row);
    
    });
    // 保存当前数据到全局变量
    window.currentRankingData = data;
    
    // 保存历史数据（异步，不阻塞界面）
    historicalRanking.saveHistoricalData(data);
}

// 更新图表
function updateCharts(users) {
    if (!charts.userRankChart || !charts.scoreDistributionChart) return;
    
    const top20 = users.slice(0, 20);
    charts.userRankChart.setOption({
        yAxis: { data: top20.map(user => user.name) },
        series: [{ data: top20.map(user => user.totalScore) }]
    });
    
    if (users.length > 0) {
        const totalBase = users.reduce((sum, user) => sum + user.baseScore, 0);
        const totalQuality = users.reduce((sum, user) => sum + user.qualityBonus, 0);
        const totalEssence = users.reduce((sum, user) => sum + user.essenceBonus, 0);
        const totalTime = users.reduce((sum, user) => sum + user.timeBonus, 0);
        
        charts.scoreDistributionChart.setOption({
            series: [{
                data: [
                    { name: '基础点赞', value: Math.round(totalBase) },
                    { name: '质量加成', value: Math.round(totalQuality) },
                    { name: '精华奖励', value: Math.round(totalEssence) },
                    { name: '近期活跃', value: Math.round(totalTime) }
                ]
            }]
        });
    }
}
// 添加进度显示函数
function updateProgressDisplay(page, totalPages, currentPosts, totalPosts, stage) {
    const progressStages = {
        'calculating': '计算平均点赞数...',
        'fetching': '获取帖子数据...',
        'processing': '处理数据中...'
    };
    
    const percent = Math.min(100, Math.max(0, (page / totalPages) * 100));
    
    // 更新进度条
    if (window.progressBar) {
        window.progressBar.style.width = `${percent}%`;
    }
    
    // 更新进度文本
    if (window.progressText) {
        let text = `${progressStages[stage] || '处理中...'} `;
        text += `(${page}/${totalPages}页) `;
        text += `已找到 ${currentPosts} 篇优质帖子`;
        if (totalPosts > 0) {
            text += `，共 ${totalPosts} 篇`;
        }
        window.progressText.textContent = text;
    }
}

// 显示进度条
function showProgressBar() {
    // 创建或显示进度条容器
    let progressContainer = document.getElementById('progressContainer');
    if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.id = 'progressContainer';
        progressContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            background: rgba(255,255,255,0.95);
            padding: 10px 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;
        
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            width: 100%;
            height: 6px;
            background: #e2e8f0;
            border-radius: 3px;
            overflow: hidden;
        `;
        
        const progressInner = document.createElement('div');
        progressInner.id = 'progressBar';
        progressInner.style.cssText = `
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 3px;
            transition: width 0.3s ease;
        `;
        
        const progressText = document.createElement('div');
        progressText.id = 'progressText';
        progressText.style.cssText = `
            font-size: 14px;
            color: #4a5568;
            text-align: center;
        `;
        
        progressBar.appendChild(progressInner);
        progressContainer.appendChild(progressBar);
        progressContainer.appendChild(progressText);
        document.body.appendChild(progressContainer);
        
        // 保存到全局变量
        window.progressBar = progressInner;
        window.progressText = progressText;
    } else {
        progressContainer.style.display = 'flex';
    }
}

// 隐藏进度条
function hideProgressBar() {
    const progressContainer = document.getElementById('progressContainer');
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
}

// 替换原有的initPosterButton函数
function initPosterButton() {
    const posterBtn = document.getElementById('generatePosterBtn');
    if (posterBtn) {
        posterBtn.addEventListener('click', function() {
            // 存储用户数据到localStorage
            localStorage.setItem('yaquanUserData', JSON.stringify(userScoreData));
            localStorage.setItem('yaquanLastUpdate', new Date().toISOString());
            localStorage.setItem('yaquanSaveTime', new Date().toISOString());
            
            // 打开海报生成页面
            window.open('poster.html', '_blank');
        });
    }
}

function initHistoricalRankingToggle() {
    const filters = document.querySelectorAll('.table-filters span');
    
    filters.forEach(filter => {
        filter.addEventListener('click', async () => {
            filters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            
            const type = filter.getAttribute('data-type');
            
            if (type === 'historical') {
                await showHistoricalRanking();
            } else {
                showCurrentRanking();
            }
        });
    });
}

async function showHistoricalRanking() {
    const historicalData = await historicalRanking.getHistoricalData();
    
    if (historicalData.length === 0) {
        alert('暂无历史数据');
        document.querySelector('.table-filters span[data-type="current"]').click();
        return;
    }
    
    updateTableWithHistoricalData(historicalData);
    document.querySelector('.table-header h3').textContent = '历史最高分排行榜';
}

function showCurrentRanking() {
    if (window.currentRankingData) {
        updateTable(window.currentRankingData);
    }
    document.querySelector('.table-header h3').textContent = '详细排名数据';
}

function updateTableWithHistoricalData(data) {
    const tbody = document.querySelector('#dataTable tbody');
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-row">暂无历史数据</td></tr>';
        return;
    }
    
    let html = '';
    data.forEach((user, index) => {
        const rank = index + 1;
        const rankClass = getRankClass(rank);
        
        html += `
            <tr>
                <td><span class="rank-badge ${rankClass}">${rank}</span></td>
                <td>${escapeHtml(user.name)}</td>
                <td><strong>${user.score}</strong></td>
                <td>${user.highQualityPosts || 0}</td>
                <td>${user.featuredPosts || 0}</td>
                <td>${user.likes || 0}</td>
                <td>${formatDate(user.lastActive)}</td>
                <td>${generateUserTags(user)}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// 主初始化函数
function init() {
    initDOMElements();
    initPosterButton();
    startUpdateTimer();
    fetchAllPosts();
    initHistoricalRankingToggle();
        // 清理过期的localStorage数据
    const lastSave = localStorage.getItem('yaquanSaveTime');
    if (lastSave) {
        const saveTime = new Date(lastSave);
        const now = new Date();
        // 如果数据保存时间超过1小时，清理它
        if (now - saveTime > 60 * 60 * 1000) {
            localStorage.removeItem('yaquanUserData');
            localStorage.removeItem('yaquanLastUpdate');
            localStorage.removeItem('yaquanSaveTime');
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
