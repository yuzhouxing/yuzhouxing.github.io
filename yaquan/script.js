// 配置
const COMMUNITY_ID = 4353;
const MAX_PAGES = 5; // 先测试少量页面
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// 代理服务列表（按优先级排序）
const PROXY_SERVICES = [
    { name: 'Vercel', url: '/api/proxy?url=' }, // 相对路径，避免CORS
    { name: 'CorsProxy', url: 'https://corsproxy.io/?' },
    { name: 'AllOrigins', url: 'https://api.allorigins.win/raw?url=' },
    { name: 'CorsAnywhere', url: 'https://cors-anywhere.herokuapp.com/' }
];

// 全局变量
let userPostData = {};
let allPosts = [];
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
        title: { text: '用户发帖数量排名(TOP20)', left: 'center' },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: [] },
        series: [{
            name: '发帖数',
            type: 'bar',
            data: [],
            itemStyle: { color: '#ff6a33' }
        }]
    });

    postDistributionChart.setOption({
        title: { text: '发帖分布情况', left: 'center' },
        tooltip: { trigger: 'item' },
        series: [{
            name: '发帖分布',
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
        const savedData = localStorage.getItem('yaquanData');
        const savedTime = localStorage.getItem('yaquanUpdateTime');
        
        if (savedData && savedTime) {
            const updateTime = new Date(parseInt(savedTime));
            lastUpdateEl.textContent = `上次更新: ${updateTime.toLocaleString()}`;
            
            // 检查数据是否在一个月内
            if (Date.now() - updateTime.getTime() < ONE_MONTH_MS) {
                userPostData = JSON.parse(savedData);
                processData();
                debugLog('从本地存储加载数据成功');
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
        localStorage.setItem('yaquanData', JSON.stringify(userPostData));
        localStorage.setItem('yaquanUpdateTime', Date.now().toString());
        lastUpdateEl.textContent = `上次更新: ${new Date().toLocaleString()}`;
        debugLog('数据已保存到本地存储');
    } catch (error) {
        debugLog('保存到本地存储失败: ' + error.message, 'error');
    }
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
    debugLog(`构建目标URL: ${fullUrl}`);
    
    // 尝试当前代理
    const proxy = PROXY_SERVICES[currentProxyIndex];
    let proxyUrl;
    
    if (proxy.url.startsWith('http')) {
        proxyUrl = `${proxy.url}${encodeURIComponent(fullUrl)}`;
    } else {
        // 相对路径
        proxyUrl = `${proxy.url}${encodeURIComponent(fullUrl)}`;
    }
    
    debugLog(`尝试代理 ${proxy.name}: ${proxyUrl}`);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(proxyUrl, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            }
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
        return fetchPosts(page); // 重试
    }
}

// 处理单页数据
function processPageData(data) {
    if (!data || !data.data || !data.data.list) {
        debugLog('无效的数据格式', 'warn');
        return 0;
    }
    
    const posts = data.data.list;
    let validPosts = 0;
    const oneMonthAgo = Date.now() - ONE_MONTH_MS;
    
    for (const post of posts) {
        const createdTime = post.createdTs || post.createTime;
        if (!createdTime || createdTime < oneMonthAgo) continue;
        
        validPosts++;
        allPosts.push(post);
        
        const authorInfo = post.authorInfo || post.userInfo || {};
        const author = authorInfo.nickname || '匿名用户';
        
        if (!userPostData[author]) {
            userPostData[author] = { count: 0, lastPostTime: 0 };
        }
        
        userPostData[author].count++;
        if (createdTime > userPostData[author].lastPostTime) {
            userPostData[author].lastPostTime = createdTime;
        }
    }
    
    return validPosts;
}

// 更新进度条
function updateProgress(page, totalPages, currentPosts) {
    const percent = (page / totalPages) * 100;
    progressBarEl.style.width = `${percent}%`;
    progressTextEl.textContent = `正在获取第 ${page}/${totalPages} 页，已找到 ${currentPosts} 篇帖子`;
}

// 获取所有帖子
async function fetchAllPosts() {
    if (isLoading) {
        debugLog('已经在获取数据中', 'warn');
        return;
    }
    
    isLoading = true;
    loadingEl.style.display = 'block';
    userPostData = {};
    allPosts = [];
    currentPage = 1;
    currentProxyIndex = 0;
    
    debugLog('开始获取数据...');
    
    let hasMore = true;
    let success = false;
    
    try {
        while (hasMore && currentPage <= MAX_PAGES) {
            updateProgress(currentPage, MAX_PAGES, allPosts.length);
            
            const data = await fetchPosts(currentPage);
            if (!data) {
                throw new Error('获取数据失败');
            }
            
            const validPosts = processPageData(data);
            debugLog(`第 ${currentPage} 页找到 ${validPosts} 篇有效帖子`);
            
            if (validPosts === 0 || !data.data?.list || data.data.list.length === 0) {
                hasMore = false;
                debugLog('没有更多数据了');
            }
            
            currentPage++;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        success = true;
        
    } catch (error) {
        debugLog('获取数据过程中出错: ' + error.message, 'error');
        alert('获取数据失败: ' + error.message);
    } finally {
        loadingEl.style.display = 'none';
        isLoading = false;
        
        if (success && allPosts.length > 0) {
            saveToStorage();
            processData();
            alert(`数据获取完成，共获取 ${allPosts.length} 篇帖子`);
        } else if (!success) {
            alert('未能获取到数据，请检查网络或稍后重试');
        }
    }
}

// 处理和分析数据
function processData() {
    const userArray = Object.entries(userPostData)
        .map(([name, data]) => ({
            name,
            count: data.count,
            lastPostTime: data.lastPostTime
        }))
        .sort((a, b) => b.count - a.count);
    
    updateTable(userArray);
    updateCharts(userArray);
    debugLog(`数据处理完成，共 ${userArray.length} 位用户`);
}

// 更新表格数据
function updateTable(data) {
    tableBody.innerHTML = '';
    
    data.forEach((user, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${user.name}</td>
            <td>${user.count}</td>
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
        series: [{ data: top20.map(user => user.count) }]
    });
    
    const othersCount = data.slice(10).reduce((sum, user) => sum + user.count, 0);
    const distributionData = data.slice(0, 10).map(user => ({
        name: user.name,
        value: user.count
    }));
    
    if (othersCount > 0) {
        distributionData.push({ name: '其他用户', value: othersCount });
    }
    
    charts.postDistributionChart.setOption({
        series: [{ data: distributionData }]
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
    
    debugLog('页面初始化完成');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
