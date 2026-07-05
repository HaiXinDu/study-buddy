/**
 * 学伴小管家 - 情绪日记模块
 *
 * 功能：
 *   - 基于 LocalStorage 的情绪日记增删改查（key: studybuddy_emotion_diary）
 *   - 支持按日期查询、限量获取最近日记
 *   - 简单中文分词（2-4 字滑窗）+ 停用词过滤，生成本周关键词词频
 *   - 本周日记摘要（数量、平均心情、主导情绪、关键词）
 *   - 一键导出为 JSON
 *
 * 数据结构（单条日记）：
 *   {
 *     id: number,            // 时间戳作为唯一 id
 *     date: 'YYYY-MM-DD',    // 自然日期
 *     timestamp: number,     // 毫秒时间戳
 *     text: string,          // 日记内容
 *     emotion: string,       // 情绪类型
 *     mood: number           // 1-5 心情评分
 *   }
 */

const EmotionDiary = {
  // ========== 配置 ==========
  STORAGE_KEY: 'studybuddy_emotion_diary',
  WEEK_DAYS: 7,
  MAX_KEYWORDS: 20,

  // 停用词集合（包含题目要求 + 常见高频无意义词）
  // 既支持整词过滤，也支持边界字符过滤（避免 "习数" 这类噪声词）
  stopWords: new Set([
    // 题目明确要求
    '的', '了', '是', '我', '今天', '等',
    // 常见单字停用词（用于边界过滤）
    '在', '有', '和', '就', '不', '都', '一', '上', '也', '很',
    '到', '说', '要', '去', '会', '着', '看', '把', '让', '被',
    '他', '她', '它', '你', '您', '们', '这', '那', '些', '么',
    '又', '还', '只', '才', '再', '已', '正', '将', '刚', '才',
    // 常见多字停用词（整词过滤）
    '什么', '没有', '可以', '一个', '觉得', '感觉', '因为', '所以',
    '但是', '还是', '然后', '现在', '怎么', '这样', '那样', '自己',
    '他们', '她们', '我们', '你们', '这个', '那个', '一些', '一直',
    '一样', '一下', '不过', '不要', '不能', '不会', '没有', '这种'
  ]),

  // ========== 内部工具 ==========

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  _formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /**
   * 从 LocalStorage 读取全部日记
   * @returns {Array} 日记数组
   */
  _readAll() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('[EmotionDiary] 读取数据失败', e);
      return [];
    }
  },

  /**
   * 持久化全部日记
   */
  _saveAll(entries) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.warn('[EmotionDiary] 保存数据失败', e);
    }
  },

  /**
   * 获取本周（最近 7 天）的日记
   * @returns {Array}
   */
  _getWeeklyEntries() {
    const entries = this._readAll();
    const weekAgo = Date.now() - this.WEEK_DAYS * 24 * 60 * 60 * 1000;
    return entries.filter(e => e.timestamp >= weekAgo);
  },

  // ========== 核心方法 ==========

  /**
   * 添加一条日记
   * @param {string} text    - 日记内容
   * @param {string} emotion - 情绪类型（如 happy / anxious 等）
   * @param {number} mood    - 1-5 心情评分
   * @returns {Object} 新建的日记条目
   */
  addEntry(text, emotion, mood) {
    const entries = this._readAll();
    const now = new Date();

    // 规范化 mood 到 1-5
    let moodVal = parseInt(mood, 10);
    if (isNaN(moodVal)) moodVal = 3;
    moodVal = Math.max(1, Math.min(5, moodVal));

    const entry = {
      id: now.getTime(),
      date: this._formatDate(now),
      timestamp: now.getTime(),
      text: String(text || ''),
      emotion: String(emotion || 'neutral'),
      mood: moodVal
    };

    entries.push(entry);
    this._saveAll(entries);
    return entry;
  },

  /**
   * 获取最近的日记
   * @param {number} [limit=50] - 返回条数上限
   * @returns {Array} 按时间倒序排列的日记
   */
  getEntries(limit = 50) {
    const entries = this._readAll();
    const sorted = entries.slice().sort((a, b) => b.timestamp - a.timestamp);
    const n = Math.max(0, parseInt(limit, 10) || 0);
    return n > 0 ? sorted.slice(0, n) : sorted;
  },

  /**
   * 获取某一天的日记
   * @param {string} date - 'YYYY-MM-DD' 格式日期
   * @returns {Array} 当天日记，按时间倒序
   */
  getEntriesByDate(date) {
    const entries = this._readAll();
    return entries
      .filter(e => e.date === date)
      .sort((a, b) => b.timestamp - a.timestamp);
  },

  /**
   * 删除一条日记
   * @param {number} id - 日记 id（时间戳）
   * @returns {boolean} 是否删除成功
   */
  deleteEntry(id) {
    const entries = this._readAll();
    const before = entries.length;
    const filtered = entries.filter(e => e.id !== id);
    if (filtered.length < before) {
      this._saveAll(filtered);
      return true;
    }
    return false;
  },

  // ========== 关键词 / 词云 ==========

  /**
   * 生成本周日记关键词统计
   * 使用简单的中文分词（2-4 字滑窗），统计词频，过滤停用词
   * @returns {Array<{word: string, count: number}>} 前 20 个关键词（按词频降序）
   */
  generateWordCloud() {
    const entries = this._getWeeklyEntries();
    if (entries.length === 0) return [];

    // 合并本周所有日记文本
    const allText = entries.map(e => e.text || '').join('');

    // 分词
    const tokens = this._segment(allText);

    // 统计词频
    const freq = {};
    for (const w of tokens) {
      // 整词停用词过滤
      if (this.stopWords.has(w)) continue;
      // 边界字符过滤：首尾为单字停用词的词跳过（减少 "习数" 这类噪声）
      if (w.length >= 2 && (this.stopWords.has(w[0]) || this.stopWords.has(w[w.length - 1]))) continue;
      // 过滤纯数字 / 纯英文短串（保留中文为主的关键词）
      if (/^[\d\s]+$/.test(w)) continue;
      freq[w] = (freq[w] || 0) + 1;
    }

    // 排序取前 N
    return Object.entries(freq)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
      .slice(0, this.MAX_KEYWORDS);
  },

  /**
   * 简单中文分词：按 2-4 字滑窗切分
   * 仅保留中文字符片段，剔除标点、空格、英文、数字
   * @param {string} text
   * @returns {Array<string>} 切分出的词
   */
  _segment(text) {
    if (!text) return [];
    const words = [];

    // 仅保留中文，按非中文字符切分成片段
    // [\u4e00-\u9fa5] 为 CJK 统一汉字范围
    const chunks = text.split(/[^\u4e00-\u9fa5]+/).filter(Boolean);

    for (const chunk of chunks) {
      const len = chunk.length;
      for (let i = 0; i < len; i++) {
        // 滑窗长度 2、3、4
        for (let w = 2; w <= 4; w++) {
          if (i + w <= len) {
            words.push(chunk.slice(i, i + w));
          }
        }
      }
    }
    return words;
  },

  // ========== 摘要 ==========

  /**
   * 生成本周日记摘要
   * @returns {Object} { count, avgMood, dominantEmotion, keywords }
   */
  getWeeklySummary() {
    const entries = this._getWeeklyEntries();

    if (entries.length === 0) {
      return {
        count: 0,
        avgMood: 0,
        dominantEmotion: null,
        keywords: []
      };
    }

    // 平均心情评分
    const moodSum = entries.reduce((s, e) => s + (typeof e.mood === 'number' ? e.mood : 0), 0);
    const avgMood = Math.round((moodSum / entries.length) * 10) / 10;

    // 主导情绪（出现次数最多的情绪）
    const emotionCount = {};
    entries.forEach(e => {
      const emo = e.emotion || 'neutral';
      emotionCount[emo] = (emotionCount[emo] || 0) + 1;
    });
    let dominantEmotion = null;
    let maxCount = 0;
    for (const [emo, cnt] of Object.entries(emotionCount)) {
      if (cnt > maxCount) {
        maxCount = cnt;
        dominantEmotion = emo;
      }
    }

    // 关键词（取前 10 作为摘要展示）
    const wordCloud = this.generateWordCloud();
    const keywords = wordCloud.slice(0, 10).map(item => item.word);

    return {
      count: entries.length,
      avgMood,
      dominantEmotion,
      keywords
    };
  },

  // ========== 导出 ==========

  /**
   * 导出全部日记为 JSON 字符串
   * @param {boolean} [pretty=true] - 是否格式化输出
   * @returns {string} JSON 字符串
   */
  exportDiary(pretty = true) {
    const entries = this._readAll();
    const payload = {
      module: 'study-buddy-ai EmotionDiary',
      exportedAt: new Date().toISOString(),
      count: entries.length,
      entries: entries.slice().sort((a, b) => a.timestamp - b.timestamp)
    };
    return pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
  },

  /**
   * 导出并触发浏览器下载（若在浏览器环境）
   * @returns {string} JSON 字符串（非浏览器环境直接返回）
   */
  exportDiaryDownload() {
    const json = this.exportDiary(true);
    if (typeof document !== 'undefined' && typeof Blob !== 'undefined') {
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const today = this._formatDate(new Date());
      a.href = url;
      a.download = `学伴情绪日记_${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return json;
  },

  // ========== 维护方法 ==========

  /**
   * 获取全部日记总数
   * @returns {number}
   */
  count() {
    return this._readAll().length;
  },

  /**
   * 清空所有日记（谨慎调用）
   */
  clear() {
    this._saveAll([]);
  }
};

// 兼容 CommonJS 模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EmotionDiary };
}
