// 配置 - 替换为你的实际Vercel域名
const VERCEL_PROXY_URL = "https://yuzhouxing-yaquan.vercel.app/api/proxy";
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
    
    console.log('请求代理URL:', proxyUrl);
    
    try {
        const response = await fetch(proxyUrl, {
            signal: AbortSignal.timeout(15000) // 15秒超时
        });
        
        console.log('响应状态:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('错误详情:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('成功获取数据');
        return data;
        
    } catch (error) {
        console.error('获取数据失败:', error.name, error.message);
        
        // 显示详细错误信息给用户
        if (error.name === 'TimeoutError') {
            alert('请求超时，请稍后重试');
        } else if (error.message.includes('CORS')) {
            alert('跨域请求失败，请检查代理设置');
        } else {
            alert(`获取数据失败: ${error.message}`);
        }
        
        return null;
    }
}
