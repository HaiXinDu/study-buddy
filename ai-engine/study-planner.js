/**
 * 学伴小管家 - 智能学习规划引擎
 * 纯规则引擎，提取科目/考试时间/进度，生成每日学习计划
 */

const StudyPlanner = {
  // 科目关键词库
  subjects: {
    '数学': ['数学', '代数', '几何', '函数', '方程', '不等式', '概率', '统计', '微积分', '导数'],
    '语文': ['语文', '作文', '阅读理解', '文言文', '古诗', '默写', '成语', '名著', '散文', '诗歌'],
    '英语': ['英语', '英文', '单词', '语法', '听力', '阅读', '写作', '口语', '完形填空', '翻译'],
    '物理': ['物理', '力学', '电学', '光学', '热学', '声学', '运动', '能量', '电路', '磁场'],
    '化学': ['化学', '方程式', '元素', '有机', '无机', '实验', '反应', '摩尔', '氧化', '酸碱'],
    '生物': ['生物', '细胞', '遗传', '进化', '生态', '光合', '呼吸', 'DNA', '基因', '蛋白质'],
    '历史': ['历史', '朝代', '事件', '人物', '年代', '战争', '革命', '文明', '古代', '近代'],
    '地理': ['地理', '地图', '气候', '地形', '经纬', '区域', '人口', '资源', '环境', '城市'],
    '政治': ['政治', '经济', '哲学', '法律', '时事', '道德', '社会', '价值观', '权利', '义务']
  },

  // 科目权重（考试当天权重最高）
  subjectWeights: {
    '数学': 1.3, '物理': 1.2, '化学': 1.2,
    '英语': 1.1, '语文': 1.0, '生物': 1.0,
    '历史': 0.9, '地理': 0.9, '政治': 0.9
  },

  // 考试倒计时紧迫系数
  urgencyMultiplier(daysLeft) {
    if (daysLeft <= 1) return 2.0;
    if (daysLeft <= 3) return 1.6;
    if (daysLeft <= 7) return 1.3;
    if (daysLeft <= 14) return 1.1;
    return 1.0;
  },

  // 每日可学习时间段
  timeSlots: [
    { label: '早晨', time: '7:00-8:00', duration: 1, efficiency: 0.8, type: '记忆' },
    { label: '上午', time: '8:30-11:30', duration: 3, efficiency: 1.0, type: '理解' },
    { label: '下午', time: '14:00-17:00', duration: 3, efficiency: 0.9, type: '练习' },
    { label: '晚间', time: '19:00-21:00', duration: 2, efficiency: 0.85, type: '复习' },
    { label: '睡前', time: '21:30-22:00', duration: 0.5, efficiency: 0.7, type: '记忆' }
  ],

  /**
   * 解析用户输入，提取学习规划信息
   */
  parseInput(text) {
    const info = {
      subjects: [],        // 提取到的科目
      examDate: null,      // 考试日期（天数）
      progress: [],        // 各科进度描述
      totalDays: 7,        // 默认规划天数
      rawText: text,
      confidence: 0
    };

    // 提取科目
    for (const [subject, keywords] of Object.entries(this.subjects)) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          if (!info.subjects.includes(subject)) {
            info.subjects.push(subject);
          }
          info.confidence += 0.15;
        }
      }
    }

    // 提取天数
    const dayPatterns = [
      /(\d+)\s*天后?考试/,
      /还[有剩]\s*(\d+)\s*天/,
      /(\d+)\s*天后/,
      /还[有剩]\s*(\d+)\s*[天日]/,
      /距离.*?(\d+)\s*天/,
      /(\d+)天[内以里]/
    ];
    for (const pattern of dayPatterns) {
      const match = text.match(pattern);
      if (match) {
        info.totalDays = Math.max(1, Math.min(60, parseInt(match[1])));
        info.examDate = info.totalDays;
        info.confidence += 0.2;
        break;
      }
    }

    // 提取进度
    const progressPatterns = [
      /(\w+?)(?:学到|复习到|看到|进行到|做到).*?第\s*(\d+|[一二三四五六七八九十]+)/,
      /(\w+?).{0,4}进度(?:到|在).*?(\d+|百分之?\d+)/,
      /(\w+?)(?:还差|剩下).*?(\d+|[一二三四五六七八九十]+)/
    ];
    for (const pattern of progressPatterns) {
      const match = text.match(pattern);
      if (match) {
        info.progress.push({ subject: match[1], detail: match[2] });
        info.confidence += 0.1;
      }
    }

    // 如果没有提取到科目，给一个默认提示
    if (info.subjects.length === 0) {
      info.subjects = ['数学', '英语', '语文'];
      info.confidence = 0.3;
    } else {
      info.confidence = Math.min(0.95, info.confidence);
    }

    return info;
  },

  /**
   * 生成学习计划
   */
  generatePlan(info) {
    const { subjects, totalDays, progress } = info;
    const urgency = this.urgencyMultiplier(totalDays);

    // 计算每个科目的优先级分数
    const subjectScores = subjects.map(sub => {
      const weight = this.subjectWeights[sub] || 1.0;
      // 查找该科目的进度
      const prog = progress.find(p => p.subject === sub || sub.includes(p.subject));
      const progressBoost = prog ? 0.8 : 1.0; // 没提到进度的科目假设需要更多时间
      return {
        subject: sub,
        score: weight * urgency * progressBoost,
        progress: prog ? prog.detail : '待开始'
      };
    });

    // 按优先级排序
    subjectScores.sort((a, b) => b.score - a.score);

    // 计算每个科目每天分配的时间（小时）
    const totalDailyHours = 6; // 每天总学习时间
    const totalScore = subjectScores.reduce((s, x) => s + x.score, 0);
    const dailyAllocation = subjectScores.map(s => ({
      ...s,
      dailyHours: Math.max(0.5, (s.score / totalScore) * totalDailyHours),
      dailyHoursRounded: Math.round((s.score / totalScore) * totalDailyHours * 2) / 2
    }));

    // 生成每日计划
    const dailyPlans = [];
    for (let day = 1; day <= Math.min(totalDays, 14); day++) {
      const dayPlan = {
        day,
        label: `第 ${day} 天`,
        isExamDay: day === totalDays,
        tasks: []
      };

      if (day === totalDays) {
        // 考试当天：考前冲刺
        dayPlan.label = '考试日 - 考前冲刺';
        subjectScores.forEach(s => {
          dayPlan.tasks.push({
            subject: s.subject,
            task: '回顾错题本和重点笔记',
            duration: 0.5,
            priority: '核心',
            tip: '保持信心，你已经准备充分了'
          });
        });
        dayPlan.tasks.push({
          subject: '休息',
          task: '考前放松，深呼吸',
          duration: 1,
          priority: '重要',
          tip: '适当休息比多看一道题更重要'
        });
      } else {
        // 普通学习日：分配时间段
        let slotIndex = 0;
        dailyAllocation.forEach(alloc => {
          const hours = alloc.dailyHoursRounded;
          const slotsNeeded = Math.ceil(hours);

          for (let s = 0; s < slotsNeeded && slotIndex < this.timeSlots.length; s++) {
            const slot = this.timeSlots[slotIndex];

            // 根据时间段类型分配任务
            let taskType;
            if (slot.type === '记忆') {
              taskType = this.getMemoryTask(alloc.subject);
            } else if (slot.type === '理解') {
              taskType = this.getUnderstandingTask(alloc.subject);
            } else if (slot.type === '练习') {
              taskType = this.getPracticeTask(alloc.subject);
            } else {
              taskType = this.getReviewTask(alloc.subject);
            }

            dayPlan.tasks.push({
              subject: alloc.subject,
              time: slot.time,
              slot: slot.label,
              task: taskType,
              duration: Math.min(slot.duration, hours - s),
              efficiency: slot.efficiency,
              priority: alloc.score > 1.0 ? '核心' : '常规'
            });

            slotIndex++;
          }
        });

        // 补充休息和运动
        dayPlan.tasks.push({
          subject: '放松',
          task: '课间休息/散步/拉伸',
          duration: 0.5,
          priority: '必要'
        });
      }

      dailyPlans.push(dayPlan);
    }

    return {
      summary: {
        totalDays: totalDays,
        dailyHours: totalDailyHours,
        subjects: subjectScores.map(s => s.subject),
        urgencyLevel: urgency > 1.5 ? '紧急' : urgency > 1.1 ? '较紧' : '充裕',
        tip: this.getSummaryTip(totalDays, subjects.length)
      },
      dailyPlans,
      subjectOverview: dailyAllocation
    };
  },

  // 各类型任务生成
  getMemoryTask(subject) {
    const tasks = {
      '英语': '背单词 + 默写昨日生词',
      '语文': '背诵古诗文 / 默写名句',
      '数学': '记忆公式定理 / 回顾错题',
      '物理': '背诵物理公式 / 概念卡片',
      '化学': '记忆化学方程式 / 元素周期',
      '生物': '背诵核心知识点',
      '历史': '记忆历史事件时间线',
      '地理': '背诵地图 / 地理数据',
      '政治': '背诵核心观点和概念'
    };
    return tasks[subject] || '复习核心知识点';
  },

  getUnderstandingTask(subject) {
    const tasks = {
      '英语': '精读课文 / 分析长难句',
      '语文': '阅读理解练习 / 文言文翻译',
      '数学': '学习新知识点 / 看例题',
      '物理': '理解物理概念 / 画受力分析图',
      '化学': '理解反应原理 / 画知识框架',
      '生物': '理解生物过程 / 画思维导图',
      '历史': '梳理历史脉络 / 分析因果关系',
      '地理': '理解地理规律 / 分析图表',
      '政治': '理解知识点逻辑 / 做思维导图'
    };
    return tasks[subject] || '学习新内容 / 理解核心概念';
  },

  getPracticeTask(subject) {
    const tasks = {
      '英语': '完形填空 / 阅读理解练习',
      '语文': '作文训练 / 阅读理解练习',
      '数学': '刷题 / 做真题卷',
      '物理': '计算题练习 / 实验分析',
      '化学': '选择题 / 计算题练习',
      '生物': '选择题 / 填空题练习',
      '历史': '材料分析题练习',
      '地理': '综合题练习',
      '政治': '时事分析 / 材料题练习'
    };
    return tasks[subject] || '做练习题 / 刷真题';
  },

  getReviewTask(subject) {
    const tasks = {
      '英语': '回顾今天学到的单词和语法',
      '语文': '回顾今天背诵的内容',
      '数学': '回顾今天的解题方法',
      '物理': '回顾今天的错题和公式',
      '化学': '回顾今天的方程式',
      '生物': '回顾今天的知识点',
      '历史': '回顾今天的事件脉络',
      '地理': '回顾今天的知识点',
      '政治': '回顾今天的重点内容'
    };
    return tasks[subject] || '复习今天所学 / 整理笔记';
  },

  getSummaryTip(days, subjectCount) {
    if (days <= 3) return `时间紧迫，建议聚焦 ${subjectCount <= 2 ? '核心科目' : '高频考点'}，多做真题和错题回顾。`;
    if (days <= 7) return `时间适中，建议按"理解-练习-复习"循环推进，每天留出半小时总结。`;
    return `时间充裕，建议先夯实基础再逐步提高难度，保持每天固定的学习节奏。`;
  },

  /**
   * 一站式：解析输入 + 生成计划
   */
  plan(text) {
    const info = this.parseInput(text);
    const plan = this.generatePlan(info);
    this.lastInput = info;  // 保存最近一次解析结果，供 ProactiveCare 获取考试日期
    return { input: info, plan };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StudyPlanner };
}
