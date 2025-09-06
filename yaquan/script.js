// 配置
const COMMUNITY_ID = 4353;
const MAX_PAGES = 30;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_LIKES = 3; // 最小点赞数要求
const ESSENCE_BONUS = 10; // 精华帖奖励
const RECENT_DAYS = 30; // 近期帖子天数

// 全局变量
let userScoreData = {};
let allQualifiedPosts = [];
let currentPage = 1;
let isLoading = false;
let currentProxyIndex = 0;
let globalStats = {
    totalPosts: 0,
    qualifiedPosts: 0,
    avgLikes: 0,
    totalLikes: 0
};

// 代理服务列表
const PROXY_SERVICES = [
    { name: 'Vercel', url: '/api/proxy?url=' },
    { name: 'CorsProxy', url: 'https://corsproxy.io/?' },
    { name: 'AllOrigins', url: 'https://api.allorigins.win/raw?url=' },
    { name: 'CorsAnywhere', url: 'https://cors-anywhere.herokuapp.com/' }
];

// DOM元素
const refreshBtn = document.getElementById('refreshBtn');
const lastUpdateEl = document.getElementById('lastUpdate');
const loadingEl = document.getElementById('loading');
const progressTextEl = document.getElementById('progressText');
const progressBarEl = document.querySelector('.progress');
const tableBody = document.querySelector('#dataTable tbody');
const debugPanel = document.getElementById('debugPanel');
const debugInfo = document.getElementById('debugInfo');

// 初始化图表
function initCharts() {
    const userRankChart = echarts.init(document.getElementById('userRankChart'));
    const scoreDistributionChart = echarts.init(document.getElementById('postDistributionChart'));

    userRankChart.setOption({
        title: { text: '优质发帖者综合积分排名(TOP20)', left: 'center' },
        tooltip: { 
            trigger: 'axis',
            formatter: function(params) {
                const data = params[0];
                return `${data.name}<br/>综合积分: ${data.value}<br/>排名: ${params[0].dataIndex + 1}`;
            }
        },
        xAxis: { type: 'value', name: '综合积分' },
        yAxis: { type: 'category', data: [] },
        series: [{
            name: '综合积分',
            type: 'bar',
            data: [],
            itemStyle: { 
                color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                    { offset: 0, color: '#ff6a33' },
                    { offset: 1, color: '#ff9c6a' }
                ])
            }
        }]
    });

    scoreDistributionChart.setOption({
        title: { text: '积分构成分析', left: 'center' },
        tooltip: { trigger: 'item', formatter: '{a} <br/>{b}: {c}分 ({d}%)' },
        legend: { orient: 'vertical', left: 'left' },
        series: [{
            name: '积分构成',
            type: 'pie',
            radius: '50%',
            data: [],
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    });

    return { userRankChart, scoreDistributionChart };
}

let charts = initCharts();

// 计算质量系数
function calculateQualityCoefficient(likes, avgLikes) {
    if (avgLikes <= 0) return 1;
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
    
    // 只有点赞数大于3的帖子才参与积分
    if (likeCount < MIN_LIKES) return 0;

    const isEssence = post.communityContext?.isEssence || false;
    const createdTime = post.createdTs || post.createTime || Date.now();
    
    // 计算各个系数
    const qualityCoeff = calculateQualityCoefficient(likeCount, avgLikes);
    const timeCoeff = calculateTimeCoefficient(createdTime);
    
    // 计算积分
    const baseScore = likeCount * qualityCoeff;
    const essenceBonus = isEssence ? ESSENCE_BONUS : 0;
    const timeBonus = likeCount * (timeCoeff - 1); // 时间加成部分
    
    const totalScore = baseScore + essenceBonus + timeBonus;
    
    return {
        total: Math.round(totalScore * 100) / 100, // 保留两位小数
        base: Math.round(likeCount * 100) / 100,
        qualityBonus: Math.round(likeCount * (qualityCoeff - 1) * 100) / 100,
        essenceBonus: essenceBonus,
        timeBonus: Math.round(timeBonus * 100) / 100,
        qualityCoeff: Math.round(qualityCoeff * 100) / 100,
        timeCoeff: Math.round(timeCoeff * 100) / 100,
        isEssence: isEssence,
        likeCount: likeCount
    };
}

// 处理单页数据
function processPageData(data, avgLikes) {
    if (!data || !data.data || !data.data.list) return 0;
    
    const posts = data.data.list;
    let qualifiedPosts = 0;
    const oneMonthAgo = Date.now() - ONE_MONTH_MS;
    
    for (const post of posts) {
        // 只统计一个月内的帖子
        const createdTime = post.createdTs || post.createTime;
        if (!createdTime || createdTime < oneMonthAgo) continue;

        const likeCount = post.statCount?.feedPraiseCount || post.likeCount || 0;
        globalStats.totalPosts++;
        globalStats.totalLikes += likeCount;
        
        // 计算帖子积分
        const postScore = calculatePostScore(post, avgLikes);
        
        // 只有有积分的帖子才计入
        if (postScore.total > 0) {
            qualifiedPosts++;
            allQualifiedPosts.push({ post, score: postScore });
            
            const authorInfo = post.authorInfo || post.userInfo || {};
            const author = authorInfo.nickname || '匿名用户';
            const uid = authorInfo.uid || 'unknown_' + Math.random().toString(36).substr(2, 9);
            
            // 初始化用户数据
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
                    posts: []
                };
            }
            
            // 更新用户积分数据
            userScoreData[uid].totalScore += postScore.total;
            userScoreData[uid].baseScore += postScore.base;
            userScoreData[uid].qualityBonus += postScore.qualityBonus;
            userScoreData[uid].essenceBonus += postScore.essenceBonus;
            userScoreData[uid].timeBonus += postScore.timeBonus;
            userScoreData[uid].postCount += 1;
            userScoreData[uid].totalLikes += postScore.likeCount;
            
            // 统计精华帖数量
            if (postScore.isEssence) {
                userScoreData[uid].essenceCount += 1;
            }
            
            // 保存帖子详情
            userScoreData[uid].posts.push({
                id: post.id,
                score: postScore,
                createdTime: createdTime
            });
            
            // 更新最后发帖时间
            if (createdTime > userScoreData[uid].lastPostTime) {
                userScoreData[uid].lastPostTime = createdTime;
            }
        }
    }
    
    return qualifiedPosts;
}

// 获取平均点赞数（先扫描所有帖子）
async function calculateAverageLikes() {
    let totalLikes = 0;
    let totalPosts = 0;
    let currentPage = 1;
    let hasMore = true;
    
    debugLog('正在计算平均点赞数...');
    
    while (hasMore && currentPage <= 10) { // 只扫描前10页计算平均值
        const data = await fetchPosts(currentPage);
        if (!data || !data.data || !data.data.list) break;
        
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
        
        if (posts.length === 0) hasMore = false;
        currentPage++;
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    const avgLikes = totalPosts > 0 ? totalLikes / totalPosts : 0;
    debugLog(`平均点赞数计算完成: ${avgLikes.toFixed(2)} (基于${totalPosts}篇帖子)`);
    return avgLikes;
}

// 获取所有帖子
async function fetchAllPosts() {
    if (isLoading) return;
    
    isLoading = true;
    loadingEl.style.display = 'block';
    userScoreData = {};
    allQualifiedPosts = [];
    currentPage = 1;
    currentProxyIndex = 0;
    globalStats = { totalPosts: 0, qualifiedPosts: 0, avgLikes: 0, totalLikes: 0 };
    
    debugLog('开始获取优质帖子数据...');
    
    let hasMore = true;
    let success = false;
    let totalQualifiedPosts = 0;
    
    try {
        // 先计算平均点赞数
        globalStats.avgLikes = await calculateAverageLikes();
        
        // 重新开始获取所有帖子
        currentPage = 1;
        while (hasMore && currentPage <= MAX_PAGES) {
            updateProgress(currentPage, MAX_PAGES, totalQualifiedPosts);
            
            const data = await fetchPosts(currentPage);
            if (!data) {
                throw new Error('获取数据失败');
            }
            
            const qualifiedPosts = processPageData(data, globalStats.avgLikes);
            totalQualifiedPosts += qualifiedPosts;
            debugLog(`第 ${currentPage} 页找到 ${qualifiedPosts} 篇优质帖子`);
            
            if (qualifiedPosts === 0 || !data.data?.list || data.data.list.length === 0) {
                hasMore = false;
            }
            
            currentPage++;
            await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        success = true;
        globalStats.qualifiedPosts = totalQualifiedPosts;
        
    } catch (error) {
        debugLog('获取数据过程中出错: ' + error.message, 'error');
        alert('获取数据失败: ' + error.message);
    } finally {
        loadingEl.style.display = 'none';
        isLoading = false;
        
        if (success && totalQualifiedPosts > 0) {
            saveToStorage();
            processData();
            alert(`数据获取完成！共分析 ${globalStats.totalPosts} 篇帖子，其中 ${totalQualifiedPosts} 篇优质帖子，平均点赞数 ${globalStats.avgLikes.toFixed(2)}`);
        } else if (!success) {
            alert('未能获取到数据，请检查网络或稍后重试');
        }
    }
}

// 处理和分析数据
function processData() {
    const userArray = Object.values(userScoreData)
        .sort((a, b) => b.totalScore - a.totalScore);
    
    updateTable(userArray);
    updateCharts(userArray);
    debugLog(`数据处理完成，共 ${userArray.length} 位用户参与排名`);
}

// 更新表格数据
function updateTable(data) {
    tableBody.innerHTML = '';
    
    data.forEach((user, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${user.name}</td>
            <td><strong>${user.totalScore.toFixed(1)}</strong></td>
            <td>${user.baseScore.toFixed(1)}</td>
            <td>${user.qualityBonus.toFixed(1)}</td>
            <td>${user.essenceBonus.toFixed(1)}</td>
            <td>${user.timeBonus.toFixed(1)}</td>
            <td>${user.postCount}</td>
            <td>${user.essenceCount}</td>
            <td>${user.totalLikes}</td>
            <td>${new Date(user.lastPostTime).toLocaleDateString()}</td>
        `;
        tableBody.appendChild(row);
    });
}

// 更新图表
function updateCharts(data) {
    const top20 = data.slice(0, 20);
    charts.userRankChart.setOption({
        yAxis: { data: top20.map(user => user.name) },
        series: [{ data: top20.map(user => user.totalScore) }]
    });
    
    // 积分构成分析
    if (data.length > 0) {
        const totalBase = data.reduce((sum, user) => sum + user.baseScore, 0);
        const totalQuality = data.reduce((sum, user) => sum + user.qualityBonus, 0);
        const totalEssence = data.reduce((sum, user) => sum + user.essenceBonus, 0);
        const totalTime = data.reduce((sum, user) => sum + user.timeBonus, 0);
        
        charts.scoreDistributionChart.setOption({
            series: [{
                data: [
                    { name: '基础点赞分', value: Math.round(totalBase) },
                    { name: '质量加成', value: Math.round(totalQuality) },
                    { name: '精华奖励', value: Math.round(totalEssence) },
                    { name: '近期活跃', value: Math.round(totalTime) }
                ]
            }]
        });
    }
}

// 保存和加载数据（需要修改存储结构）
function saveToStorage() {
    try {
        const storageData = {
            userScoreData,
            globalStats,
            timestamp: Date.now()
        };
        localStorage.setItem('yaquanScoreData', JSON.stringify(storageData));
        localStorage.setItem('yaquanUpdateTime', Date.now().toString());
        lastUpdateEl.textContent = `上次更新: ${new Date().toLocaleString()}`;
        debugLog('积分数据已保存到本地存储');
    } catch (error) {
        debugLog('保存到本地存储失败: ' + error.message, 'error');
    }
}

function loadFromStorage() {
    try {
        const savedData = localStorage.getItem('yaquanScoreData');
        const savedTime = localStorage.getItem('yaquanUpdateTime');
        
        if (savedData && savedTime) {
            const data = JSON.parse(savedData);
            const updateTime = new Date(parseInt(savedTime));
            
            if (Date.now() - updateTime.getTime() < ONE_MONTH_MS) {
                userScoreData = data.userScoreData || {};
                globalStats = data.globalStats || {};
                lastUpdateEl.textContent = `上次更新: ${updateTime.toLocaleString()}`;
                processData();
                debugLog('从本地存储加载积分数据成功');
                return true;
            }
        }
    } catch (error) {
        debugLog('加载本地数据失败: ' + error.message, 'error');
    }
    return false;
}

// 其他辅助函数保持不变（fetchPosts, updateProgress, debugLog等）
// 需要保持原有的fetchPosts函数和其他工具函数
