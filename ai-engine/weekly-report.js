/**
 * 学伴小管家 - 周报生成引擎
 *
 * 功能：
 *   - 汇总本周情绪数据（趋势、分布、健康分）、学习计划完成情况、本周解锁成就
 *   - 优先调用豆包 AI 生成个性化建议，未配置时回退到本地模板建议
 *   - 生成卡片式 HTML 周报，使用 CSS 变量适配暗黑模式
 *   - 支持一键导出为独立 HTML 文件下载
 *
 * 依赖（全局对象，按需懒加载）：
 *   - EmotionTracker  ：情绪记录与统计
 *   - StudyPlanner    ：学习计划（计划数据持久化在 localStorage: studybuddy_study_plans）
 *   - AchievementSystem：成就徽章
 *   - DoubaoAI         ：豆包大模型建议生成（可选）
 */

const WeeklyReport = {
  // ========== 配置 ==========
  STORAGE_KEY: 'studybuddy_weekly_reports', // 已生成周报的归档存储
  WEEK_DAYS: 7,

  // 情绪类型对应的展示信息（与 EmotionTracker 保持一致）
  emotionMeta: {
    crisis:    { label: '需要关注', color: '#E8463A' },
    depressed: { label: '情绪低落', color: '#F87454' },
    anxious:   { label: '焦虑不安', color: '#EFAA17' },
    stressed:  { label: '压力过大', color: '#F59E0B' },
    angry:     { label: '愤怒烦躁', color: '#FF6B35' },
    happy:     { label: '心情愉快', color: '#1DC981' },
    positive:  { label: '状态平稳', color: '#22A5F7' },
    neutral:   { label: '平平淡淡', color: '#9CA3AF' }
  },

  // ========== 工具方法 ==========

  /**
   * 获取用户昵称（用于周报标题）
   * 优先读取 localStorage 中保存的昵称，缺省返回"同学"
   */
  getUserName() {
    if (typeof localStorage === 'undefined') return '同学';
    return localStorage.getItem('studybuddy_user_name') || '同学';
  },

  /**
   * 计算当前是第几周（ISO 8601 周编号）
   * @param {Date} [date=new Date()] - 参考日期
   * @returns {number} 1-53
   */
  getWeekNumber(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7; // 周日 => 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum); // 跳到本周周四
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  _formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /**
   * 安全读取 localStorage 中的 JSON
   */
  _readJSON(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  },

  // ========== 数据采集 ==========

  /**
   * 采集本周情绪数据
   * @returns {Object} 情绪概览数据
   */
  getEmotionData() {
    const safeTracker = (typeof EmotionTracker !== 'undefined') ? EmotionTracker : null;

    let stats = { stats: {}, total: 0 };
    let trend = [];
    let healthScore = null;

    if (safeTracker) {
      try { stats = safeTracker.getEmotionStats(this.WEEK_DAYS) || stats; } catch (e) { /* ignore */ }
      try { trend = safeTracker.getTrendData(this.WEEK_DAYS) || []; } catch (e) { /* ignore */ }
      try { healthScore = safeTracker.getHealthScore(this.WEEK_DAYS); } catch (e) { /* ignore */ }
    }

    // 计算上周健康分作为对比基准（取第 8-14 天）
    let prevHealthScore = null;
    if (safeTracker) {
      try {
        const records = safeTracker.getRecentRecords(14) || [];
        const weekAgoMs = Date.now() - this.WEEK_DAYS * 86400000;
        const lastWeekRecords = records.filter(r => new Date(r.date).getTime() < weekAgoMs);
        if (lastWeekRecords.length > 0) {
          const scoreMap = { crisis: 0, depressed: 25, anxious: 40, stressed: 40, angry: 30, neutral: 60, positive: 80, happy: 100 };
          const sum = lastWeekRecords.reduce((s, r) => s + (scoreMap[r.emotion] || 50), 0);
          prevHealthScore = Math.round(sum / lastWeekRecords.length);
        }
      } catch (e) { /* ignore */ }
    }

    // 计算主导情绪（本周出现次数最多的情绪）
    let dominantEmotion = null;
    let maxCount = 0;
    Object.entries(stats.stats || {}).forEach(([key, val]) => {
      if (val.count > maxCount) {
        maxCount = val.count;
        const meta = this.emotionMeta[key] || { label: key, color: '#9CA3AF' };
        dominantEmotion = { key, label: val.label || meta.label, color: meta.color, count: val.count };
      }
    });

    // 计算情绪波动（本周内情绪评分的最大差值）
    const scores = trend.filter(t => t.score !== null && t.score !== undefined).map(t => t.score);
    const maxScore = scores.length ? Math.max(...scores) : 0;
    const minScore = scores.length ? Math.min(...scores) : 0;
    const swing = Math.round((maxScore - minScore) * 10) / 10;

    // 健康分变化
    const healthDelta = (healthScore !== null && prevHealthScore !== null)
      ? healthScore - prevHealthScore
      : null;

    return {
      stats: stats.stats || {},
      total: stats.total || 0,
      trend,
      healthScore,
      prevHealthScore,
      healthDelta,
      dominantEmotion,
      swing
    };
  },

  /**
   * 采集本周学习计划完成情况
   * 从 localStorage 读取学习计划与任务勾选状态，并交叉统计
   * @returns {Object} 学习进度数据
   */
  getStudyProgress() {
    const plans = this._readJSON('studybuddy_study_plans', []);
    const taskCheck = this._readJSON('studybuddy_task_check', {});

    // 取最近一份计划作为统计基准
    let activePlan = null;
    if (Array.isArray(plans) && plans.length > 0) {
      activePlan = plans[plans.length - 1];
    } else if (plans && typeof plans === 'object' && plans.dailyPlans) {
      activePlan = plans;
    }

    let totalTasks = 0;
    let completedTasks = 0;
    const subjectMap = {}; // { 科目: { total, completed } }

    if (activePlan && Array.isArray(activePlan.dailyPlans)) {
      activePlan.dailyPlans.forEach(dayPlan => {
        if (!Array.isArray(dayPlan.tasks)) return;
        dayPlan.tasks.forEach((task, taskIdx) => {
          totalTasks++;
          const taskKey = `${dayPlan.day}-${taskIdx}`;
          const done = !!taskCheck[taskKey];
          if (done) completedTasks++;

          const subject = task.subject || '其他';
          if (!subjectMap[subject]) subjectMap[subject] = { total: 0, completed: 0 };
          subjectMap[subject].total++;
          if (done) subjectMap[subject].completed++;
        });
      });
    }

    // 科目分布（按总数降序）
    const subjectDistribution = Object.entries(subjectMap)
      .map(([subject, v]) => ({
        subject,
        total: v.total,
        completed: v.completed,
        percentage: totalTasks > 0 ? Math.round((v.total / totalTasks) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // 兼容 StudyPlanner 实例上的最近一次计划
    if (!activePlan && typeof StudyPlanner !== 'undefined' && StudyPlanner.lastInput) {
      // 无持久化计划，但仍有最近解析结果，至少保留科目信息
      (StudyPlanner.lastInput.subjects || []).forEach(sub => {
        if (!subjectMap[sub]) subjectMap[sub] = { total: 0, completed: 0 };
      });
    }

    return {
      hasPlan: !!activePlan,
      totalTasks,
      completedTasks,
      completionRate,
      subjectDistribution,
      summary: activePlan && activePlan.summary ? activePlan.summary : null
    };
  },

  /**
   * 采集本周解锁的成就
   * @returns {Array} 本周解锁的成就列表
   */
  getWeeklyAchievements() {
    if (typeof AchievementSystem === 'undefined') return [];
    let unlocked = [];
    try { unlocked = AchievementSystem.getUnlocked() || []; } catch (e) { return []; }

    const weekAgo = Date.now() - this.WEEK_DAYS * 86400000;
    return unlocked
      .filter(a => a.unlockedAt && a.unlockedAt >= weekAgo)
      .sort((a, b) => b.unlockedAt - a.unlockedAt);
  },

  // ========== 建议生成 ==========

  /**
   * 生成本周建议：优先调用豆包 AI，未配置或失败时使用本地模板
   * @returns {Promise<{advice: string, source: string}>}
   */
  async generateAdvice(emotionData, studyProgress, weeklyAchievements) {
    const weekSummary = this._buildWeekSummary(emotionData, studyProgress, weeklyAchievements);
    const context = {
      emotionStats: {
        dominant: emotionData.dominantEmotion ? emotionData.dominantEmotion.label : '无数据',
        healthScore: emotionData.healthScore,
        total: emotionData.total
      },
      studyProgress: {
        completionRate: studyProgress.completionRate,
        completedTasks: studyProgress.completedTasks,
        totalTasks: studyProgress.totalTasks,
        subjects: studyProgress.subjectDistribution.map(s => s.subject)
      },
      weekSummary
    };

    // 优先尝试豆包 AI
    if (typeof DoubaoAI !== 'undefined' && DoubaoAI.isConfigured && DoubaoAI.isConfigured()) {
      try {
        const result = await DoubaoAI.generateAdvice(context);
        if (result && result.success && result.advice) {
          return { advice: result.advice, source: 'ai' };
        }
      } catch (e) {
        console.warn('[WeeklyReport] 豆包 AI 建议生成失败，回退到模板', e);
      }
    }

    // 回退到本地模板
    return { advice: this._generateTemplateAdvice(emotionData, studyProgress, weeklyAchievements), source: 'template' };
  },

  /**
   * 构建本周文字摘要（喂给 AI）
   */
  _buildWeekSummary(emotionData, studyProgress, weeklyAchievements) {
    const parts = [];
    parts.push(`本周共记录情绪 ${emotionData.total} 次`);
    if (emotionData.dominantEmotion) {
      parts.push(`主导情绪为"${emotionData.dominantEmotion.label}"`);
    }
    if (emotionData.healthScore !== null) {
      parts.push(`情绪健康分 ${emotionData.healthScore}`);
      if (emotionData.healthDelta !== null) {
        parts.push(`较上周${emotionData.healthDelta >= 0 ? '上升' : '下降'} ${Math.abs(emotionData.healthDelta)} 分`);
      }
    }
    if (studyProgress.hasPlan) {
      parts.push(`学习任务完成 ${studyProgress.completedTasks}/${studyProgress.totalTasks}（${studyProgress.completionRate}%）`);
    }
    if (weeklyAchievements.length > 0) {
      parts.push(`解锁 ${weeklyAchievements.length} 个成就`);
    }
    return parts.join('，') + '。';
  },

  /**
   * 本地模板建议（当 AI 未配置时使用）
   * 根据情绪与学习数据动态生成 3 条建议
   */
  _generateTemplateAdvice(emotionData, studyProgress, weeklyAchievements) {
    const advice = [];

    // 建议1：基于情绪状态
    const dom = emotionData.dominantEmotion;
    if (dom) {
      switch (dom.key) {
        case 'crisis':
        case 'depressed':
          advice.push('这周心情有些低落，记得给自己一些喘息的时间。如果持续感到难过，可以和信任的家人朋友聊聊，或者拨打心理援助热线 400-161-9995。');
          break;
        case 'anxious':
        case 'stressed':
          advice.push('本周压力有些大，试试每天睡前做 5 分钟深呼吸，把大任务拆成小步骤一步步来，焦虑感会减轻很多。');
          break;
        case 'angry':
          advice.push('这周有些烦躁，运动是释放情绪的好办法，出去跑一圈或打场球，心情会清爽不少。');
          break;
        case 'happy':
          advice.push('本周状态很棒！保持这份积极，把好心情记录下来，下次低落时翻看会很有力量。');
          break;
        case 'positive':
          advice.push('整体状态平稳积极，继续保持规律作息和适度运动，这是好心情的基石。');
          break;
        default:
          advice.push('本周情绪比较平淡，可以尝试做一件新鲜的小事，给生活加点色彩。');
      }
    } else {
      advice.push('本周还没有情绪记录，建议每天花一分钟做个情绪打卡，了解自己的心情变化。');
    }

    // 建议2：基于学习进度
    if (studyProgress.hasPlan && studyProgress.totalTasks > 0) {
      const rate = studyProgress.completionRate;
      if (rate >= 80) {
        advice.push(`学习完成率高达 ${rate}%，执行力超强！下周可以适当挑战更高难度的题目，保持进步节奏。`);
      } else if (rate >= 50) {
        advice.push(`学习完成率 ${rate}%，进度过半继续加油。建议把未完成的任务优先级排一排，先攻克最重要的科目。`);
      } else {
        advice.push(`学习完成率 ${rate}%，可能任务安排偏多或遇到卡点。下周试试减少每天任务量，专注完成核心任务。`);
      }
    } else {
      advice.push('本周还没有学习计划，试试输入考试时间和科目，让学伴帮你规划一份每日学习安排。');
    }

    // 建议3：基于成就或综合
    if (weeklyAchievements.length > 0) {
      const names = weeklyAchievements.slice(0, 2).map(a => a.name).join('、');
      advice.push(`本周解锁了"${names}"成就，为你点赞！下周继续坚持打卡和专注练习，徽章会越来越多。`);
    } else {
      advice.push('本周还没有解锁新成就，坚持情绪打卡和完成番茄钟，新的徽章就在路上啦。');
    }

    return advice.map((t, i) => `${i + 1}. ${t}`).join('\n');
  },

  // ========== 报告生成 ==========

  /**
   * 生成本周学习 + 情绪报告
   * @returns {Promise<Object>} 报告对象 { html, weekNumber, userName, generatedAt, data, advice, source }
   */
  async generate() {
    const emotionData = this.getEmotionData();
    const studyProgress = this.getStudyProgress();
    const weeklyAchievements = this.getWeeklyAchievements();
    const { advice, source } = await this.generateAdvice(emotionData, studyProgress, weeklyAchievements);

    const weekNumber = this.getWeekNumber();
    const userName = this.getUserName();
    const generatedAt = new Date();

    const html = this._buildHTML({
      userName,
      weekNumber,
      generatedAt,
      emotionData,
      studyProgress,
      weeklyAchievements,
      advice,
      adviceSource: source
    });

    const report = {
      html,
      weekNumber,
      userName,
      generatedAt: generatedAt.toISOString(),
      data: { emotionData, studyProgress, weeklyAchievements },
      advice,
      adviceSource: source
    };

    // 归档到 localStorage（最多保留 12 份）
    this._archive(report);

    return report;
  },

  /**
   * 将周报归档到 localStorage
   */
  _archive(report) {
    try {
      const list = this._readJSON(this.STORAGE_KEY, []);
      const lite = {
        weekNumber: report.weekNumber,
        userName: report.userName,
        generatedAt: report.generatedAt,
        adviceSource: report.adviceSource,
        healthScore: report.data.emotionData.healthScore,
        completionRate: report.data.studyProgress.completionRate
      };
      list.push(lite);
      while (list.length > 12) list.shift();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    } catch (e) { /* ignore */ }
  },

  // ========== HTML 构建 ==========

  /**
   * 构建完整的 HTML 报告
   */
  _buildHTML(ctx) {
    const { userName, weekNumber, generatedAt, emotionData, studyProgress, weeklyAchievements, advice, adviceSource } = ctx;

    const dateStr = this._formatDate(generatedAt);
    const timeStr = `${String(generatedAt.getHours()).padStart(2, '0')}:${String(generatedAt.getMinutes()).padStart(2, '0')}`;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${userName}的学伴周报 第${weekNumber}周</title>
<style>
${this._buildCSS()}
</style>
</head>
<body>
<div class="report-container">
  <header class="report-header">
    <div class="header-badge">学伴周报</div>
    <h1 class="report-title">${userName}的学伴周报</h1>
    <div class="report-subtitle">第 ${weekNumber} 周 · ${dateStr} ${timeStr}</div>
  </header>

  <div class="card-grid">
    ${this._renderEmotionCard(emotionData)}
    ${this._renderStudyCard(studyProgress)}
    ${this._renderAchievementCard(weeklyAchievements)}
    ${this._renderAdviceCard(advice, adviceSource)}
    ${this._renderMoodCalendar(emotionData)}
  </div>

  <footer class="report-footer">
    <p>由学伴小管家自动生成 · 愿你每周都有进步与好心情</p>
  </footer>
</div>
</body>
</html>`;
  },

  /**
   * 构建 CSS（含暗黑模式适配）
   */
  _buildCSS() {
    return `
:root {
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  --bg-page: #f3f4f6;
  --bg-card: #ffffff;
  --bg-soft: #f9fafb;
  --brand-color: #22A5F7;
  --brand-soft: rgba(34, 165, 247, 0.1);
  --border-color: #e5e7eb;
  --success-color: #1DC981;
  --warning-color: #F59E0B;
  --danger-color: #E8463A;
  --shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  --radius: 16px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --text-primary: #f3f4f6;
    --text-secondary: #b3b8c2;
    --text-muted: #8b919c;
    --bg-page: #0f172a;
    --bg-card: #1e293b;
    --bg-soft: #243248;
    --brand-color: #4aa8ff;
    --brand-soft: rgba(74, 168, 255, 0.15);
    --border-color: #334155;
    --success-color: #2dd484;
    --warning-color: #fbbf24;
    --danger-color: #f0635a;
    --shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  background: var(--bg-page);
  color: var(--text-primary);
  line-height: 1.6;
  padding: 24px 16px;
  transition: background 0.3s, color 0.3s;
}
.report-container { max-width: 860px; margin: 0 auto; }
.report-header { text-align: center; margin-bottom: 28px; }
.header-badge {
  display: inline-block;
  background: var(--brand-soft);
  color: var(--brand-color);
  font-size: 13px;
  font-weight: 600;
  padding: 4px 14px;
  border-radius: 999px;
  margin-bottom: 12px;
}
.report-title { font-size: 28px; font-weight: 700; color: var(--text-primary); }
.report-subtitle { font-size: 14px; color: var(--text-secondary); margin-top: 6px; }
.card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow);
  transition: transform 0.2s, box-shadow 0.2s;
}
.card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
.card.full { grid-column: 1 / -1; }
.card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.card-icon { font-size: 20px; }
.card-title { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.stat-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 12px; }
.stat-value { font-size: 32px; font-weight: 700; color: var(--brand-color); }
.stat-unit { font-size: 14px; color: var(--text-secondary); }
.stat-label { font-size: 13px; color: var(--text-secondary); }
.tag {
  display: inline-block;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 500;
}
.progress-bar-wrap {
  background: var(--bg-soft);
  border-radius: 999px;
  height: 8px;
  overflow: hidden;
  margin: 8px 0;
}
.progress-bar-fill { height: 100%; background: var(--brand-color); border-radius: 999px; transition: width 0.4s; }
.subject-list { margin-top: 10px; }
.subject-item { margin-bottom: 10px; }
.subject-head { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; }
.badge-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.badge-item {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-soft);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 8px 12px;
  font-size: 13px;
}
.badge-item .badge-emoji { font-size: 20px; }
.empty-hint { color: var(--text-muted); font-size: 13px; padding: 8px 0; }
.advice-list { list-style: none; counter-reset: advice; }
.advice-list li {
  counter-increment: advice;
  position: relative;
  padding-left: 32px;
  margin-bottom: 14px;
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.7;
}
.advice-list li::before {
  content: counter(advice);
  position: absolute;
  left: 0; top: 0;
  width: 22px; height: 22px;
  background: var(--brand-color);
  color: #fff;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  display: flex; align-items: center; justify-content: center;
}
.advice-source {
  display: inline-block;
  font-size: 11px;
  color: var(--text-muted);
  margin-left: 6px;
  border: 1px solid var(--border-color);
  padding: 1px 6px;
  border-radius: 6px;
}
.mood-calendar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-top: 10px; }
.mood-day {
  aspect-ratio: 1;
  border-radius: 10px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  font-size: 12px;
  color: #fff;
  position: relative;
  min-height: 64px;
}
.mood-day .day-label { font-size: 11px; opacity: 0.9; }
.mood-day .day-emoji { font-size: 18px; margin-bottom: 2px; }
.mood-day.empty { background: var(--bg-soft); color: var(--text-muted); border: 1px dashed var(--border-color); }
.mood-legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; font-size: 12px; color: var(--text-secondary); }
.mood-legend span { display: inline-flex; align-items: center; gap: 4px; }
.mood-legend i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.report-footer { text-align: center; margin-top: 28px; color: var(--text-muted); font-size: 12px; }
@media (max-width: 640px) {
  .card-grid { grid-template-columns: 1fr; }
  .report-title { font-size: 22px; }
}
`;
  },

  /**
   * 渲染情绪概览卡片
   */
  _renderEmotionCard(emotionData) {
    const dom = emotionData.dominantEmotion;
    const healthScore = emotionData.healthScore;
    const delta = emotionData.healthDelta;

    let deltaHtml = '';
    if (delta !== null) {
      const cls = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
      const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
      const color = delta > 0 ? 'var(--success-color)' : delta < 0 ? 'var(--danger-color)' : 'var(--text-muted)';
      deltaHtml = `<span class="stat-unit" style="color:${color}">${arrow} ${Math.abs(delta)}</span>`;
    }

    const domHtml = dom
      ? `<span class="tag" style="background:${dom.color}22;color:${dom.color}">${dom.label}</span>`
      : `<span class="empty-hint">暂无情绪记录</span>`;

    const swingText = emotionData.total > 0
      ? `本周情绪波动 ${emotionData.swing} 分`
      : '暂无波动数据';

    return `
<section class="card">
  <div class="card-header"><span class="card-icon">💫</span><span class="card-title">情绪概览</span></div>
  <div class="stat-row">
    <span class="stat-value">${healthScore !== null ? healthScore : '--'}</span>
    <span class="stat-unit">/ 100 健康分</span>
    ${deltaHtml}
  </div>
  <div style="margin: 10px 0;">主导情绪：${domHtml}</div>
  <div class="stat-label">${swingText} · 共记录 ${emotionData.total} 次</div>
</section>`;
  },

  /**
   * 渲染学习进度卡片
   */
  _renderStudyCard(studyProgress) {
    if (!studyProgress.hasPlan || studyProgress.totalTasks === 0) {
      return `
<section class="card">
  <div class="card-header"><span class="card-icon">📚</span><span class="card-title">学习进度</span></div>
  <p class="empty-hint">本周还没有学习计划。<br>试试输入考试时间，让学伴帮你规划吧～</p>
</section>`;
    }

    const rate = studyProgress.completionRate;
    const rateColor = rate >= 80 ? 'var(--success-color)' : rate >= 50 ? 'var(--brand-color)' : 'var(--warning-color)';

    const subjectHtml = studyProgress.subjectDistribution.slice(0, 4).map(s => {
      const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
      return `
      <div class="subject-item">
        <div class="subject-head"><span>${s.subject}</span><span>${s.completed}/${s.total}</span></div>
        <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%;background:${rate >= 50 ? 'var(--brand-color)' : 'var(--warning-color)'}"></div></div>
      </div>`;
    }).join('');

    return `
<section class="card">
  <div class="card-header"><span class="card-icon">📚</span><span class="card-title">学习进度</span></div>
  <div class="stat-row">
    <span class="stat-value" style="color:${rateColor}">${rate}%</span>
    <span class="stat-unit">完成率</span>
  </div>
  <div class="stat-label">已完成 ${studyProgress.completedTasks} / ${studyProgress.totalTasks} 项任务</div>
  <div class="subject-list">${subjectHtml}</div>
</section>`;
  },

  /**
   * 渲染成就卡片
   */
  _renderAchievementCard(weeklyAchievements) {
    let content;
    if (weeklyAchievements.length === 0) {
      content = `<p class="empty-hint">本周暂未解锁新成就，继续加油吧！</p>`;
    } else {
      const badges = weeklyAchievements.map(a => `
        <div class="badge-item">
          <span class="badge-emoji">${a.icon || '🏅'}</span>
          <span>${a.name}</span>
        </div>`).join('');
      content = `
        <div class="stat-label">本周解锁 ${weeklyAchievements.length} 个徽章</div>
        <div class="badge-grid" style="margin-top:10px">${badges}</div>`;
    }

    return `
<section class="card">
  <div class="card-header"><span class="card-icon">🏆</span><span class="card-title">本周成就</span></div>
  ${content}
</section>`;
  },

  /**
   * 渲染 AI 建议卡片
   */
  _renderAdviceCard(advice, source) {
    const items = advice.split(/\n/).map(s => s.trim()).filter(Boolean)
      .map(line => line.replace(/^\d+[.、)]\s*/, ''));
    const listHtml = items.map(t => `<li>${this._escapeHTML(t)}</li>`).join('');
    const sourceLabel = source === 'ai' ? 'AI 生成' : '本地模板';

    return `
<section class="card">
  <div class="card-header">
    <span class="card-icon">✨</span>
    <span class="card-title">个性化建议</span>
    <span class="advice-source">${sourceLabel}</span>
  </div>
  <ol class="advice-list">${listHtml}</ol>
</section>`;
  },

  /**
   * 渲染心情日历（7 天情绪色块）
   */
  _renderMoodCalendar(emotionData) {
    const trend = emotionData.trend || [];
    const emojiMap = {
      crisis: '😢', depressed: '😔', anxious: '😰', stressed: '😣',
      angry: '😤', happy: '😄', positive: '🙂', neutral: '😐'
    };

    const days = trend.map(t => {
      if (t.emotion && this.emotionMeta[t.emotion]) {
        const meta = this.emotionMeta[t.emotion];
        return `<div class="mood-day" style="background:${meta.color}">
          <span class="day-emoji">${emojiMap[t.emotion] || '·'}</span>
          <span class="day-label">${t.label}</span>
        </div>`;
      }
      return `<div class="mood-day empty">
        <span class="day-emoji">·</span>
        <span class="day-label">${t.label}</span>
      </div>`;
    }).join('');

    // 图例：只展示本周出现过的情绪
    const appeared = new Set(trend.filter(t => t.emotion).map(t => t.emotion));
    const legend = [...appeared].map(k => {
      const meta = this.emotionMeta[k] || { label: k, color: '#9CA3AF' };
      return `<span><i style="background:${meta.color}"></i>${meta.label}</span>`;
    }).join('');

    return `
<section class="card full">
  <div class="card-header"><span class="card-icon">📅</span><span class="card-title">心情日历（近 7 天）</span></div>
  <div class="mood-calendar">${days}</div>
  ${legend ? `<div class="mood-legend">${legend}</div>` : ''}
</section>`;
  },

  /**
   * HTML 转义
   */
  _escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // ========== 导出 ==========

  /**
   * 将周报导出为 HTML 文件下载
   * @param {Object} [report] - 由 generate() 返回的报告对象；缺省时自动生成
   * @returns {Promise<void>}
   */
  async exportHTML(report) {
    const rep = report || await this.generate();
    const html = rep.html || rep;

    // 浏览器环境：触发下载
    if (typeof document !== 'undefined' && typeof Blob !== 'undefined') {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${rep.userName || '学伴'}_周报_第${rep.weekNumber || this.getWeekNumber()}周.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return rep;
    }

    // Node 环境：返回 HTML 字符串
    return html;
  }
};

// 兼容 CommonJS 模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WeeklyReport };
}
