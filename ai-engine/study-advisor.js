/**
 * 学伴小管家 - 智能学习建议引擎
 * 根据情绪状态 + 考试日期 + 番茄完成情况 生成个性化学习建议
 */
const StudyAdvisor = {
  /**
   * 生成今日学习建议
   * @param {Object} params - { currentEmotion, examDate, pomoRecords, studyPlan }
   * @returns {Array} 建议列表 [{ priority, subject, reason, action }]
   */
  generateAdvice(params = {}) {
    const { currentEmotion, examDays, pomoRecords, studyPlan } = params;
    const advice = [];
    const emotion = currentEmotion?.emotion || 'neutral';

    // 规则1: 情绪低落 → 建议复习熟悉的科目建立信心
    if (['depressed', 'crisis'].includes(emotion)) {
      advice.push({
        priority: 1,
        icon: '🌱',
        title: '从熟悉的科目开始',
        reason: '心情低落时，从擅长的事入手能重建信心',
        action: '先花15分钟复习你最拿手的科目，找回节奏感'
      });
    }

    // 规则2: 焦虑 → 建议做模拟题
    if (emotion === 'anxious') {
      advice.push({
        priority: 1,
        icon: '📝',
        title: '做一套模拟题',
        reason: '焦虑往往来自不确定感，模拟考试能帮你找回掌控感',
        action: '选一科做一套限时模拟，专注过程而非结果'
      });
    }

    // 规则3: 压力大 → 建议分解任务
    if (emotion === 'stressed') {
      advice.push({
        priority: 1,
        icon: '✂️',
        title: '把任务拆小',
        reason: '压力通常来自任务看起来太庞大',
        action: '把今天的任务拆成3个小块，每块25分钟，逐个完成'
      });
    }

    // 规则4: 心情好 → 建议攻克难点
    if (['happy', 'positive'].includes(emotion)) {
      advice.push({
        priority: 1,
        icon: '🚀',
        title: '趁机攻克难点',
        reason: '状态好时学习效率最高，适合挑战困难内容',
        action: '趁现在精力充沛，攻克一个一直回避的难点'
      });
    }

    // 规则5: 考试临近
    if (examDays !== undefined && examDays <= 3 && examDays >= 0) {
      advice.push({
        priority: 2,
        icon: '⏰',
        title: `距考试仅${examDays}天`,
        reason: '冲刺阶段需要高效复习',
        action: '优先复习高频考点和错题，不要再学新内容'
      });
    }

    // 规则6: 番茄完成少
    if (pomoRecords !== undefined && pomoRecords < 2) {
      advice.push({
        priority: 3,
        icon: '🍅',
        title: '今天还没开始专注',
        reason: '万事开头难，完成第一个番茄就成功了一半',
        action: '现在就开始一个25分钟番茄，选最重要的任务'
      });
    }

    // 规则7: 番茄完成多 → 休息建议
    if (pomoRecords !== undefined && pomoRecords >= 5) {
      advice.push({
        priority: 2,
        icon: '☕',
        title: '该休息一下了',
        reason: '连续专注5个番茄以上，大脑需要恢复',
        action: '休息15-20分钟，散步、喝水、闭目养神'
      });
    }

    // 默认建议
    if (advice.length === 0) {
      advice.push({
        priority: 1,
        icon: '📚',
        title: '保持稳定节奏',
        reason: '稳定的学习节奏比突击更有效',
        action: '按照学习计划继续推进，每25分钟休息5分钟'
      });
    }

    return advice.sort((a, b) => a.priority - b.priority);
  }
};
