/**
 * 学伴小管家 - 情绪识别 Web Worker
 * 将朴素贝叶斯 + TF-IDF 推理与词典匹配移至后台线程，避免主线程卡顿
 *
 * API:
 *   主线程 -> Worker: { type: 'init', model: modelJson, words: wordArray }
 *   主线程 -> Worker: { type: 'classify', text: '...', id: '...' }
 *   Worker -> 主线程: { type: 'result', id: '...', result: { emotion, label, confidence, scores, ... } }
 */

// ==================== 全局状态 ====================
let model = null;
let vocabMap = {};
let wordSet = new Set();
let loaded = false;

// ==================== 停用词 ====================
const stopWords = new Set([
  "的","了","是","我","你","在","和","就","都","要","会","能","这","那",
  "有","个","也","很","但","而","对","为","与","及","等","或","其",
  "它","们","吧","啊","呢","哦","嗯","哈","吗","什么","怎么","这样",
  "那么","一下","一直","一天","一个","一种","今天","明天","最近",
  "现在","感觉","觉得","但是","因为","所以","虽然","还是","就是",
  "不是","没有","知道","想","做","去","来","好","太","真","挺","又",
  "还","可","得","着","过","把","给","很","更","最","被","让","从",
  "到","上","下","里","中","多","少","些","那些","这些","自己","别人",
  "什么","怎么","哪里","为什么","怎么样","如何","能否","是不是",
  "已经","曾经","正在","将要","可能","应该","必须","需要"
]);

// ==================== 词典数据 ====================
const NEGATION_WORDS = ['不', '没', '别', '不要', '不会', '没有', '并非', '不是', '从不', '从不', '并未', '毫不'];

const EMOJI_MAP = {
  '😀': 'happy', '😃': 'happy', '😄': 'happy', '😁': 'happy', '😆': 'happy',
  '😂': 'happy', '🤣': 'happy', '😊': 'happy', '😇': 'happy', '🙂': 'happy',
  '😉': 'happy', '😌': 'happy', '😍': 'happy', '🥰': 'happy', '😘': 'happy',
  '🤩': 'happy', '🥳': 'happy', '👍': 'happy', '💪': 'positive', '✨': 'happy',
  '🎉': 'happy', '🌟': 'happy', '🔥': 'happy', '❤️': 'happy', '💖': 'happy',
  '😢': 'depressed', '😭': 'depressed', '😞': 'depressed', '😔': 'depressed',
  '😟': 'depressed', '😕': 'depressed', '💔': 'depressed', '😿': 'depressed',
  '😰': 'anxious', '😨': 'anxious', '😧': 'anxious', '😦': 'anxious',
  '😱': 'anxious', '🥺': 'anxious', '😬': 'anxious', '🫣': 'anxious',
  '😡': 'angry', '😠': 'angry', '🤬': 'angry', '👿': 'angry', '💢': 'angry',
  '😤': 'angry', '🤯': 'stressed', '😫': 'stressed', '😩': 'stressed',
  '🥵': 'stressed', '😓': 'stressed', '😥': 'stressed', '😪': 'stressed',
  '🤢': 'stressed', '🤮': 'stressed', '😣': 'stressed', '🙃': 'stressed',
  '😶': 'neutral', '😐': 'neutral', '😑': 'neutral', '😯': 'neutral',
  '🤔': 'neutral', '🫤': 'neutral', '🤷': 'neutral', '🙄': 'neutral',
  '😵': 'crisis', '💀': 'crisis', '☠️': 'crisis', '🫠': 'crisis'
};

const SLANG_MAP = {
  'yyds': 'happy', '绝绝子': 'happy', 'awesome': 'happy', 'nb': 'happy',
  '太棒了': 'happy', 'yyds啊': 'happy', '神了': 'happy', '666': 'happy',
  'emo': 'depressed', '破防': 'depressed', '破防了': 'depressed',
  '我裂开了': 'depressed', '裂开': 'depressed', '蚌埠住了': 'depressed',
  '绷不住了': 'depressed', '麻了': 'depressed', '麻了麻了': 'depressed',
  '寄了': 'depressed', 'g了': 'depressed', '没了': 'depressed',
  '躺平': 'depressed', '摆烂': 'depressed', '开摆': 'depressed',
  '狠狠': 'depressed', '狠狠地': 'depressed', 'emo了': 'depressed',
  '深夜emo': 'depressed', '好e': 'depressed', 'e了': 'depressed',
  '焦虑': 'anxious', '慌': 'anxious', '慌了': 'anxious', '紧张': 'anxious',
  '慌得一批': 'anxious', '慌了神': 'anxious', '紧张死了': 'anxious',
  'jyz': 'anxious', '焦虑了': 'anxious', '慌得不行': 'anxious',
  '卷': 'stressed', '内卷': 'stressed', '卷死了': 'stressed',
  '太卷': 'stressed', '卷不动': 'stressed', '被卷': 'stressed',
  '累': 'stressed', '累死': 'stressed', '累死了': 'stressed',
  '烦': 'stressed', '烦死': 'stressed', '烦死了': 'stressed',
  '离谱': 'angry', '无语': 'angry', '离谱了': 'angry', '大无语': 'angry',
  '无语子': 'angry', '服了': 'angry', '真服了': 'angry', '服了服了': 'angry',
  '下头': 'angry', '下头了': 'angry', '晦气': 'angry', '晦气啊': 'angry',
  '栓q': 'neutral', '栓Q': 'neutral', 'fine': 'neutral', 'okk': 'positive',
  'ok': 'positive', '好的': 'positive', '还行': 'positive', '可以': 'positive'
};

const EMOTION_DICTIONARY = {
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
    negationCheck: ['想死', '了结', '解脱', '消失']
  },
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
    negationCheck: ['放弃', '不想学', '不想做', '绝望', '崩溃']
  },
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
    negationCheck: ['放弃']
  },
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

// ==================== 词典工具函数 ====================
function isNegated(text, keyword) {
  const idx = text.indexOf(keyword);
  if (idx === -1) return false;
  const prefix = text.substring(Math.max(0, idx - 3), idx);
  return NEGATION_WORDS.some(neg => prefix.includes(neg));
}

function detectEmotionByDictionary(text) {
  if (!text || typeof text !== 'string') {
    return { emotion: 'neutral', severity: 0, label: '平平淡淡', color: '#A1A1AA', action: 'daily_check', matchedWords: [] };
  }

  const lowerText = text.toLowerCase();

  // Emoji 检测
  for (const [emoji, emotion] of Object.entries(EMOJI_MAP)) {
    if (text.includes(emoji)) {
      const data = EMOTION_DICTIONARY[emotion];
      if (data) {
        return { emotion, severity: data.severity, label: data.label, color: data.color, action: data.action, matchedWords: [emoji], emojiMatch: true };
      }
    }
  }

  // 网络用语检测
  for (const [slang, emotion] of Object.entries(SLANG_MAP)) {
    if (lowerText.includes(slang)) {
      const data = EMOTION_DICTIONARY[emotion];
      if (data) {
        return { emotion, severity: data.severity, label: data.label, color: data.color, action: data.action, matchedWords: [slang], slangMatch: true };
      }
    }
  }

  let bestMatch = null;
  let maxSeverity = -1;

  for (const [emotion, data] of Object.entries(EMOTION_DICTIONARY)) {
    let matchedWords = [];
    const negationCheck = data.negationCheck || [];

    for (const keyword of data.keywords) {
      if (lowerText.includes(keyword)) {
        if (negationCheck.includes(keyword) && isNegated(lowerText, keyword)) {
          continue;
        }
        matchedWords.push(keyword);
      }
    }

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

  if (!bestMatch) {
    return { emotion: 'neutral', severity: 0, label: '平平淡淡', color: '#A1A1AA', action: 'daily_check', matchedWords: [] };
  }

  return bestMatch;
}

// ==================== 分词 ====================
function tokenize(text) {
  text = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ');
  const words = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    if (/\s/.test(text[i])) { i++; continue; }

    let matched = false;
    const maxLen = Math.min(8, len - i);

    for (let wlen = maxLen; wlen >= 2; wlen--) {
      const candidate = text.substring(i, i + wlen);
      if (wordSet.has(candidate) && !stopWords.has(candidate)) {
        words.push(candidate);
        i += wlen;
        matched = true;
        break;
      }
    }

    if (!matched) {
      if (/[\u4e00-\u9fa5]/.test(text[i]) && !stopWords.has(text[i])) {
        words.push(text[i]);
      }
      i++;
    }
  }

  return words;
}

// ==================== TF-IDF 向量 ====================
function transform(text) {
  const words = tokenize(text);
  const vector = new Array(model.vocab.length).fill(0);

  if (words.length === 0) return vector;

  const wordCount = {};
  words.forEach(w => { wordCount[w] = (wordCount[w] || 0) + 1; });

  const total = words.length;
  for (const [w, count] of Object.entries(wordCount)) {
    if (vocabMap[w] !== undefined) {
      const idx = vocabMap[w];
      const tf = count / total;
      vector[idx] = tf * model.idf[idx];
    }
  }

  return vector;
}

// ==================== 模型预测 ====================
function predictWithModel(text) {
  if (!loaded || !model) return null;

  const vector = transform(text);
  const scores = {};

  for (const cls of model.classes) {
    let score = model.class_prior[cls];
    const logProb = model.feature_log_prob[cls];
    for (let i = 0; i < vector.length; i++) {
      if (vector[i] > 0) score += vector[i] * logProb[i];
    }
    scores[cls] = score;
  }

  // Softmax
  const maxScore = Math.max(...Object.values(scores));
  const expScores = {};
  let total = 0;
  for (const [cls, score] of Object.entries(scores)) {
    expScores[cls] = Math.exp(score - maxScore);
    total += expScores[cls];
  }

  const probabilities = {};
  for (const cls of model.classes) {
    probabilities[cls] = expScores[cls] / total;
  }

  const predicted = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0];
  return { emotion: predicted[0], confidence: predicted[1], probabilities };
}

// ==================== 强度计算 ====================
function _computeIntensity(emotion, matchCount, confidence) {
  if (emotion === 'neutral') return 20;
  let intensity = matchCount * 15 + (confidence || 0) * 50;
  if (emotion === 'crisis') {
    intensity = Math.max(intensity, 80);
  }
  if ((emotion === 'depressed' || emotion === 'angry') && matchCount > 0) {
    intensity = Math.max(intensity, 50);
  }
  return Math.max(10, Math.min(100, Math.round(intensity)));
}

// ==================== 分类主入口 ====================
function classify(text) {
  // 第一层：词典快速匹配
  const dictResult = detectEmotionByDictionary(text);

  if (dictResult.emotion === 'crisis') {
    return {
      ...dictResult,
      source: 'dictionary_priority',
      confidence: 0.95,
      probabilities: loaded ? predictWithModel(text)?.probabilities : null,
      intensity: _computeIntensity('crisis', dictResult.matchedWords.length, 0.95)
    };
  }

  // 第二层：模型预测
  const modelResult = predictWithModel(text);

  if (!modelResult) {
    const conf = dictResult.matchCount ? Math.min(0.7, 0.3 + dictResult.matchCount * 0.1) : 0.5;
    return {
      ...dictResult,
      source: 'dictionary_fallback',
      confidence: conf,
      intensity: _computeIntensity(dictResult.emotion, dictResult.matchedWords.length, conf)
    };
  }

  // 第三层：决策融合
  if (dictResult.emotion === modelResult.emotion) {
    const conf = Math.min(0.98, modelResult.confidence + 0.1);
    return {
      emotion: modelResult.emotion,
      severity: dictResult.severity,
      label: dictResult.label,
      color: dictResult.color,
      action: dictResult.action,
      confidence: conf,
      probabilities: modelResult.probabilities,
      source: 'fusion_agree',
      matchedWords: dictResult.matchedWords,
      intensity: _computeIntensity(modelResult.emotion, dictResult.matchedWords.length, conf)
    };
  }

  // 高严重度（depressed/crisis）只需1个关键词匹配即优先词典
  if (dictResult.severity >= 4 && dictResult.matchedWords.length >= 1) {
    const conf = Math.min(0.85, 0.6 + dictResult.matchedWords.length * 0.1);
    return {
      ...dictResult,
      confidence: conf,
      probabilities: modelResult.probabilities,
      source: 'dictionary_priority',
      modelEmotion: modelResult.emotion,
      intensity: _computeIntensity(dictResult.emotion, dictResult.matchedWords.length, conf)
    };
  }

  // 愤怒情绪：模型未训练此类别，词典匹配1个即优先
  if (dictResult.emotion === 'angry' && dictResult.matchedWords.length >= 1) {
    const conf = Math.min(0.8, 0.55 + dictResult.matchedWords.length * 0.08);
    return {
      ...dictResult,
      confidence: conf,
      probabilities: modelResult.probabilities,
      source: 'dictionary_priority',
      modelEmotion: modelResult.emotion,
      intensity: _computeIntensity('angry', dictResult.matchedWords.length, conf)
    };
  }

  // 中等严重度（anxious/stressed）需至少2个关键词
  if (dictResult.severity >= 3 && dictResult.matchedWords.length >= 2) {
    const conf = Math.min(0.85, 0.6 + dictResult.matchedWords.length * 0.05);
    return {
      ...dictResult,
      confidence: conf,
      probabilities: modelResult.probabilities,
      source: 'dictionary_priority',
      modelEmotion: modelResult.emotion,
      intensity: _computeIntensity(dictResult.emotion, dictResult.matchedWords.length, conf)
    };
  }

  const emotionData = EMOTION_DICTIONARY[modelResult.emotion] || EMOTION_DICTIONARY.neutral;
  return {
    emotion: modelResult.emotion,
    severity: emotionData.severity || 2,
    label: emotionData.label || '平平淡淡',
    color: emotionData.color || '#A1A1AA',
    action: emotionData.action || 'daily_check',
    confidence: modelResult.confidence,
    probabilities: modelResult.probabilities,
    source: 'model',
    matchedWords: dictResult.matchedWords,
    intensity: _computeIntensity(modelResult.emotion, dictResult.matchedWords.length, modelResult.confidence)
  };
}

// ==================== Worker 消息处理 ====================
self.onmessage = function(e) {
  const { type, id } = e.data;

  if (type === 'init') {
    try {
      model = e.data.model;
      const words = e.data.words || [];

      // 构建词汇映射
      vocabMap = {};
      model.vocab.forEach((word, idx) => {
        vocabMap[word] = idx;
      });

      // 构建通用词表
      wordSet = new Set(words);
      model.vocab.forEach(w => wordSet.add(w));

      loaded = true;
      self.postMessage({
        type: 'init_ok',
        id,
        vocabSize: model.vocab.length,
        classes: model.classes,
        totalWords: wordSet.size
      });
    } catch (err) {
      self.postMessage({ type: 'init_error', id, error: err.message });
    }
    return;
  }

  if (type === 'classify') {
    try {
      const text = e.data.text;
      const result = classify(text);
      self.postMessage({
        type: 'result',
        id,
        result
      });
    } catch (err) {
      self.postMessage({
        type: 'error',
        id,
        error: err.message
      });
    }
    return;
  }

  // 未知指令
  self.postMessage({
    type: 'error',
    id,
    error: 'Unknown message type: ' + type
  });
};
