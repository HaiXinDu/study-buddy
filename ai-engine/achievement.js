/**
 * 学伴小管家 - 成就系统
 * 追踪用户使用行为，解锁成就徽章，提供激励闭环
 *
 * 功能：
 *   - 定义 12 个成就徽章，覆盖对话、情绪、学习、专注、使用习惯等维度
 *   - 通过 AchievementSystem 全局对象暴露接口
 *   - 所有数据持久化到 localStorage (key: studybuddy_achievements)
 */

const AchievementSystem = {
  // ========== 存储键 ==========
  STORAGE_KEY: 'studybuddy_achievements',

  // ========== 成就定义 ==========
  achievements: [
    {
      id: 'first_chat',
      name: '初次对话',
      icon: '💬',
      description: '发送第一条消息',
      condition: '发送第一条消息时解锁'
    },
    {
      id: 'emotion_explorer',
      name: '情绪探索者',
      icon: '🌍',
      description: '体验过3种不同情绪的对话',
      condition: '累计记录3种不同情绪类型时解锁'
    },
    {
      id: 'checkin_3',
      name: '坚持打卡',
      icon: '📅',
      description: '连续3天情绪打卡',
      condition: '连续3天都有情绪记录时解锁'
    },
    {
      id: 'checkin_7',
      name: '七天坚持',
      icon: '🔥',
      description: '连续7天情绪打卡',
      condition: '连续7天都有情绪记录时解锁'
    },
    {
      id: 'first_plan',
      name: '学习达人',
      icon: '📚',
      description: '生成第一份学习计划',
      condition: '首次调用 StudyPlanner 生成计划时解锁'
    },
    {
      id: 'pomodoro_3',
      name: '专注高手',
      icon: '🍅',
      description: '完成3个番茄钟',
      condition: '累计完成3个番茄钟时解锁'
    },
    {
      id: 'pomodoro_10',
      name: '专注大师',
      icon: '🏆',
      description: '完成10个番茄钟',
      condition: '累计完成10个番茄钟时解锁'
    },
    {
      id: 'breathe',
      name: '深呼吸',
      icon: '🌬️',
      description: '完成一次呼吸练习',
      condition: '完成一次完整呼吸练习时解锁'
    },
    {
      id: 'comeback',
      name: '心灵勇士',
      icon: '💪',
      description: '连续低落后情绪好转',
      condition: '之前连续记录为低落/危机，当前记录为愉快/积极时解锁'
    },
    {
      id: 'data_export',
      name: '数据管家',
      icon: '📊',
      description: '导出过情绪数据',
      condition: '首次执行情绪数据导出时解锁'
    },
    {
      id: 'night_owl',
      name: '夜猫子',
      icon: '🦉',
      description: '在23点后使用',
      condition: '在 23:00-04:59 时段使用系统时解锁'
    },
    {
      id: 'early_bird',
      name: '早起鸟',
      icon: '🐦',
      description: '在7点前使用',
      condition: '在 05:00-06:59 时段使用系统时解锁'
    }
  ],

  // ========== 内部状态 ==========
  _unlocked: {},    // { id: timestamp } 已解锁成就的 id => 解锁时间
  _progress: {},    // { id: number } 各成就的当前进度

  // ========== 初始化 ==========

  /**
   * 从 localStorage 加载已解锁成就及进度数据
   * 应在页面加载时调用一次
   */
  init() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
      this._unlocked = saved.unlocked || {};
      this._progress = saved.progress || {};
      // console.log('[AchievementSystem] 初始化完成，已解锁:', Object.keys(this._unlocked).length, '个成就');
    } catch (e) {
      console.warn('[AchievementSystem] 数据加载失败，使用空数据', e);
      this._unlocked = {};
      this._progress = {};
    }
  },

  /**
   * 保存数据到 localStorage
   */
  _save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        unlocked: this._unlocked,
        progress: this._progress
      }));
    } catch (e) {
      console.warn('[Achievement] 保存失败:', e);
    }
  },

  // ========== 核心：检查 & 解锁 ==========

  /**
   * 综合检查入口 —— 根据事件名称和上下文判断是否触发成就
   * @param {string} eventName - 事件名称，如 'chat', 'emotion_checkin', 'pomodoro_complete', 'breath_complete', 'data_export', 'study_plan', 'app_open'
   * @param {object} context  - 事件上下文（包含 emotion, emotionHistory, pomodoroCount 等）
   * @returns {object|null}   - 如果触发了新成就，返回 notification 对象；否则返回 null
   */
  check(eventName, context = {}) {
    switch (eventName) {
      case 'chat':
        return this.unlock('first_chat');
      case 'emotion_checkin':
        return this._checkEmotionAchievements(context);
      case 'pomodoro_complete':
        return this._checkPomodoroAchievements(context);
      case 'breath_complete':
        return this.unlock('breathe');
      case 'data_export':
        return this.unlock('data_export');
      case 'study_plan':
        return this.unlock('first_plan');
      case 'app_open':
        return this._checkTimeAchievements();
      default:
        return null;
    }
  },

  /**
   * 检查情绪相关成就（探索者、打卡、心灵勇士）
   */
  _checkEmotionAchievements(context) {
    const { emotion, emotionHistory } = context;
    let result = null;

    // —— 情绪探索者：体验过3种不同情绪 ——
    if (Array.isArray(emotionHistory) && emotionHistory.length >= 3) {
      const uniqueEmotions = new Set(emotionHistory.map(e => e.emotion));
      if (uniqueEmotions.size >= 3) {
        const r = this.unlock('emotion_explorer');
        if (r) result = r;
      }
    }

    // —— 打卡成就：连续3天 / 连续7天 ——
    if (Array.isArray(emotionHistory)) {
      const streak = this._calcStreak(emotionHistory);
      this._progress['checkin_3'] = Math.min(streak, 3);
      this._progress['checkin_7'] = Math.min(streak, 7);

      if (streak >= 3) {
        const r = this.unlock('checkin_3');
        if (r) result = r;
      }
      if (streak >= 7) {
        const r = this.unlock('checkin_7');
        if (r) result = r;
      }
    }

    // —— 心灵勇士：连续低落后好转 ——
    if (emotion && Array.isArray(emotionHistory) && emotionHistory.length >= 2) {
      const positiveEmotions = ['happy', 'positive'];
      const negativeEmotions = ['depressed', 'crisis'];

      if (positiveEmotions.includes(emotion)) {
        // 检查最近几天是否连续为低落
        const recent = emotionHistory.slice(-4, -1); // 排除最新一条
        const allNegative = recent.length >= 2 && recent.every(e => negativeEmotions.includes(e.emotion));
        if (allNegative) {
          const r = this.unlock('comeback');
          if (r) result = r;
        }
      }
    }

    this._save();
    return result;
  },

  /**
   * 检查番茄钟相关成就
   */
  _checkPomodoroAchievements(context) {
    const count = context.pomodoroCount || 0;
    this._progress['pomodoro_3'] = Math.min(count, 3);
    this._progress['pomodoro_10'] = Math.min(count, 10);

    let result = null;
    if (count >= 3) {
      const r = this.unlock('pomodoro_3');
      if (r) result = r;
    }
    if (count >= 10) {
      const r = this.unlock('pomodoro_10');
      if (r) result = r;
    }
    return result;
  },

  /**
   * 检查时间相关成就（夜猫子、早起鸟）
   */
  _checkTimeAchievements() {
    const hour = new Date().getHours();
    let result = null;

    // 23:00-04:59 → 夜猫子
    if (hour >= 23 || hour < 5) {
      const r = this.unlock('night_owl');
      if (r) result = r;
    }
    // 05:00-06:59 → 早起鸟
    if (hour >= 5 && hour < 7) {
      const r = this.unlock('early_bird');
      if (r) result = r;
    }

    return result;
  },

  /**
   * 计算连续打卡天数
   * @param {Array} history - 情绪记录数组，每项包含 date 字段
   * @returns {number} 从今天往回连续有记录的天数
   */
  _calcStreak(history) {
    if (!Array.isArray(history) || history.length === 0) return 0;

    // 按日期降序排列
    const dates = [...new Set(history.map(r => r.date))].sort().reverse();
    const today = this._getTodayStr();
    const yesterday = this._getDateStr(-1);

    // 必须今天或昨天有记录才算连续
    if (dates[0] !== today && dates[0] !== yesterday) return 0;

    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const diffDays = (prevDate - currDate) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  },

  // ========== 解锁 ==========

  /**
   * 尝试解锁一个成就
   * @param {string} id - 成就 id
   * @returns {object|null} 如果是新解锁，返回 notification 对象；已解锁过则返回 null
   */
  unlock(id) {
    // 已解锁过，不重复处理
    if (this._unlocked[id]) return null;

    // 查找成就定义
    const achievement = this.achievements.find(a => a.id === id);
    if (!achievement) return null;

    // 标记为已解锁
    this._unlocked[id] = Date.now();
    this._save();

    // console.log('[AchievementSystem] 解锁成就:', achievement.name);

    // 返回通知对象
    return {
      id: achievement.id,
      name: achievement.name,
      icon: achievement.icon,
      description: achievement.description,
      isNew: true
    };
  },

  // ========== 查询 ==========

  /**
   * 获取所有成就及其解锁状态
   * @returns {Array} 每项包含成就定义 + unlocked / unlockedAt 字段
   */
  getAll() {
    return this.achievements.map(a => ({
      ...a,
      unlocked: !!this._unlocked[a.id],
      unlockedAt: this._unlocked[a.id] || null,
      progress: this.getProgress(a.id)
    }));
  },

  /**
   * 获取已解锁的成就列表
   * @returns {Array} 仅返回已解锁的成就
   */
  getUnlocked() {
    return this.achievements
      .filter(a => this._unlocked[a.id])
      .map(a => ({
        ...a,
        unlockedAt: this._unlocked[a.id]
      }));
  },

  /**
   * 获取某个成就的当前进度
   * @param {string} id - 成就 id
   * @returns {object} { current, target, percentage }
   */
  getProgress(id) {
    // 定义各成就的目标值
    const targets = {
      emotion_explorer: 3,
      checkin_3: 3,
      checkin_7: 7,
      pomodoro_3: 3,
      pomodoro_10: 10
    };

    // 非进度类成就直接返回完成状态
    if (!targets[id]) {
      return {
        current: this._unlocked[id] ? 1 : 0,
        target: 1,
        percentage: this._unlocked[id] ? 100 : 0
      };
    }

    const current = this._progress[id] || 0;
    return {
      current,
      target: targets[id],
      percentage: Math.round((current / targets[id]) * 100)
    };
  },

  // ========== 渲染 ==========

  /**
   * 渲染成就徽章列表 HTML（用于展示面板）
   * @returns {string} HTML 字符串
   */
  renderBadgeList() {
    const allAchievements = this.getAll();
    const totalUnlocked = allAchievements.filter(a => a.unlocked).length;

    let html = `
      <div class="achievement-panel">
        <div class="achievement-header">
          <h3>我的成就</h3>
          <span class="achievement-count">${totalUnlocked} / ${allAchievements.length}</span>
        </div>
        <div class="achievement-grid">
    `;

    allAchievements.forEach(a => {
      const lockedClass = a.unlocked ? 'unlocked' : 'locked';
      const opacity = a.unlocked ? '1' : '0.4';
      const progressHtml = !a.unlocked && a.progress.percentage > 0
        ? `<div class="achievement-progress"><div class="progress-bar" style="width:${a.progress.percentage}%"></div></div>`
        : '';

      html += `
        <div class="achievement-badge ${lockedClass}" title="${a.condition}" style="opacity:${opacity}">
          <span class="achievement-icon">${a.icon}</span>
          <span class="achievement-name">${a.name}</span>
          <span class="achievement-desc">${a.description}</span>
          ${a.unlocked ? '<span class="achievement-check">&#10003;</span>' : ''}
          ${progressHtml}
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    return html;
  },

  // ========== 重置（调试用） ==========

  /**
   * 重置所有成就数据（仅供开发调试使用）
   */
  reset() {
    this._unlocked = {};
    this._progress = {};
    localStorage.removeItem(this.STORAGE_KEY);
    // console.log('[AchievementSystem] 所有成就已重置');
  },

  // ========== 工具方法 ==========

  /**
   * 获取今天的日期字符串 (YYYY-MM-DD)
   */
  _getTodayStr() {
    const d = new Date();
    return this._getDateStr(0);
  },

  /**
   * 获取相对于今天偏移 N 天的日期字符串
   * @param {number} offset - 偏移天数（0=今天，-1=昨天）
   */
  _getDateStr(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
};

// 兼容 CommonJS 模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AchievementSystem };
}
