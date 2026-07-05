/**
 * 学伴小管家 - 情绪触发词分析
 * 从聊天记录中提取高频词，分析情绪触发模式
 */
const WordAnalyzer = {
  // 学科词
  SUBJECTS: ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '政治'],
  // 情绪相关词
  EMOTION_WORDS: {
    positive: ['开心', '高兴', '满足', '成就感', '进步', '学会', '完成', '搞定', '满分', '考好'],
    negative: ['压力', '焦虑', '紧张', '崩溃', '难过', '孤独', '累', '烦', '害怕', '担心', '失败', '放弃']
  },

  /**
   * 分析聊天记录中的触发词
   * @param {Array} records - EmotionTracker 记录
   * @param {Array} chatHistory - 聊天历史
   * @returns {Object} { topSubjects, positiveTriggers, negativeTriggers, summary }
   */
  analyze(records = [], chatHistory = []) {
    const allText = [
      ...records.map(r => r.text || ''),
      ...chatHistory.filter(m => m.role === 'user').map(m => m.text || '')
    ].join(' ');

    // 统计学科词频
    const subjectFreq = {};
    this.SUBJECTS.forEach(s => {
      const count = (allText.match(new RegExp(s, 'g')) || []).length;
      if (count > 0) subjectFreq[s] = count;
    });

    // 统计正面/负面触发词
    const positiveTriggers = {};
    const negativeTriggers = {};
    this.EMOTION_WORDS.positive.forEach(w => {
      const count = (allText.match(new RegExp(w, 'g')) || []).length;
      if (count > 0) positiveTriggers[w] = count;
    });
    this.EMOTION_WORDS.negative.forEach(w => {
      const count = (allText.match(new RegExp(w, 'g')) || []).length;
      if (count > 0) negativeTriggers[w] = count;
    });

    // 排序取 top 5
    const sortEntry = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topSubjects = sortEntry(subjectFreq);
    const topPositive = sortEntry(positiveTriggers);
    const topNegative = sortEntry(negativeTriggers);

    // 生成摘要
    let summary = '';
    if (topSubjects.length > 0) {
      summary += `你最常提到的是「${topSubjects[0][0]}」`;
      if (topNegative.length > 0 && topNegative[0][1] >= 2) {
        summary += `，且常与「${topNegative[0][0]}」一起出现`;
      }
      summary += '。';
    }
    if (topPositive.length > 0) {
      summary += `让你最开心的词是「${topPositive[0][0]}」。`;
    }

    return { topSubjects, positiveTriggers: topPositive, negativeTriggers: topNegative, summary };
  }
};
