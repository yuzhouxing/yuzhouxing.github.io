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
    
    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('请求失败');
        return await response.json();
    } catch (error) {
        console.error('获取数据失败:', error);
        return null;
    }
}
