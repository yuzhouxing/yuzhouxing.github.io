// api/proxy.js - 修复版
export default async function handler(req, res) {
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, User-Agent, Referer');
    return res.status(200).end();
  }

  // 只允许GET请求
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const targetUrl = decodeURIComponent(url);
    console.log('Proxying to:', targetUrl);
    
    const apiResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://m.ximalaya.com/',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 10000
    });

    if (!apiResponse.ok) {
      throw new Error(`API responded with status ${apiResponse.status}`);
    }

    const data = await apiResponse.json();

    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ 
      error: 'Proxy request failed',
      message: error.message,
      url: req.query.url
    });
  }
}
