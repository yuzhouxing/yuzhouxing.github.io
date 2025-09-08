// 配置
const COMMUNITY_ID = 4353;
const MAX_PAGES = 25;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_LIKES = 5;
const ESSENCE_BONUS = 25;
const RECENT_DAYS = 10;
const UPDATE_INTERVAL = 300 * 1000; // 1分钟更新一次

// 代理服务列表
const PROXY_SERVICES = [
    { name: 'CorsProxy', url: 'https://corsproxy.io/?' },
    { name: 'AllOrigins', url: 'https://api.allorigins.win/raw?url=' },
    { name: 'CorsAnywhere', url: 'https://cors-anywhere.herokuapp.com/' }
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
        '稳定输出': { condition: (user) => user.postCount >= 8 && (user.totalLikes / user.postCount) >= 10 },
        '人气之王': { condition: (user) => user.totalLikes >= 20 },
        '一帖傲群': { condition: (user) => (user.totalLikes / user.postCount) >= 50 }
    }
};

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
        // 橙色 - 最高级别（温暖、醒目）
        '最高级': { 
            bg: 'linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%)', 
            color: '#d46b08', 
            border: '#ffbb96',
            shadow: '0 2px 4px rgba(250, 140, 22, 0.2)'
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
            
            await new Promise(resolve => setTimeout(resolve, 13));
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
    }
    
    return qualifiedPosts;
}

// 获取所有帖子
async function fetchAllPosts() {
    if (isUpdating) return;
    
    isUpdating = true;
    showUpdateIndicator();
    
    const oldUserScoreData = { ...userScoreData };
    const oldGlobalStats = { ...globalStats };
    
    userScoreData = {};
    globalStats = { totalPosts: 0, qualifiedPosts: 0, avgLikes: 0, totalLikes: 0 };
    
    try {
        globalStats.avgLikes = await calculateAverageLikes();
        let totalQualifiedPosts = 0;
        
        for (let page = 1; page <= MAX_PAGES; page++) {
            try {
                const data = await fetchPosts(page);
                const qualifiedPosts = processPageData(data, globalStats.avgLikes);
                totalQualifiedPosts += qualifiedPosts;
                
                if (!data?.data?.list || data.data.list.length === 0) break;
                await new Promise(resolve => setTimeout(resolve, 13));
            } catch (error) {
                console.warn(`第 ${page} 页获取失败:`, error);
            }
        }
        
        globalStats.qualifiedPosts = totalQualifiedPosts;
        
        // 为所有用户计算标签
        Object.values(userScoreData).forEach(user => {
            user.tags = calculateUserTags(user);
        });
        
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

// 主初始化函数
function init() {
    initDOMElements();
    startUpdateTimer();
    fetchAllPosts();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
