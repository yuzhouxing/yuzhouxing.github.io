<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kiomet玩家专属聊天室</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --primary: #2c3e50;
            --secondary: #3498db;
            --accent: #e74c3c;
            --light: #ecf0f1;
            --dark: #1a2530;
            --success: #2ecc71;
            --warning: #f39c12;
            --danger: #e74c3c;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        body {
            background: linear-gradient(135deg, #1a2530 0%, #2c3e50 100%);
            color: var(--light);
            line-height: 1.6;
            padding: 20px;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: rgba(26, 37, 48, 0.9);
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        
        header {
            text-align: center;
            padding: 40px 20px;
            background: linear-gradient(135deg, var(--secondary) 0%, #2980b9 100%);
        }
        
        h1 {
            font-size: 2.8rem;
            margin-bottom: 15px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .subtitle {
            font-size: 1.4rem;
            margin-bottom: 20px;
            opacity: 0.9;
        }
        
        .cta-button {
            display: inline-block;
            background: var(--light);
            color: var(--primary);
            padding: 12px 30px;
            border-radius: 30px;
            text-decoration: none;
            font-weight: bold;
            margin-top: 20px;
            transition: all 0.3s;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        
        .cta-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
        }
        
        section {
            padding: 40px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        h2 {
            color: var(--secondary);
            margin-bottom: 25px;
            display: flex;
            align-items: center;
            font-size: 1.8rem;
        }
        
        h2 i {
            margin-right: 15px;
        }
        
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 25px;
            margin-top: 30px;
        }
        
        .feature-card {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 25px;
            transition: all 0.3s;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .feature-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
            border-color: var(--secondary);
        }
        
        .feature-card h3 {
            color: var(--secondary);
            margin-bottom: 15px;
            display: flex;
            align-items: center;
        }
        
        .feature-card h3 i {
            margin-right: 10px;
        }
        
        .timeline {
            position: relative;
            max-width: 800px;
            margin: 0 auto;
        }
        
        .timeline::after {
            content: '';
            position: absolute;
            width: 6px;
            background: var(--secondary);
            top: 0;
            bottom: 0;
            left: 50%;
            margin-left: -3px;
            border-radius: 3px;
        }
        
        .timeline-item {
            padding: 10px 40px;
            position: relative;
            width: 50%;
            box-sizing: border-box;
        }
        
        .timeline-item:nth-child(odd) {
            left: 0;
        }
        
        .timeline-item:nth-child(even) {
            left: 50%;
        }
        
        .timeline-item::after {
            content: '';
            position: absolute;
            width: 20px;
            height: 20px;
            background: var(--light);
            border: 4px solid var(--secondary);
            border-radius: 50%;
            top: 15px;
            z-index: 1;
        }
        
        .timeline-item:nth-child(odd)::after {
            right: -12px;
        }
        
        .timeline-item:nth-child(even)::after {
            left: -12px;
        }
        
        .timeline-content {
            padding: 20px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .timeline-date {
            font-weight: bold;
            color: var(--secondary);
            margin-bottom: 5px;
        }
        
        .channels {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        
        .channel {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            transition: all 0.3s;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .channel:hover {
            transform: scale(1.03);
            border-color: var(--secondary);
        }
        
        .channel i {
            font-size: 2.5rem;
            color: var(--secondary);
            margin-bottom: 15px;
        }
        
        .alliances {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 15px;
            margin-top: 20px;
        }
        
        .alliance-badge {
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
            padding: 10px 20px;
            border-radius: 30px;
            font-weight: bold;
            display: flex;
            align-items: center;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        
        .alliance-badge i {
            margin-right: 8px;
        }
        
        footer {
            text-align: center;
            padding: 30px;
            background: rgba(0, 0, 0, 0.2);
            font-style: italic;
        }
        
        @media screen and (max-width: 768px) {
            .timeline::after {
                left: 31px;
            }
            
            .timeline-item {
                width: 100%;
                padding-left: 70px;
                padding-right: 25px;
            }
            
            .timeline-item:nth-child(even) {
                left: 0;
            }
            
            .timeline-item:nth-child(odd)::after, 
            .timeline-item:nth-child(even)::after {
                left: 19px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1><i class="fas fa-globe-asia"></i> 欢迎来到Kiomet玩家专属聊天室！</h1>
            <p class="subtitle">交流战术、分享战报、结识战友——无论你是萌新还是大佬，这里都欢迎你！</p>
            <a href="#join" class="cta-button">立即加入 <i class="fas fa-arrow-right"></i></a>
        </header>
        
        <section id="features">
            <h2><i class="fas fa-star"></i> 特色功能</h2>
            <div class="features">
                <div class="feature-card">
                    <h3><i class="fas fa-users"></i> 联盟基地</h3>
                    <p>为任意联盟开放入驻资格，入驻联盟可获得加密专属聊天分区。提供联盟发布官方文件的渠道，促进联盟间交流。</p>
                    <div class="alliances">
                        <span class="alliance-badge"><i class="fas fa-crown"></i> dictators</span>
                        <span class="alliance-badge"><i class="fas fa-flag-usa"></i> FSA</span>
                        <span class="alliance-badge"><i class="fas fa-space-shuttle"></i> EVE</span>
                        <span class="alliance-badge"><i class="fas fa-fire"></i> 天烬联盟</span>
                        <span class="alliance-badge"><i class="fas fa-shield-alt"></i> SBA</span>
                        <span class="alliance-badge"><i class="fas fa-dragon"></i> LOONG</span>
                    </div>
                </div>
                
                <div class="feature-card">
                    <h3><i class="fas fa-lock"></i> 专属范围</h3>
                    <p>不同于其他softbear论坛，该聊天室只服务于kiomet玩家，提供更专注、更高质量的交流环境。</p>
                </div>
                
                <div class="feature-card">
                    <h3><i class="fas fa-comments"></i> 活跃社区</h3>
                    <p>加入日益壮大的Kiomet玩家社区，与志同道合的玩家交流战术、分享经验、组队游戏。</p>
                </div>
            </div>
        </section>
        
        <section id="timeline">
            <h2><i class="fas fa-history"></i> 发展历程</h2>
            <div class="timeline">
                <div class="timeline-item">
                    <div class="timeline-content">
                        <div class="timeline-date">2025.8.3</div>
                        <p>KIOMET联盟聊天室建立</p>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-content">
                        <div class="timeline-date">2025.8.5</div>
                        <p>聊天室突破10人，加入联盟私密分区，达成首个联盟入驻成员10＋</p>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-content">
                        <div class="timeline-date">2025.8.6</div>
                        <p>入驻联盟达到3个，加入工具箱分区</p>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-content">
                        <div class="timeline-date">2025.8.8</div>
                        <p>聊天室突破20人，开启联盟发布会功能</p>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-content">
                        <div class="timeline-date">2025.8.9</div>
                        <p>入驻联盟达5个</p>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-content">
                        <div class="timeline-date">2025.8.16</div>
                        <p>聊天室突破50人</p>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-content">
                        <div class="timeline-date">2025.8.17</div>
                        <p>开启联盟档案功能</p>
                    </div>
                </div>
            </div>
        </section>
        
        <section id="channels">
            <h2><i class="fas fa-hashtag"></i> 推荐频道</h2>
            <div class="channels">
                <div class="channel">
                    <i class="fas fa-chess"></i>
                    <h3>战术研讨</h3>
                    <p>兵线、运营、对抗策略……欢迎分享你的心得！</p>
                </div>
                <div class="channel">
                    <i class="fas fa-chart-line"></i>
                    <h3>战报分享</h3>
                    <p>精彩对局复盘、经典战役分析，来展示你的高光时刻！</p>
                </div>
                <div class="channel">
                    <i class="fas fa-hands-helping"></i>
                    <h3>萌新互助</h3>
                    <p>新手问题集中营，老玩家可自愿担任指导员。</p>
                </div>
                <div class="channel">
                    <i class="fas fa-comment-dots"></i>
                    <h3>休闲灌水</h3>
                    <p>闲聊、趣事、游戏外话题，轻松交友区。</p>
                </div>
            </div>
        </section>
        
        <section id="join">
            <h2><i class="fas fa-door-open"></i> 加入我们</h2>
            <p style="text-align: center; margin-bottom: 30px;">无论你是Kiomet新手还是资深玩家，都欢迎加入我们的社区！</p>
            <div style="text-align: center;">
                <a href="#" class="cta-button">立即加入聊天室 <i class="fas fa-comments"></i></a>
            </div>
        </section>
        
        <footer>
            <p>祝大家聊天愉快，征战顺利！</p>
            <p>——本聊天室由玩家自发维护，独立于游戏官方</p>
        </footer>
    </div>

    <script>
        // 添加滚动动画效果
        document.addEventListener('DOMContentLoaded', function() {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = 1;
                        entry.target.style.transform = 'translateY(0)';
                    }
                });
            }, { threshold: 0.1 });
            
            // 观察所有部分和卡片
            document.querySelectorAll('section, .feature-card, .channel, .timeline-item').forEach(el => {
                el.style.opacity = 0;
                el.style.transform = 'translateY(20px)';
                el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                observer.observe(el);
            });
        });
    </script>
</body>
</html>
