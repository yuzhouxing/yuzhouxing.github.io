// 配置
const COMMUNITY_ID = 4353;
const MAX_PAGES = 20; // 减少页数以提高性能
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// 全局变量
let userPostData = {};
let allPosts = [];
let currentPage = 1;
let isLoading = false;
let jsonpCallbackId = 0;

// DOM元素
const refreshBtn = document.getElementById('refreshBtn');
const lastUpdateEl = document.getElementById('lastUpdate');
const loadingEl = document.getElementById('loading');
const progressTextEl = document.getElementById('progressText');
const progressBarEl = document.querySelector('.progress');
const tableBody = document.querySelector('#dataTable tbody');

// 初始化图表
const userRankChart = echarts.init(document.getElementById('userRankChart'));
const postDistributionChart = echarts.init(document.getElementById('postDistributionChart'));

// 设置图表默认选项
userRankChart.setOption({
    title: {
        text: '用户发帖数量排名(TOP20)',
        left: 'center'
    },
    tooltip: {
        trigger: 'axis',
        axisPointer: {
            type: 'shadow'
        }
    },
    xAxis: {
        type: 'value'
    },
    yAxis: {
        type: 'category',
        data: []
    },
    series: [{
        name: '发帖数',
        type: 'bar',
        data: [],
        itemStyle: {
            color: '#ff6a33'
        }
    }]
});

postDistributionChart.setOption({
    title: {
        text: '发帖分布情况',
        left: 'center'
    },
    tooltip: {
        trigger: 'item'
    },
    series: [{
        name: '发帖分布',
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

// 从本地存储加载数据
function loadFromStorage() {
    const savedData = localStorage.getItem('yaquanData');
    const savedTime = localStorage.getItem('yaquanUpdateTime');
    
    if (savedData && savedTime) {
        const updateTime = new Date(parseInt(savedTime));
        lastUpdateEl.textContent = `上次更新: ${updateTime.toLocaleString()}`;
        
        // 检查数据是否在一个月内
        if (Date.now() - updateTime.getTime() < ONE_MONTH_MS) {
            userPostData = JSON.parse(savedData);
            processData();
            return true;
        }
    }
    return false;
}

// 保存数据到本地存储
function saveToStorage() {
    localStorage.setItem('yaquanData', JSON.stringify(userPostData));
    localStorage.setItem('yaquanUpdateTime', Date.now().toString());
    lastUpdateEl.textContent = `上次更新: ${new Date().toLocaleString()}`;
}

// JSONP请求函数
function jsonpRequest(url, params, callback) {
    return new Promise((resolve, reject) => {
        const callbackName = `jsonpCallback_${jsonpCallbackId++}_${Date.now()}`;
        
        // 创建script标签
        const script = document.createElement('script');
        
        // 添加参数
        params.callback = callbackName;
        
        // 构建URL
        const queryString = Object.keys(params)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');
        
        script.src = `${url}?${queryString}`;
        
        // 设置超时
        const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('JSONP request timeout'));
        }, 10000);
        
        // 定义全局回调函数
        window[callbackName] = (data) => {
            cleanup();
            resolve(data);
        };
        
        // 清理函数
        function cleanup() {
            clearTimeout(timeoutId);
            document.head.removeChild(script);
            delete window[callbackName];
        }
        
        // 错误处理
        script.onerror = () => {
            cleanup();
            reject(new Error('JSONP request failed'));
        };
        
        // 添加到文档
        document.head.appendChild(script);
    });
}

// 获取帖子数据 - JSONP版本
async function fetchPosts(page) {
    const url = `https://m.ximalaya.com/community/v2/communities/${COMMUNITY_ID}/articles`;
    const params = {
        communityId: COMMUNITY_ID,
        pageId: page,
        orderBy: 2,
        includeTotalCount: "true"
    };
    
    try {
        // 添加随机延迟
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
        
        const data = await jsonpRequest(url, params, 'callback');
        return data;
    } catch (error) {
        console.error('JSONP请求失败:', error);
        return null;
    }
}

// 处理单页数据
function processPageData(data) {
    if (!data || !data.data || !data.data.list) return 0;
    
    const posts = data.data.list;
    let validPosts = 0;
    const now = Date.now();
    const oneMonthAgo = now - ONE_MONTH_MS;
    
    for (const post of posts) {
        // 只统计一个月内的帖子
        const createdTime = post.createdTs || post.createTime;
        if (!createdTime || createdTime < oneMonthAgo) continue;
        
        validPosts++;
        allPosts.push(post);
        
        const authorInfo = post.authorInfo || post.userInfo || {};
        const author = authorInfo.nickname || '匿名用户';
        
        if (!userPostData[author]) {
            userPostData[author] = {
                count: 0,
                lastPostTime: 0
            };
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
    if (isLoading) return;
    
    isLoading = true;
    loadingEl.style.display = 'block';
    userPostData = {};
    allPosts = [];
    currentPage = 1;
    
    let hasMore = true;
    let successCount = 0;
    
    while (hasMore && currentPage <= MAX_PAGES) {
        updateProgress(currentPage, MAX_PAGES, allPosts.length);
        
        const data = await fetchPosts(currentPage);
        
        if (data) {
            successCount++;
            const validPosts = processPageData(data);
            
            // 检查是否还有更多数据
            if (validPosts === 0 || !data.data || !data.data.list || data.data.list.length === 0) {
                hasMore = false;
            }
        } else {
            console.warn(`第 ${currentPage} 页获取失败`);
        }
        
        currentPage++;
        
        // 添加延迟以避免请求过于频繁
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));
    }
    
    loadingEl.style.display = 'none';
    isLoading = false;
    
    if (allPosts.length > 0) {
        saveToStorage();
        processData();
        alert(`数据获取完成，成功获取 ${successCount}/${MAX_PAGES} 页，共 ${allPosts.length} 篇帖子`);
    } else {
        alert('未能获取到数据，请刷新重试。可能原因：API不支持JSONP或已更改');
    }
}

// 处理和分析数据
function processData() {
    // 转换为数组并排序
    const userArray = Object.entries(userPostData)
        .map(([name, data]) => ({
            name,
            count: data.count,
            lastPostTime: data.lastPostTime
        }))
        .sort((a, b) => b.count - a.count);
    
    // 更新表格
    updateTable(userArray);
    
    // 更新图表
    updateCharts(userArray);
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
    // 用户排名图表 (TOP20)
    const top20 = data.slice(0, 20);
    userRankChart.setOption({
        yAxis: {
            data: top20.map(user => user.name)
        },
        series: [{
            data: top20.map(user => user.count)
        }]
    });
    
    // 发帖分布图表
    const othersCount = data.slice(10).reduce((sum, user) => sum + user.count, 0);
    const distributionData = data.slice(0, 10).map(user => ({
        name: user.name,
        value: user.count
    }));
    
    if (othersCount > 0) {
        distributionData.push({
            name: '其他用户',
            value: othersCount
        });
    }
    
    postDistributionChart.setOption({
        series: [{
            data: distributionData
        }]
    });
}

// 初始化
function init() {
    // 尝试从本地存储加载数据
    if (!loadFromStorage()) {
        // 如果没有本地数据或数据已过期，显示提示
        lastUpdateEl.textContent = '数据已过期，请点击刷新按钮更新数据';
    }
    
    // 绑定刷新按钮事件
    refreshBtn.addEventListener('click', fetchAllPosts);
    
    // 窗口调整大小时重绘图表
    window.addEventListener('resize', () => {
        userRankChart.resize();
        postDistributionChart.resize();
    });
    
    // 添加使用说明
    const infoDiv = document.createElement('div');
    infoDiv.style.marginTop = '20px';
    infoDiv.style.padding = '15px';
    infoDiv.style.backgroundColor = '#fff3cd';
    infoDiv.style.border = '1px solid #ffeaa7';
    infoDiv.style.borderRadius = '5px';
    infoDiv.innerHTML = `
        <h3>使用说明：</h3>
        <p>1. 点击"刷新数据"按钮开始获取最新数据</p>
        <p>2. 数据会保存在浏览器本地，下次访问自动加载</p>
        <p>3. 如果获取失败，可能是喜马拉雅API不支持JSONP方式</p>
    `;
    document.querySelector('.container').appendChild(infoDiv);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentContentLoaded', init);
