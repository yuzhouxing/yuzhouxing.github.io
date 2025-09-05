// 配置
const COMMUNITY_ID = 4353;
const MAX_PAGES = 20;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// Vercel代理地址 - 替换为你的Vercel域名
const VERCEL_PROXY_URL = "https://your-vercel-app.vercel.app/api/proxy";

// 全局变量和其余代码保持不变...

// 修改fetchPosts函数
async function fetchPosts(page) {
    const targetUrl = `https://m.ximalaya.com/community/v2/communities/${COMMUNITY_ID}/articles`;
    const params = {
        communityId: COMMUNITY_ID,
        pageId: page,
        orderBy: 2,
        includeTotalCount: "true"
    };
    
    const fullUrl = `${targetUrl}?${new URLSearchParams(params)}`;
    const proxyUrl = `${VERCEL_PROXY_URL}?url=${encodeURIComponent(fullUrl)}`;
    
    console.log('请求URL:', proxyUrl);
    
    try {
        // 添加随机延迟
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
        
        const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        console.log('响应状态:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('错误响应:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('获取到数据:', data);
        return data;
        
    } catch (error) {
        console.error('获取数据失败:', error);
        return null;
    }
}
