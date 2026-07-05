/**
 * 学伴小管家 - 学习情绪周报生成器
 * 每周自动生成 HTML 格式的报告
 */
const WeeklyReport = {
  /**
   * 生成周报
   * @param {Object} params - { emotionRecords, pomoRecords, studyPlan, chatHistory }
   * @returns {Object} { html, summary, stats }
   */
  generate(params = {}) {
    const { emotionRecords = [], pomoRecords = [], studyPlan = null, chatHistory = [] } = params;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);

    // 筛选本周记录
    const weekEmotions = emotionRecords.filter(r => r.date >= weekAgoStr);
    const weekPomos = pomoRecords.filter(r => r.date >= weekAgoStr);

    // 统计
    const emotionCounts = {};
    weekEmotions.forEach(r => {
      emotionCounts[r.emotion] = (emotionCounts[r.emotion] || 0) + 1;
    });

    const emotionLabels = {
      crisis: '需要关注', depressed: '情绪低落', angry: '愤怒烦躁',
      anxious: '焦虑不安', stressed: '压力过大', neutral: '平平淡淡',
      positive: '状态平稳', happy: '心情愉快'
    };

    const dominantEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0];
    const dominantLabel = dominantEmotion ? emotionLabels[dominantEmotion[0]] || dominantEmotion[0] : '暂无数据';

    // 情绪健康分趋势
    const scoreMap = { crisis: 0, depressed: 1, angry: 2, anxious: 2, stressed: 2, neutral: 3, positive: 4, happy: 5 };
    const avgScore = weekEmotions.length > 0
      ? (weekEmotions.reduce((s, r) => s + (scoreMap[r.emotion] || 3), 0) / weekEmotions.length * 20).toFixed(0)
      : '—';

    const totalPomos = weekPomos.length;
    const chatCount = chatHistory.filter(m => m.role === 'user' && m.timestamp >= weekAgo.getTime()).length;

    // 生成 AI 建议摘要
    let aiAdvice = '';
    if (avgScore !== '—') {
      const score = parseInt(avgScore);
      if (score >= 80) {
        aiAdvice = '本周你的整体情绪状态很好，继续保持当前的学习节奏和生活习惯。';
      } else if (score >= 60) {
        aiAdvice = '本周情绪总体平稳，有少量波动。建议关注情绪较低的日子，看看是否有共同的原因。';
      } else if (score >= 40) {
        aiAdvice = '本周情绪偏低，建议增加运动和社交活动，必要时与信任的人聊聊。';
      } else {
        aiAdvice = '本周情绪持续低落，强烈建议寻求专业帮助。你可以拨打心理援助热线 400-161-9995。';
      }
    }

    const stats = {
      totalEmotions: weekEmotions.length,
      dominantEmotion: dominantLabel,
      avgScore,
      totalPomos,
      chatCount,
      aiAdvice
    };

    // 生成 HTML
    const html = this._buildHTML(stats, emotionCounts, emotionLabels);

    return { html, summary: aiAdvice, stats };
  },

  _buildHTML(stats, emotionCounts, labels) {
    const emotionBars = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([emotion, count]) => {
        const max = Math.max(...Object.values(emotionCounts));
        const pct = (count / max * 100).toFixed(0);
        return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
          <span style="width:70px;font-size:12px;color:#666;">${labels[emotion] || emotion}</span>
          <div style="flex:1;height:16px;background:#eee;border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:#4B3FE3;border-radius:4px;"></div>
          </div>
          <span style="font-size:12px;color:#999;">${count}次</span>
        </div>`;
      }).join('');

    return `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
      <h2 style="color:#4B3FE3;font-size:18px;margin-bottom:4px;">📊 本周学习情绪报告</h2>
      <p style="color:#999;font-size:12px;margin-bottom:16px;">${new Date().toLocaleDateString('zh-CN')}</p>
      <div style="display:flex;gap:12px;margin-bottom:16px;">
        <div style="flex:1;background:#f7f8fa;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#4B3FE3;">${stats.avgScore}</div>
          <div style="font-size:11px;color:#999;">情绪健康分</div>
        </div>
        <div style="flex:1;background:#f7f8fa;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#1DC981;">${stats.totalPomos}</div>
          <div style="font-size:11px;color:#999;">完成番茄数</div>
        </div>
        <div style="flex:1;background:#f7f8fa;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#22A5F7;">${stats.chatCount}</div>
          <div style="font-size:11px;color:#999;">AI对话次数</div>
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">情绪分布</div>
        ${emotionBars || '<p style="color:#999;font-size:12px;">本周暂无数据</p>'}
      </div>
      <div style="background:#f0f0ff;border-radius:8px;padding:12px;">
        <div style="font-size:13px;font-weight:600;color:#4B3FE3;margin-bottom:4px;">🤖 AI 建议</div>
        <p style="font-size:12px;color:#555;line-height:1.6;">${stats.aiAdvice}</p>
      </div>
    </div>`;
  }
};
