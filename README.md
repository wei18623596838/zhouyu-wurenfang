# 周瑜无人房 - 部署说明

## 文件结构
```
website/
├── server.js          # 后端服务
├── package.json       # 项目配置
├── data/              # 数据存储目录
│   ├── users.json     # 用户数据
│   ├── cards.json     # 卡密数据
│   ├── orders.json    # 订单数据
│   └── products.json  # 商品分类和商品数据
└── public/            # 前端页面
    ├── index.html     # 用户购买端（前台）
    └── admin.html     # 管理后台
```

## 部署步骤

### 1. 安装Node.js
服务器上需要安装 Node.js 16+ 版本

### 2. 上传文件
把整个 website 文件夹上传到服务器

### 3. 安装依赖
```bash
cd website
npm install
```

### 4. 启动服务
```bash
npm start
```
默认运行在 3000 端口

### 5. 配置域名
把 周瑜无人房.com 解析到你的服务器IP，然后用Nginx反向代理到3000端口

### Nginx配置示例
```nginx
server {
    listen 80;
    server_name 周瑜无人房.com www.周瑜无人房.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 访问地址
- 前台（用户购买）：http://域名/  或 http://域名/index.html
- 后台（管理）：http://域名/admin.html

## 数据备份
直接备份 data/ 目录下的4个JSON文件即可。
