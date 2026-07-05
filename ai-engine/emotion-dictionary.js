/**
 * 学伴小管家 - 情感词典 V4
 *
 * V4 改进：
 *   - 统一严重度：删除 SEVERITY_ORDER，直接用 data.severity，消除双轨制
 *   - stressed 移除中性词（老师/父母/作业等），改为组合匹配（"作业太多""老师逼"等）
 *   - 新增否定词前置检查：不放弃/不想学坏等否定语境不触发负面情绪
 *   - 移除 /一个人/ 裸匹配，改为 /孤.*一个人/ /一个人.*孤独/ 等组合
 *   - 移除幽灵 angry（模型7类无此类，词典保留但 severity 标注清楚）
 */

// ========== 否定词集合 ==========
const NEGATION_WORDS = ['不', '没', '别', '不要', '不会', '没有', '并非', '不是', '从不', '从不', '并未', '毫不'];

/**
 * 检查关键词前是否有否定词
 * @param {string} text - 原始文本
 * @param {string} keyword - 匹配到的关键词
 * @returns {boolean} - true 表示被否定
 */
function isNegated(text, keyword) {
  const idx = text.indexOf(keyword);
  if (idx === -1) return false;
  // 检查关键词前 1-3 个字符是否有否定词
  const prefix = text.substring(Math.max(0, idx - 3), idx);
  return NEGATION_WORDS.some(neg => prefix.includes(neg));
}

const EMOTION_DICTIONARY = {
  // ========== 高危情绪 - crisis ==========
  crisis: {
    keywords: [
      "不想活", "活着没意义", "结束一切", "死了算了", "自杀", "自残",
      "撑不下去", "不想活了", "消失了", "没有人爱", "没人在乎",
      "活不下去", "好想死", "不想存在",
      "世界灰暗", "一片黑暗", "没有意义", "全部结束",
      "永别", "放弃生命", "生命结束", "别活了",
      "割腕", "跳楼", "吃安眠药", "了结自己", "结束生命"
    ],
    patterns: [
      /不想活[了着]?/, /活着没有意义/, /结束[这一]切/, /死了[吧算了]?/,
      /撑不.*下去/, /消失[了吧]?/, /没有人(?:爱|在乎)/, /放弃生命/,
      /世界(?:一片)?(?:灰暗|黑暗)/, /解脱[了吧]?/, /永别[了吧]?/, /了结[了吧]?/,
      /好想死/, /不想存在/, /结束生命/
    ],
    severity: 5,
    color: "#E8463A",
    label: "需要关注",
    action: "immediate_support",
    // 需要否定检查的关键词（这些词在否定语境下不是危机）
    negationCheck: ['想死', '了结', '解脱', '消失']
  },

  // ========== 愤怒情绪 - angry ==========
  // 注意：模型7类不含 angry，但词典层可识别，分类器会特殊处理
  angry: {
    keywords: [
      "生气", "气死", "气炸", "气愤", "愤怒", "恼火", "发火",
      "烦死", "烦透了", "好烦", "太烦", "很烦", "超级烦",
      "心烦", "烦躁", "烦人", "厌烦", "讨厌", "厌恶",
      "气人", "气不过", "咽不下这口气", "受不了", "忍不了",
      "无语", "窝火", "来气", "火大",
      "凭什么", "不公平", "不讲理", "被欺负", "欺负我",
      "吵架", "吵了一架", "闹翻了", "翻脸", "打起来"
    ],
    patterns: [
      /气死[我了]*/, /气炸[了]*/, /烦死[了]*/, /好烦[啊]*/,
      /太烦[了]*/, /很烦[啊]*/, /超级烦/, /心烦[意乱]*/,
      /烦躁[不安]*/, /受不了[了]*/, /忍不了/, /窝火[啊]*/,
      /火大[啊]*/, /凭什么/, /不公平/, /被欺负/, /吵[了一]*架/
    ],
    severity: 3,
    color: "#FF6B35",
    label: "愤怒烦躁",
    action: "anger_management",
    negationCheck: ['讨厌']
  },

  // ========== 低落情绪 - depressed ==========
  depressed: {
    keywords: [
      "没用", "废物", "差劲", "失败", "考砸了", "不及格",
      "崩溃", "崩溃了", "痛苦", "好痛苦", "很痛苦",
      "难过", "伤心", "想哭", "好想哭", "自卑", "自责", "内疚", "对不起",
      "无助", "无力", "迷茫", "困惑", "失落", "沮丧", "灰心",
      "好累", "太累", "累死", "累瘫", "心累", "疲惫", "精疲力竭",
      "厌倦", "无聊", "没意思", "空虚",
      "孤独", "孤单", "被孤立", "没人理解", "没人懂", "没人理",
      "失望", "绝望", "不想学", "学不动", "不想做",
      "心情不好", "低落", "郁闷", "压抑", "堵得慌", "憋屈",
      "被比较", "配不上", "不配", "不值得", "不如别人",
      "难受", "好难受", "很不舒服", "不舒服", "糟透了",
      "委屈", "心塞", "心酸", "心碎", "心痛", "心疼",
      "想放弃", "撑不住", "坚持不下去", "扛不住"
    ],
    patterns: [
      /没[有用]*/, /废[物]*/, /差劲[啊哦]*/, /失败[了]*/, /考砸[了]*/,
      /崩溃[了]*/, /痛苦[啊]*/, /想哭[啊]*/, /自[卑责]*/, /无助[啊]*/,
      /好累[啊]*/, /太累[了]*/, /累死[了]*/, /心累[啊]*/,
      /孤[单独]*/, /没[人]*理解/, /心情不好/,
      /低落[啊]*/, /压抑[啊]*/, /不如[别人]*/, /配不上[别人]/,
      /难受[啊哦]*/, /不舒服[啊]*/, /糟透了[啊]*/,
      /委屈[啊]*/, /心塞[啊]*/, /心酸[啊]*/, /心碎[了]*/,
      /觉得.*孤[独自]/, /有点.*孤[独自]/, /被.*孤立/, /没人.*说话/,
      /孤.*一个人/, /一个人.*孤/, /一个人.*寂寞/,
      /好.*孤独/, /好.*寂寞/, /好.*孤单/,
      /撑不住[了]*/, /扛不住[了]*/, /坚持不下去/
    ],
    severity: 4,
    color: "#F87454",
    label: "情绪低落",
    action: "comfort_support",
    // 需要否定检查的关键词
    negationCheck: ['放弃', '不想学', '不想做', '绝望', '崩溃']
  },

  // ========== 焦虑情绪 - anxious ==========
  anxious: {
    keywords: [
      "紧张", "焦虑", "担心", "害怕", "恐惧", "着急", "急躁",
      "不安", "忐忑", "坐立不安", "心神不宁", "慌张", "手忙脚乱",
      "睡不着", "失眠", "噩梦", "惊醒",
      "考不上", "辜负",
      "来不及", "没时间", "时间不够",
      "脑子空白", "手抖", "心跳快", "心跳加速", "想吐",
      "失控", "无法控制", "越想越", "万一",
      "怎么办", "能不能", "会不会"
    ],
    patterns: [
      /紧[张]*/, /焦[虑]*/, /担[心]*/, /害[怕]*/, /慌[了张]*/,
      /睡不[着]*/, /失[眠]*/, /考不[上]*/, /来不[及]*/,
      /时间不够/, /脑子空白/, /手抖[啊]*/, /心跳(?:快|加速)/,
      /怎么[办]*/, /会不[会]*/, /能不[能]*/, /越想越/
    ],
    severity: 3,
    color: "#EFAA17",
    label: "焦虑不安",
    action: "calm_support",
    negationCheck: []
  },

  // ========== 压力情绪 - stressed ==========
  // V4: 移除中性词（老师/父母/作业/任务等），改为组合短语
  stressed: {
    keywords: [
      "压力", "压垮", "喘不过气", "窒息", "累瘫",
      "作业太多", "作业写不完", "做不完", "写不完", "背不完", "复习不完",
      "太多作业", "任务太多", "事情太多",
      "补课太多", "辅导班太多", "培训班太多",
      "父母逼", "家长逼", "老师逼", "父母期望", "家长期望",
      "被逼", "被逼迫", "被施压",
      "deadline", "期限", "截止日期", "到期", "截止",
      "通宵", "熬夜", "凌晨", "只睡", "睡眠不足",
      "忙碌", "忙不过来", "忙死了", "忙疯了",
      "超负荷", "超载", "过载", "透支",
      "身心俱疲", "疲惫不堪", "累坏了", "overload",
      "考试周", "期末", "月考", "模考", "冲刺"
    ],
    patterns: [
      /压[力大]*/, /喘不过气/, /做不完/, /写不完/,
      /背不完/, /复习不完/, /deadline/, /期限[到]?/,
      /通[宵]*/, /熬[夜]*/, /只睡[了]*/, /忙不[过来]*/,
      /超(?:负荷|载)/, /透支[了]*/, /累坏[了]*/,
      /考试周/, /期末/, /月考/, /模考/,
      // 组合匹配：中性词+压力修饰词
      /作业.*(?:太多|写不完|做不完|堆积)/,
      /任务.*(?:太多|做不完)/,
      /(?:父母|家长|老师).*(?:逼|催|施压|期望|要求|压力)/,
      /(?:补课|辅导班|培训班).*(?:太多|排满|连轴)/
    ],
    severity: 3,
    color: "#EFAA17",
    label: "压力过大",
    action: "relief_support",
    negationCheck: []
  },

  // ========== 积极情绪 - happy ==========
  happy: {
    keywords: [
      "开心", "高兴", "快乐", "兴奋", "激动", "惊喜", "满足",
      "爽", "棒", "赞", "牛", "厉害", "优秀", "成功",
      "解出", "搞懂", "学会", "学到", "掌握", "突破", "进步",
      "完成", "做完", "搞定", "通关", "胜利", "赢了",
      "表扬", "夸奖", "认可", "赞赏", "鼓励", "支持",
      "朋友", "友谊", "一起玩", "出去玩", "聚餐", "聊天",
      "好吃", "好喝", "好玩", "好看", "好听", "好用",
      "晴天", "阳光", "风景", "美景", "夕阳", "星空",
      "太好了", "好棒", "超棒", "完美", "幸运",
      "新知识", "新技能", "有收获", "学到了", "懂了", "明白了",
      "成就感", "自豪", "骄傲", "信心", "有信心",
      "考好了", "满分", "高分", "第一名", "进步了",
      "被夸", "被表扬", "被认可", "获奖", "得奖"
    ],
    patterns: [
      /开心[啊]*/, /高兴[啊]*/, /解出[了]*/, /搞懂[了]*/,
      /学会[了]*/, /学到了?(?:新知识|新技能)?/, /突破[了]*/, /进步[了]*/,
      /完成[了]*/, /表扬[了]*/, /夸奖[了]*/, /一起玩[啊]*/, /好吃[啊]*/,
      /太好了/, /好棒[啊]*/, /超棒/, /完美[啊]*/, /幸运[啊]*/,
      /学到了?/, /有收获/, /懂了/, /明白了/,
      /考好[了]*/, /满分/, /高分/, /第一[名]*/,
      /被(?:夸|表扬|认可)/, /获[奖]*/, /得[奖]*/
    ],
    severity: 2,
    color: "#1DC981",
    label: "心情愉快",
    action: "encourage_celebrate",
    negationCheck: []
  },

  // ========== 中性/一般积极 - positive ==========
  positive: {
    keywords: [
      "不错", "还行", "可以", "挺好", "还好", "凑合",
      "坚持", "努力", "加油", "奋斗", "拼搏", "进取",
      "不放弃", "不绝望", "不认输", "不服输", "不气馁",
      "有希望", "有信心", "相信", "期待", "憧憬", "向往",
      "调整", "改变", "尝试", "开始", "重新", "再来",
      "平静", "淡定", "从容", "坦然", "接受", "放下",
      "感恩", "感谢", "珍惜", "知足", "充实",
      "收获", "成长", "成熟", "提升", "变好",
      "适合", "适应", "习惯", "规律", "平稳"
    ],
    patterns: [
      /不错[啊]*/, /还行[吧]*/, /坚持[住]*/, /加油[啊]*/,
      /有信[心]*/, /有希[望]*/, /期待[着]*/, /调整[一下]*/,
      /平静[吧]*/, /坦然[接受]*/, /感恩[吧]*/, /成长[了]*/
    ],
    severity: 2,
    color: "#22A5F7",
    label: "状态平稳",
    action: "gentle_encourage",
    negationCheck: ['放弃']  // "不放弃" → positive
  },

  // ========== 中性 - neutral ==========
  neutral: {
    keywords: [
      "一般", "普通", "平常", "日常", "正常",
      "吃饭", "睡觉", "上课", "下课", "放学", "上学",
      "公交", "地铁", "走路", "骑车", "坐车",
      "听课", "笔记", "复习",
      "今天", "明天", "周末", "假期", "放假",
      "早上", "中午", "晚上", "课间", "午休",
      "老师", "同学", "父母", "家长", "作业", "任务",
      "补课", "辅导班", "培训班"
    ],
    patterns: [
      /一般[吧]*/, /普通[的]*/, /日常[的]*/, /正常[的]*/,
      /上课[了]*/, /下课[了]*/, /放学[了]*/, /上学[去]*/
    ],
    severity: 0,
    color: "#A1A1AA",
    label: "平平淡淡",
    action: "daily_check",
    negationCheck: []
  }
};

/**
 * 基于词典的快速情绪匹配（V4 - 含否定词检查）
 * @param {string} text - 用户输入文本
 * @returns {Object} - 匹配结果 {emotion, severity, label, color, action, matchedWords}
 */
function detectEmotionByDictionary(text) {
  if (!text || typeof text !== 'string') {
    return { emotion: 'neutral', severity: 0, label: '平平淡淡', color: '#A1A1AA', action: 'daily_check', matchedWords: [] };
  }

  const lowerText = text.toLowerCase();
  let bestMatch = null;
  let maxSeverity = -1;
  let allMatches = [];

  for (const [emotion, data] of Object.entries(EMOTION_DICTIONARY)) {
    let matchedWords = [];
    const negationCheck = data.negationCheck || [];

    // 关键词匹配（含否定检查）
    for (const keyword of data.keywords) {
      if (lowerText.includes(keyword)) {
        // 如果该关键词需要否定检查，且确实被否定，则跳过
        if (negationCheck.includes(keyword) && isNegated(lowerText, keyword)) {
          continue;
        }
        matchedWords.push(keyword);
      }
    }

    // 正则模式匹配
    if (data.patterns) {
      for (const pattern of data.patterns) {
        const match = lowerText.match(pattern);
        if (match) {
          matchedWords.push(match[0]);
        }
      }
    }

    if (matchedWords.length > 0) {
      const severity = data.severity;
      allMatches.push({
        emotion,
        severity,
        label: data.label,
        color: data.color,
        action: data.action,
        matchedWords: [...new Set(matchedWords)],
        matchCount: matchedWords.length
      });

      // 取严重程度最高的；同 severity 时取匹配词更多的
      if (severity > maxSeverity || (severity === maxSeverity && bestMatch && matchedWords.length > bestMatch.matchCount)) {
        maxSeverity = severity;
        bestMatch = {
          emotion,
          severity,
          label: data.label,
          color: data.color,
          action: data.action,
          matchedWords: [...new Set(matchedWords)],
          matchCount: matchedWords.length
        };
      }
    }
  }

  // 如果没有匹配到，返回中性
  if (!bestMatch) {
    return { emotion: 'neutral', severity: 0, label: '平平淡淡', color: '#A1A1AA', action: 'daily_check', matchedWords: [] };
  }

  return bestMatch;
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EMOTION_DICTIONARY, detectEmotionByDictionary, isNegated };
}
