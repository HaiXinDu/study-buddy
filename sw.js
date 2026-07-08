// 学伴小管家 - Service Worker
// 缓存策略: Cache First（优先缓存，回退网络）

// 缓存版本名称
const CACHE_NAME = 'studybuddy-v19';

// 需要预缓存的文件列表
const PRECACHE_FILES = [
  './index.html',
  './ai-engine/emotion-dictionary.js',
  './ai-engine/reply-templates.js',
  './ai-engine/emotion-classifier.js',
  './ai-engine/emotion_model.json',
  './ai-engine/chinese_words.json',
  './ai-engine/study-planner.js',
  './ai-engine/emotion-tracker.js',
  './ai-engine/achievement.js',
  './ai-engine/proactive-care.js',
  './ai-engine/mood-card.js',
  './ai-engine/study-advisor.js',
  './ai-engine/word-analyzer.js',
  './ai-engine/weekly-report.js',
  './ai-engine/emotion-worker.js',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js@4'
];

// 安装事件：预缓存所有核心文件
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_FILES);
    })
  );
  // 立即激活，不等待旧 SW 退出
  self.skipWaiting();
});

// 激活事件：清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  // 立即接管所有客户端页面
  self.clients.claim();
});

// 请求拦截：同源 cache-first，跨源 network-first
self.addEventListener('fetch', (event) => {
  // 仅处理 GET 请求，其余交由浏览器默认处理
  if (event.request.method !== 'GET') {
    return;
  }

  const isSameOrigin = new URL(event.request.url).origin === self.location.origin;

  if (isSameOrigin) {
    // 同源请求：cache-first（优先缓存，回退网络）
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          // 缓存成功的同源响应
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      }).catch(() => {
        // 网络和缓存都失败时，返回离线提示页
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      })
    );
  } else {
    // 跨源请求：network-first（先网络，失败再回退缓存）
    // 跨源 opaque response 缓存后无法读取，故仅缓存可读取的成功响应
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // 网络失败，回退缓存
        return caches.match(event.request);
      })
    );
  }
});












