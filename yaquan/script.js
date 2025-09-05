// 配置
const COMMUNITY_ID = 4353;
const MAX_PAGES = 50;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_LIKES = 3; // 最小点赞数要求

// 代理服务列表
const PROXY_SERVICES = [
    { name: 'Vercel', url: '/api/proxy?url=' },
    { name: 'CorsProxy', url: 'https://corsproxy.io/?' },
    { name: 'AllOrigins', url: 'https://api.allorigins.win/raw?url=' },
    { name: 'CorsAnywhere', url: 'https://cors-anywhere.herokuapp.com/' }
];

// 全局变量
let userScoreData = {}; // 改为存储用户积分数据
let allQualifiedPosts = []; // 存储符合条件的帖子
let currentPage = 1;
let isLoading = false;
let currentProxyIndex = 0;

// DOM元素
const refreshBtn = document.getElementById('refreshBtn');
const lastUpdateEl = document.getElementById('lastUpdate');
const loadingEl = document.getElementById('loading');
const progressTextEl = document.getElementById('progressText');
const progressBarEl = document.querySelector('.progress');
const tableBody = document.querySelector('#dataTable tbody');
const debugPanel = document.getElementById('debugPanel');
const debugInfo = document.getElementById('debugInfo');
const toggleDebugBtn = document.getElementById('toggleDebug');
const testProxyBtn = document.getElementById('testProxyBtn');
const testDirectBtn = document.getElementById('testDirectBtn');
const clearStorageBtn = document.getElementById('clearStorageBtn');

// 调试函数
function debugLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}\n`;
    console.log(logEntry);
    debugInfo.textContent += logEntry;
    debugInfo.scrollTop = debugInfo.scrollHeight;
}

// 初始化图表
function initCharts() {
    const userRankChart = echarts.init(document.getElementById('userRankChart'));
    const postDistributionChart = echarts.init(document.getElementById('postDistributionChart'));

    userRankChart.setOption({
        title: { text: '优质发帖者积分排名(TOP20)', left: 'center' },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'value', name: '积分' },
        yAxis: { type: 'category', data: [] },
        series: [{
            name: '积分',
            type: 'bar',
            data: [],
            itemStyle: { color: '#ff6a33' }
        }]
    });

    postDistributionChart.setOption({
        title: { text: '积分分布情况', left: 'center' },
        tooltip: { trigger: 'item', formatter: '{a} <br/>{b}: {c} ({d}%)' },
        series: [{
            name: '积分分布',
            type: 'pie',
            radius: '50%',
            data: []
        }]
    });

    return { userRankChart, postDistributionChart };
}

let charts = initCharts();

// 从本地存储加载数据
function loadFromStorage() {
    try {
        const savedData = localStorage.getItem('yaquanScoreData');
        const savedTime = localStorage.getItem('yaquanUpdateTime');
        
        if (savedData && savedTime) {
            const updateTime = new Date(parseInt(savedTime));
            lastUpdateEl.textContent = `上次更新: ${updateTime.toLocaleString()}`;
            
            if (Date.now() - updateTime.getTime() < ONE_MONTH_MS) {
                userScoreData = JSON.parse(savedData);
                processData();
                debugLog('从本地存储加载积分数据成功');
                return true;
            } else {
                debugLog('本地数据已过期', 'warn');
            }
        }
    } catch (error) {
        debugLog('加载本地数据失败: ' + error.message, 'error');
    }
    return false;
}

// 保存数据到本地存储
function saveToStorage() {
    try {
        localStorage.setItem('yaquanScoreData', JSON.stringify(userScoreData));
        localStorage.setItem('yaquanUpdateTime', Date.now().toString());
        lastUpdateEl.textContent = `上次更新: ${new Date().toLocaleString()}`;
        debugLog('积分数据已保存到本地存储');
    } catch (error) {
        debugLog('保存到本地存储失败: ' + error.message, 'error');
    }
}

// 计算帖子积分
function calculatePostScore(post) {
    let score = 0;
    
    // 获取点赞数（兼容不同字段名）
    const likeCount = post.statCount?.feedPraiseCount || post.likeCount || 0;
    
    // 只有点赞数大于3的帖子才参与积分
    if (likeCount > MIN_LIKES) {
        // 基础积分 = 点赞数
        score += likeCount;
        
        // 精华帖额外+10分
        const isEssence = post.communityContext?.isEssence || false;
        if (isEssence) {
            score += 10;
            debugLog(`精华帖额外+10分: ${post.authorInfo.nickname}`);
        }
    }
    
    return score;
}

// 处理单页数据
function processPageData(data) {
    if (!data || !data.data || !data.data.list) {
        debugLog('无效的数据格式', 'warn');
        return 0;
    }
    
    const posts = data.data.list;
    let qualifiedPosts = 0;
    const oneMonthAgo = Date.now() - ONE_MONTH_MS;
    
    for (const post of posts) {
        // 只统计一个月内的帖子
        const createdTime = post.createdTs || post.createTime;
        if (!createdTime || createdTime < oneMonthAgo) continue;
        
        // 计算帖子积分
        const postScore = calculatePostScore(post);
        
        // 只有有积分的帖子才计入
        if (postScore > 0) {
            qualifiedPosts++;
            allQualifiedPosts.push(post);
            
            const authorInfo = post.authorInfo || post.userInfo || {};
            const author = authorInfo.nickname || '匿名用户';
            const uid = authorInfo.uid || 'unknown';
            
            // 初始化用户数据
            if (!userScoreData[uid]) {
                userScoreData[uid] = {
                    name: author,
                    totalScore: 0,
                    postCount: 0,
                    essenceCount: 0,
                    totalLikes: 0,
                    lastPostTime: 0
                };
            }
            
            // 更新用户积分数据
            userScoreData[uid].totalScore += postScore;
            userScoreData[uid].postCount += 1;
            userScoreData[uid].totalLikes += (post.statCount?.feedPraiseCount || 0);
            
            // 统计精华帖数量
            const isEssence = post.communityContext?.isEssence || false;
            if (isEssence) {
                userScoreData[uid].essenceCount += 1;
            }
            
            // 更新最后发帖时间
            if (createdTime > userScoreData[uid].lastPostTime) {
                userScoreData[uid].lastPostTime = createdTime;
            }
            
            debugLog(`用户 ${author} 获得 ${postScore} 分 (点赞: ${post.statCount?.feedPraiseCount || 0}, 精华: ${isEssence ? '是' : '否'})`);
        }
    }
    
    return qualifiedPosts;
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
    
    // 尝试当前代理
    const proxy = PROXY_SERVICES[currentProxyIndex];
    let proxyUrl;
    
    if (proxy.url.startsWith('http')) {
        proxyUrl = `${proxy.url}${encodeURIComponent(fullUrl)}`;
    } else {
        proxyUrl = `${proxy.url}${encodeURIComponent(fullUrl)}`;
    }
    
    debugLog(`尝试代理 ${proxy.name}: ${proxyUrl}`);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(proxyUrl, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        debugLog(`代理 ${proxy.name} 成功获取第 ${page} 页数据`);
        return data;
        
    } catch (error) {
        debugLog(`代理 ${proxy.name} 失败: ${error.message}`, 'error');
        
        // 切换到下一个代理
        currentProxyIndex = (currentProxyIndex + 1) % PROXY_SERVICES.length;
        if (currentProxyIndex === 0) {
            throw new Error('所有代理都失败了');
        }
        
        debugLog(`切换到代理: ${PROXY_SERVICES[currentProxyIndex].name}`);
        return fetchPosts(page);
    }
}

// 更新进度条
function updateProgress(page, totalPages, currentPosts) {
    const percent = (page / totalPages) * 100;
    progressBarEl.style.width = `${percent}%`;
    progressTextEl.textContent = `正在获取第 ${page}/${totalPages} 页，已找到 ${currentPosts} 篇优质帖子`;
}

// 获取所有帖子
async function fetchAllPosts() {
    if (isLoading) {
        debugLog('已经在获取数据中', 'warn');
        return;
    }
    
    isLoading = true;
    loadingEl.style.display = 'block';
    userScoreData = {};
    allQualifiedPosts = [];
    currentPage = 1;
    currentProxyIndex = 0;
    
    debugLog('开始获取优质帖子数据...');
    
    let hasMore = true;
    let success = false;
    let totalQualifiedPosts = 0;
    
    try {
        while (hasMore && currentPage <= MAX_PAGES) {
            updateProgress(currentPage, MAX_PAGES, totalQualifiedPosts);
            
            const data = await fetchPosts(currentPage);
            if (!data) {
                throw new Error('获取数据失败');
            }
            
            const qualifiedPosts = processPageData(data);
            totalQualifiedPosts += qualifiedPosts;
            debugLog(`第 ${currentPage} 页找到 ${qualifiedPosts} 篇优质帖子`);
            
            // 检查是否还有更多数据
            if (qualifiedPosts === 0 || !data.data?.list || data.data.list.length === 0) {
                hasMore = false;
                debugLog('没有更多数据了');
            }
            
            currentPage++;
            await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        success = true;
        
    } catch (error) {
        debugLog('获取数据过程中出错: ' + error.message, 'error');
        alert('获取数据失败: ' + error.message);
    } finally {
        loadingEl.style.display = 'none';
        isLoading = false;
        
        if (success && totalQualifiedPosts > 0) {
            saveToStorage();
            processData();
            alert(`数据获取完成，共找到 ${totalQualifiedPosts} 篇优质帖子，${Object.keys(userScoreData).length} 位用户参与排名`);
        } else if (!success) {
            alert('未能获取到数据，请检查网络或稍后重试');
        }
    }
}

// 处理和分析数据
function processData() {
    // 转换为数组并按积分排序
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
            <td>${user.totalScore}</td>
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
    
    // 积分分布图表 - 按积分区间分组
    const scoreRanges = [
        { range: '1000+', min: 1000, count: 0 },
        { range: '500-999', min: 500, max: 999, count: 0 },
        { range: '100-499', min: 100, max: 499, count: 0 },
        { range: '50-99', min: 50, max: 99, count: 0 },
        { range: '10-49', min: 10, max: 49, count: 0 },
        { range: '1-9', min: 1, max: 9, count: 0 }
    ];
    
    data.forEach(user => {
        for (const range of scoreRanges) {
            if (range.min && range.max) {
                if (user.totalScore >= range.min && user.totalScore <= range.max) {
                    range.count++;
                    break;
                }
            } else if (range.min && user.totalScore >= range.min) {
                range.count++;
                break;
            }
        }
    });
    
    const distributionData = scoreRanges
        .filter(range => range.count > 0)
        .map(range => ({
            name: range.range,
            value: range.count
        }));
    
    charts.postDistributionChart.setOption({
        series: [{
            data: distributionData,
            label: {
                formatter: '{b}: {c}人 ({d}%)'
            }
        }]
    });
}

// 测试函数
async function testProxyConnection() {
    debugLog('测试代理连接...');
    const testUrl = 'https://m.ximalaya.com/community/v2/communities/4353/articles?communityId=4353&pageId=1&orderBy=2&includeTotalCount=true';
    
    for (let i = 0; i < PROXY_SERVICES.length; i++) {
        const proxy = PROXY_SERVICES[i];
        let proxyUrl;
        
        if (proxy.url.startsWith('http')) {
            proxyUrl = `${proxy.url}${encodeURIComponent(testUrl)}`;
        } else {
            proxyUrl = `${proxy.url}${encodeURIComponent(testUrl)}`;
        }
        
        try {
            const response = await fetch(proxyUrl, { timeout: 10000 });
            debugLog(`代理 ${proxy.name}: ${response.status === 200 ? '成功' : '失败'} (${response.status})`);
        } catch (error) {
            debugLog(`代理 ${proxy.name}: 失败 - ${error.message}`, 'error');
        }
    }
}

// 初始化
function init() {
    // 更新表格标题
    document.querySelector('#dataTable thead tr').innerHTML = `
        <th>排名</th>
        <th>用户名</th>
        <th>总积分</th>
        <th>优质帖数</th>
        <th>精华帖数</th>
        <th>总点赞数</th>
        <th>最后发帖时间</th>
    `;
    
    // 尝试从本地存储加载数据
    if (!loadFromStorage()) {
        lastUpdateEl.textContent = '数据已过期，请点击刷新按钮更新数据';
    }
    
    // 绑定事件
    refreshBtn.addEventListener('click', fetchAllPosts);
    toggleDebugBtn.addEventListener('click', () => {
        debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
    });
    testProxyBtn.addEventListener('click', testProxyConnection);
    testDirectBtn.addEventListener('click', () => {
        debugLog('正在测试直接连接...');
        window.open('https://m.ximalaya.com/community/v2/communities/4353/articles?communityId=4353&pageId=1&orderBy=2&includeTotalCount=true', '_blank');
    });
    clearStorageBtn.addEventListener('click', () => {
        localStorage.clear();
        debugLog('本地存储已清除');
        lastUpdateEl.textContent = '上次更新: 从未';
    });
    
    // 窗口调整大小时重绘图表
    window.addEventListener('resize', () => {
        charts.userRankChart.resize();
        charts.postDistributionChart.resize();
    });
    
    debugLog('优质发帖者排名系统初始化完成');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
