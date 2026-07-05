/**
 * 学伴小管家 - AI 主动关怀
 * 根据时间、情绪历史、使用模式主动推送关怀消息
 *
 * 功能：
 *   - 时间关怀：深夜提醒、早晨问候、考前鼓励
 *   - 情绪关怀：连续低落预警、情绪好转鼓励
 *   - 使用关怀：连续使用天数鼓励
 *   - 用户可关闭（dismiss）某条关怀，状态持久化到 localStorage
 */

const ProactiveCare = {
  // ========== 存储键 ==========
  DISMISSED_KEY: 'studybuddy_dismissed_care',

  // ========== 内部状态 ==========
  _dismissed: {},     // { id: true } 已关闭的关怀 id 集合

  // ========== 初始化 ==========

  /**
   * 初始化关怀系统，从 localStorage 加载已关闭的消息列表
   */
  init() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.DISMISSED_KEY)) || {};
      this._dismissed = saved.dismissed || {};
      console.log('[ProactiveCare] 初始化完成，已关闭:', Object.keys(this._dismissed).length, '条关怀');
    } catch (e) {
      console.warn('[ProactiveCare] 数据加载失败', e);
      this._dismissed = {};
    }
  },

  /**
   * 保存数据到 localStorage
   */
  _save() {
    localStorage.setItem(this.DISMISSED_KEY, JSON.stringify({
      dismissed: this._dismissed
    }));
  },

  /**
   * 生成基于日期的唯一 id（同一天的同一规则只产生相同 id）
   * @param {string} type - 关怀类型
   * @param {string} suffix - 后缀（可选）
   * @returns {string}
   */
  _makeId(type, suffix = '') {
    const today = this._getTodayStr();
    return `care_${today}_${type}${suffix ? '_' + suffix : ''}`;
  },

  /**
   * 获取今天的日期字符串
   */
  _getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  // ========== 综合检查 ==========

  /**
   * 综合检查所有关怀条件，返回需要显示的消息数组
   * @param {object} options - 可选参数
   * @param {Array}  options.emotionHistory - 情绪历史记录（来自 EmotionTracker）
   * @param {Array}  options.usageHistory   - 使用天数历史（来自 AchievementSystem）
   * @param {Array}  options.examDates      - 考试日期列表 [{ date: 'YYYY-MM-DD', subject: '数学' }]
   * @returns {Array} 需要显示的关怀消息数组 [{ id, type, title, content, priority, icon }]
   */
  check(options = {}) {
    const messages = [];

    // 检查时间关怀
    messages.push(...this.checkTimeCare(options.examDates));

    // 检查情绪关怀（需要情绪历史数据）
    messages.push(...this.checkEmotionCare(options.emotionHistory));

    // 检查使用关怀（需要使用历史数据）
    messages.push(...this.checkStreakCare(options.usageHistory));

    // 按优先级降序排列
    messages.sort((a, b) => b.priority - a.priority);

    return messages;
  },

  // ========== 时间关怀 ==========

  /**
   * 根据当前时间推送关怀消息
   * @param {Array} examDates - 考试日期列表（可选）
   * @returns {Array} 关怀消息数组
   */
  checkTimeCare(examDates = []) {
    const messages = [];
    const now = new Date();
    const hour = now.getHours();

    // —— 深夜关怀 (23:00-01:00) ——
    if (hour >= 23 || hour < 1) {
      const id = this._makeId('night');
      if (!this.isDismissed(id)) {
        messages.push({
          id,
          type: 'time',
          title: '夜深了',
          content: '夜深了，该休息了。熬夜会加重焦虑和低落情绪。',
          priority: 5,
          icon: '🌙'
        });
      }
    }

    // —— 清晨关怀 (06:00-07:00) ——
    if (hour >= 6 && hour < 7) {
      const id = this._makeId('morning');
      if (!this.isDismissed(id)) {
        messages.push({
          id,
          type: 'time',
          title: '早上好',
          content: '早上好！新的一天开始了，今天也要加油！',
          priority: 3,
          icon: '☀️'
        });
      }
    }

    // —— 考前关怀（考试前一天） ——
    if (Array.isArray(examDates) && examDates.length > 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

      examDates.forEach((exam, idx) => {
        if (exam.date === tomorrowStr) {
          const id = this._makeId('exam', exam.subject || idx);
          if (!this.isDismissed(id)) {
            messages.push({
              id,
              type: 'time',
              title: '考前提醒',
              content: exam.subject
                ? `明天就是${exam.subject}考试了，今晚早点休息，你已经准备得很好了。`
                : '明天就是考试了，今晚早点休息，你已经准备得很好了。',
              priority: 6,
              icon: '📝'
            });
          }
        }
      });
    }

    return messages;
  },

  // ========== 情绪关怀 ==========

  /**
   * 根据情绪历史推送关怀消息
   * 依赖 EmotionTracker.getAllRecords() 或 getRecentRecords() 提供的数据
   * @param {Array} emotionHistory - 情绪记录数组，每项包含 { date, emotion } 字段
   * @returns {Array} 关怀消息数组
   */
  checkEmotionCare(emotionHistory = []) {
    const messages = [];

    // —— 连续低落预警：复用 EmotionTracker.checkWarning() 的结果，避免与 reply-templates.js 重复判定 ——
    try {
      if (typeof EmotionTracker !== 'undefined' && typeof EmotionTracker.checkWarning === 'function') {
        const warning = EmotionTracker.checkWarning();
        if (warning && warning.type === 'persistent_low') {
          const id = this._makeId('persistent_low');
          if (!this.isDismissed(id)) {
            messages.push({
              id,
              type: 'emotion',
              title: '持续低落提醒',
              content: warning.message || '我注意到你最近心情持续低落，已经连续3天了。请一定要和信任的人聊一聊。',
              priority: 8,
              icon: '❤️'
            });
          }
        }
      }
    } catch (e) {
      console.warn('[ProactiveCare] 调用 EmotionTracker.checkWarning 失败', e);
    }

    // —— 情绪好转鼓励：需要情绪历史数据 ——
    if (!Array.isArray(emotionHistory) || emotionHistory.length < 2) {
      return messages;
    }

    const negativeEmotions = ['depressed', 'crisis'];
    const positiveEmotions = ['happy', 'positive'];

    const recent5 = emotionHistory.slice(-5);
    const dailyMap = {};

    recent5.forEach(r => {
      if (!dailyMap[r.date]) dailyMap[r.date] = r.emotion;
      // 如果同一天有多次记录，低落优先
      if (negativeEmotions.includes(r.emotion)) {
        dailyMap[r.date] = r.emotion;
      }
    });

    const dates = Object.keys(dailyMap).sort();

    if (dates.length >= 2) {
      const latestDate = dates[dates.length - 1];
      const latestEmotion = dailyMap[latestDate];
      const prevEmotion = dailyMap[dates[dates.length - 2]];

      if (
        positiveEmotions.includes(latestEmotion) &&
        negativeEmotions.includes(prevEmotion)
      ) {
        const id = this._makeId('mood_improved');
        if (!this.isDismissed(id)) {
          messages.push({
            id,
            type: 'emotion',
            title: '心情好转了',
            content: '看到你今天心情好转了，真为你高兴！这种转变很了不起。',
            priority: 4,
            icon: '🌈'
          });
        }
      }
    }

    return messages;
  },

  // ========== 使用关怀 ==========

  /**
   * 根据连续使用天数推送关怀消息
   * @param {Array} usageHistory - 使用天数历史（日期字符串数组），可选
   * @returns {Array} 关怀消息数组
   */
  checkStreakCare(usageHistory = []) {
    const messages = [];

    // 如果没有传入历史数据，从 EmotionTracker 的记录日期计算真实使用天数
    if (!usageHistory || usageHistory.length === 0) {
      try {
        const trackerData = JSON.parse(localStorage.getItem('studybuddy_emotion_log')) || [];
        if (Array.isArray(trackerData) && trackerData.length > 0) {
          usageHistory = [...new Set(trackerData.map(r => r.date))];
        }
      } catch (e) {
        // 忽略解析错误
      }
    }

    if (!Array.isArray(usageHistory) || usageHistory.length === 0) {
      return messages;
    }

    // 计算连续使用天数
    const uniqueDates = [...new Set(usageHistory)].sort().reverse();
    const today = this._getTodayStr();
    const yesterday = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
      return messages;
    }

    let streak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = new Date(uniqueDates[i - 1]);
      const currDate = new Date(uniqueDates[i]);
      const diffDays = (prevDate - currDate) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }

    // —— 连续3天使用 ——
    if (streak >= 3) {
      const id = this._makeId('streak_3');
      if (!this.isDismissed(id)) {
        messages.push({
          id,
          type: 'usage',
          title: '坚持就是胜利',
          content: '你已经连续3天使用学伴小管家了，坚持就是胜利！',
          priority: 3,
          icon: '✨'
        });
      }
    }

    // —— 连续7天使用 ——
    if (streak >= 7) {
      const id = this._makeId('streak_7');
      if (!this.isDismissed(id)) {
        messages.push({
          id,
          type: 'usage',
          title: '一周坚持',
          content: '一周坚持！你的自律让我佩服。',
          priority: 4,
          icon: '🎉'
        });
      }
    }

    return messages;
  },

  // ========== 用户操作 ==========

  /**
   * 用户关闭（dismiss）某条关怀消息
   * 关闭后该消息在同一天内不会再次出现
   * @param {string} id - 关怀消息的唯一 id
   */
  dismiss(id) {
    this._dismissed[id] = true;
    this._save();
    console.log('[ProactiveCare] 关闭关怀:', id);
  },

  /**
   * 检查某条关怀消息是否已被用户关闭
   * @param {string} id - 关怀消息的唯一 id
   * @returns {boolean}
   */
  isDismissed(id) {
    return !!this._dismissed[id];
  },

  /**
   * 清除所有已关闭状态（新的检查周期）
   * 通常在每日首次检查时调用
   */
  clearDismissed() {
    // 清除非当天的关闭记录（过期清理）
    const today = this._getTodayStr();
    const keys = Object.keys(this._dismissed);
    keys.forEach(key => {
      // id 格式: care_YYYY-MM-DD_type 或 care_YYYY-MM-DD_type_suffix
      const parts = key.split('_');
      if (parts.length >= 2) {
        const dateStr = parts[1]; // parts[0]='care', parts[1]='YYYY-MM-DD'
        if (dateStr !== today) {
          delete this._dismissed[key];
        }
      }
    });
    this._save();
  }
};

// 兼容 CommonJS 模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ProactiveCare };
}
