const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const files = {
  users: path.join(DATA_DIR, 'users.json'),
  cards: path.join(DATA_DIR, 'cards.json'),
  orders: path.join(DATA_DIR, 'orders.json'),
  products: path.join(DATA_DIR, 'products.json')
};

// 初始化空JSON文件
Object.values(files).forEach(f => {
  if (!fs.existsSync(f)) fs.writeFileSync(f, '[]');
});

function readDB(name) {
  try { return JSON.parse(fs.readFileSync(files[name], 'utf8')); }
  catch { return []; }
}
function writeDB(name, data) {
  fs.writeFileSync(files[name], JSON.stringify(data, null, 2));
}

// ========== 用户接口 ==========
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ ok: false, msg: '账号密码不能为空' });
  const users = readDB('users');
  if (users.find(u => u.username === username)) return res.json({ ok: false, msg: '账号已存在' });
  users.push({ id: Date.now(), username, password, balance: 0, createdAt: new Date().toISOString() });
  writeDB('users', users);
  res.json({ ok: true, msg: '注册成功' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readDB('users');
  const u = users.find(x => x.username === username && x.password === password);
  if (!u) return res.json({ ok: false, msg: '账号或密码错误' });
  res.json({ ok: true, user: { username: u.username, balance: u.balance } });
});

app.post('/api/recharge', (req, res) => {
  const { username, code } = req.body;
  const cards = readDB('cards');
  const card = cards.find(c => c.code.toUpperCase() === code.toUpperCase());
  if (!card) return res.json({ ok: false, msg: '卡密不存在' });
  if (card.usedCount >= card.maxUses) return res.json({ ok: false, msg: '卡密已用完' });
  if (card.expireAt && new Date(card.expireAt) < new Date()) return res.json({ ok: false, msg: '卡密已过期' });
  const usedBy = card.usedBy[username] || 0;
  if (usedBy >= card.perUserLimit) return res.json({ ok: false, msg: '该卡密你已使用过' });

  const users = readDB('users');
  const u = users.find(x => x.username === username);
  u.balance += card.value;
  card.usedCount++;
  card.usedBy[username] = usedBy + 1;
  writeDB('users', users);
  writeDB('cards', cards);
  res.json({ ok: true, balance: u.balance, msg: `充值成功 +¥${card.value}` });
});

// ========== 商品接口 ==========
app.get('/api/products', (req, res) => {
  res.json({ ok: true, data: readDB('products') });
});

app.post('/api/category', (req, res) => {
  const { name } = req.body;
  if (!name) return res.json({ ok: false, msg: '分类名不能为空' });
  const products = readDB('products');
  if (products.find(c => c.name === name)) return res.json({ ok: false, msg: '分类已存在' });
  products.push({ id: 'cat_' + Date.now(), name, products: [] });
  writeDB('products', products);
  res.json({ ok: true });
});

app.delete('/api/category/:id', (req, res) => {
  let products = readDB('products');
  products = products.filter(c => c.id !== req.params.id);
  writeDB('products', products);
  res.json({ ok: true });
});

app.post('/api/product', (req, res) => {
  const { catId, name, price, stock } = req.body;
  const products = readDB('products');
  const cat = products.find(c => c.id === catId);
  if (!cat) return res.json({ ok: false, msg: '分类不存在' });
  cat.products.push({ id: 'prod_' + Date.now(), name, price, stock });
  writeDB('products', products);
  res.json({ ok: true });
});

app.delete('/api/product/:catId/:prodId', (req, res) => {
  const products = readDB('products');
  const cat = products.find(c => c.id === req.params.catId);
  if (cat) cat.products = cat.products.filter(p => p.id !== req.params.prodId);
  writeDB('products', products);
  res.json({ ok: true });
});

app.post('/api/restock', (req, res) => {
  const { catId, prodId, count } = req.body;
  const products = readDB('products');
  const cat = products.find(c => c.id === catId);
  const prod = cat && cat.products.find(p => p.id === prodId);
  if (!prod) return res.json({ ok: false, msg: '商品不存在' });
  prod.stock += count;
  writeDB('products', products);
  res.json({ ok: true });
});

// ========== 订单接口 ==========
app.get('/api/orders', (req, res) => {
  res.json({ ok: true, data: readDB('orders') });
});

app.post('/api/order', (req, res) => {
  const { username, productId, qty, idType, idValue } = req.body;
  const products = readDB('products');
  let prod = null;
  products.forEach(c => c.products.forEach(p => { if (p.id === productId) prod = p; }));
  if (!prod) return res.json({ ok: false, msg: '商品不存在' });
  if (prod.stock < qty) return res.json({ ok: false, msg: '库存不足' });

  const total = prod.price * qty;
  const users = readDB('users');
  const u = users.find(x => x.username === username);
  if (u.balance < total) return res.json({ ok: false, msg: '余额不足，请先充值' });

  u.balance -= total;
  prod.stock -= qty;

  const orders = readDB('orders');
  orders.push({
    id: 'order_' + Date.now(),
    username, productName: prod.name, price: prod.price,
    qty, total, idType, idValue,
    status: 'pending', createdAt: new Date().toISOString()
  });

  writeDB('users', users);
  writeDB('products', products);
  writeDB('orders', orders);
  res.json({ ok: true, balance: u.balance });
});

app.post('/api/order/complete/:id', (req, res) => {
  const orders = readDB('orders');
  const o = orders.find(x => x.id === req.params.id);
  if (o) o.status = 'completed';
  writeDB('orders', orders);
  res.json({ ok: true });
});

app.post('/api/order/confirm/:id', (req, res) => {
  let orders = readDB('orders');
  orders = orders.filter(o => o.id !== req.params.id);
  writeDB('orders', orders);
  res.json({ ok: true });
});

// ========== 卡密接口 ==========
app.get('/api/cards', (req, res) => {
  res.json({ ok: true, data: readDB('cards') });
});

app.post('/api/cards/generate', (req, res) => {
  const { count, value, expireAt, maxUses, perUserLimit } = req.body;
  const cards = readDB('cards');
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const chars = letters + digits;

  function genCode() {
    let code = 'ZY-';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    code += '-';
    for (let i = 0; i < 4; i++) code += letters[Math.floor(Math.random() * letters.length)];
    code += '-';
    for (let i = 0; i < 4; i++) code += digits[Math.floor(Math.random() * digits.length)];
    return code;
  }

  let made = [];
  for (let i = 0; i < count; i++) {
    let code = genCode();
    while (cards.find(c => c.code === code)) code = genCode();
    cards.push({
      id: 'card_' + Date.now() + '_' + i,
      code, value, expireAt, maxUses, perUserLimit,
      usedCount: 0, usedBy: {}, createdAt: new Date().toISOString()
    });
    made.push(code);
  }
  writeDB('cards', cards);
  res.json({ ok: true, cards: made });
});

app.put('/api/cards/:id', (req, res) => {
  const { value, expireAt, maxUses, perUserLimit } = req.body;
  const cards = readDB('cards');
  const c = cards.find(x => x.id === req.params.id);
  if (c) { c.value = value; c.expireAt = expireAt; c.maxUses = maxUses; c.perUserLimit = perUserLimit; }
  writeDB('cards', cards);
  res.json({ ok: true });
});

app.post('/api/cards/batch-delete', (req, res) => {
  const { ids } = req.body;
  let cards = readDB('cards');
  cards = cards.filter(c => !ids.includes(c.id));
  writeDB('cards', cards);
  res.json({ ok: true });
});

app.get('/api/users', (req, res) => {
  res.json({ ok: true, data: readDB('users') });
});

app.listen(PORT, () => {
  console.log(`周瑜无人房服务已启动: http://localhost:${PORT}`);
});
