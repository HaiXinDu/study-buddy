/**
 * 学伴小管家 - 情绪趋势追踪（LocalStorage）
 * 记录每日情绪打卡，支持趋势分析和图表展示
 */

const EmotionTracker = {
  STORAGE_KEY: 'studybuddy_emotion_log',
  MAX_RECORDS: 90, // 最多保存90天

  /**
   * 添加一条情绪记录
   * @param {string} emotion - 情绪类型
   * @param {string} text - 用户输入文本
   * @param {number} confidence - 置信度
   * @param {string} source - 记录来源：'chat'(聊天) | 'checkin'(打卡) | 'correction'(纠错)
   */
  addRecord(emotion, text, confidence, source = 'chat') {
    const records = this.getAllRecords();
    const today = this.getTodayStr();
    const newRecord = {
      date: today,
      timestamp: Date.now(),
      emotion,
      text: text.slice(0, 100), // 只存前100字
      confidence,
      source
    };

    // 聊天记录和打卡记录分开管理，同一天可有多条聊天记录
    // 但打卡记录(checkin)同一天只保留最新一条（纠错时覆盖）
    if (source === 'checkin' || source === 'correction') {
      // 打卡/纠错：移除当天已有的 checkin/correction 记录
      for (let i = records.length - 1; i >= 0; i--) {
        if (records[i].date === today && (records[i].source === 'checkin' || records[i].source === 'correction')) {
          records.splice(i, 1);
        }
      }
    }

    records.push(newRecord);

    // 限制每天最多5条记录，超出则删除该天最早的记录
    const sameDayIndices = [];
    records.forEach((r, idx) => { if (r.date === today) sameDayIndices.push(idx); });
    while (sameDayIndices.length > 5) {
      const removeIdx = sameDayIndices.shift(); // 该天最早的记录索引
      records.splice(removeIdx, 1);
      // 删除一个元素后，后续索引整体前移1
      for (let i = 0; i < sameDayIndices.length; i++) sameDayIndices[i] -= 1;
    }

    // 限制记录数量
    while (records.length > this.MAX_RECORDS) {
      records.shift();
    }

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.warn('[EmotionTracker] 保存失败:', e);
    }
    return newRecord;
  },

  /**
   * 获取所有记录
   */
  getAllRecords() {
    try {
      const records = JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
      // 数据清洗：兼容旧版存储的对象类型 emotion
      records.forEach(r => {
        if (r.emotion && typeof r.emotion === 'object') {
          r.emotion = r.emotion.emotion || r.emotion.label || 'neutral';
        }
      });
      return records;
    } catch {
      return [];
    }
  },

  /**
   * 获取最近N天的记录
   */
  getRecentRecords(days = 7) {
    const records = this.getAllRecords();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return records.filter(r => new Date(r.date) >= cutoff);
  },

  /**
   * 计算情绪分布统计
   */
  getEmotionStats(days = 7) {
    const records = this.getRecentRecords(days);
    const stats = {};

    const emotionLabels = {
      crisis: '需要关注',
      depressed: '情绪低落',
      anxious: '焦虑不安',
      stressed: '压力过大',
      angry: '愤怒烦躁',
      happy: '心情愉快',
      positive: '状态平稳',
      neutral: '平平淡淡'
    };

    const emotionColors = {
      crisis: '#E8463A',
      depressed: '#F87454',
      anxious: '#EFAA17',
      stressed: '#F59E0B',
      angry: '#FF6B35',
      happy: '#1DC981',
      positive: '#22A5F7',
      neutral: '#9CA3AF'
    };

    records.forEach(r => {
      if (!stats[r.emotion]) {
        stats[r.emotion] = { count: 0, label: emotionLabels[r.emotion] || r.emotion, color: emotionColors[r.emotion] || '#ccc' };
      }
      stats[r.emotion].count++;
    });

    return { stats, total: records.length };
  },

  /**
   * 计算情绪趋势分数（用于折线图）
   * 分数：crisis=1, depressed=2, anxious=3, stressed=3, neutral=4, positive=5, happy=6
   */
  getTrendData(days = 7) {
    const records = this.getRecentRecords(days);
    const scoreMap = { crisis: 1, depressed: 2, anxious: 3, stressed: 3, angry: 3, neutral: 4, positive: 5, happy: 6 };

    const trend = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = this.formatDate(d);
      const dayRecord = records.filter(r => r.date === dateStr);
      
      if (dayRecord.length > 0) {
        const avgScore = dayRecord.reduce((s, r) => s + (scoreMap[r.emotion] || 4), 0) / dayRecord.length;
        trend.push({
          date: dateStr,
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          score: Math.round(avgScore * 10) / 10,
          emotion: dayRecord[0].emotion,
          count: dayRecord.length
        });
      } else {
        trend.push({
          date: dateStr,
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          score: null,
          emotion: null,
          count: 0
        });
      }
    }

    return trend;
  },

  /**
   * 获取情绪健康评分（0-100）
   */
  getHealthScore(days = 7) {
    const records = this.getRecentRecords(days);
    if (records.length === 0) return null;

    const scoreMap = { crisis: 0, depressed: 25, anxious: 40, stressed: 40, angry: 30, neutral: 60, positive: 80, happy: 100 };
    const recentWeight = records.slice(-3).length > 0 ? 1.5 : 1;

    let totalScore = 0;
    let totalWeight = 0;

    records.forEach((r, idx) => {
      const weight = idx >= records.length - 3 ? recentWeight : 1;
      totalScore += (scoreMap[r.emotion] || 50) * weight;
      totalWeight += weight;
    });

    return Math.round(totalScore / totalWeight);
  },

  /**
   * 检测情绪预警（连续低落）
   */
  checkWarning() {
    const recent = this.getRecentRecords(5);
    if (recent.length < 3) return null;

    // 按日期分组去重（每天取最后一条记录），并按日期升序排列
    const byDate = {};
    recent.forEach(r => { byDate[r.date] = r; }); // 后出现的覆盖前面的，即取每天最后一条
    const uniqueDates = Object.keys(byDate).sort();
    const last3Dates = uniqueDates.slice(-3);

    // 验证最后3个有记录的日期是否真的连续（相邻日期相差1天）
    let consecutive = false;
    if (last3Dates.length === 3) {
      const d1 = new Date(last3Dates[0]);
      const d2 = new Date(last3Dates[1]);
      const d3 = new Date(last3Dates[2]);
      const diff1 = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      const diff2 = Math.round((d3 - d2) / (1000 * 60 * 60 * 24));
      consecutive = (diff1 === 1 && diff2 === 1);
    }

    // 检测连续3天情绪低落
    if (consecutive) {
      const last3 = last3Dates.map(d => byDate[d]);
      const allLow = last3.every(r => ['depressed', 'crisis'].includes(r.emotion));

      if (allLow) {
        return {
          level: 'high',
          message: '我注意到你最近心情一直不太好，连续3天情绪低落。请一定要和信任的人聊一聊。',
          type: 'persistent_low'
        };
      }
    }

    // 检测情绪剧烈波动
    const scores = recent.map(r => ({ crisis: 1, depressed: 2, anxious: 3, stressed: 3, angry: 3, neutral: 4, positive: 5, happy: 6 }[r.emotion] || 4));
    let maxSwing = 0;
    for (let i = 1; i < scores.length; i++) {
      maxSwing = Math.max(maxSwing, Math.abs(scores[i] - scores[i - 1]));
    }
    if (maxSwing >= 3) {
      return {
        level: 'medium',
        message: '最近情绪波动比较大，试着做一些让自己放松的事情。',
        type: 'mood_swing'
      };
    }

    return null;
  },

  // 工具方法
  getTodayStr() {
    return this.formatDate(new Date());
  },

  formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EmotionTracker };
}
