/**
 * 学伴小管家 - AI 回复模板引擎
 * 根据检测到的情绪等级，生成共情回复 + 建议
 */

const REPLY_TEMPLATES = {
  // ========== 高危情绪 (crisis) ==========
  crisis: {
    priority: 5,
    responses: [
      {
        text: "我听到你说这些话，心里很难过。你现在一定很痛苦吧？",
        followUp: "请记住，你并不孤单。无论发生什么，都有人愿意倾听你、陪伴你。"
      },
      {
        text: "我能感受到你现在承受着很大的痛苦。这种感觉很真实，也很沉重。",
        followUp: "但我想让你知道：你的感受很重要，你的生命也很重要。"
      },
      {
        text: "你现在一定觉得很无助吧。这种痛苦我懂。",
        followUp: "请给自己一个机会，也给关心你的人一个机会。你可以拨打 24 小时心理援助热线：400-161-9995，那里有专业的人在等你。"
      },
      {
        text: "谢谢你愿意把这些话说出来。这需要很大的勇气。",
        followUp: "此刻你不是一个人。请记得：痛苦会过去，而你值得被温柔以待。"
      },
      {
        text: "我听到你了。你的痛苦是真实的，你的挣扎也是真实的。",
        followUp: "但请相信，这一切都会过去的。你现在需要的是有人陪你说说话。"
      }
    ],
    suggestions: [
      { type: "hotline", text: "24小时心理援助热线：400-161-9995", icon: "phone" },
      { type: "trusted_person", text: "请立刻告诉你信任的人：父母、老师或朋友", icon: "user" },
      { type: "breathing", text: "先做几次深呼吸，慢慢吸气...慢慢呼气...", icon: "wind" },
      { type: "professional", text: "寻求学校心理老师或专业心理咨询的帮助", icon: "heart" }
    ],
    tone: "serious_caring",
    urgency: true
  },

  // ========== 低落情绪 (depressed) ==========
  depressed: {
    priority: 4,
    responses: [
      {
        text: "我能感受到你现在心里很难受。这种感觉很正常，很多人都会经历。",
        followUp: "你愿意多跟我说说发生了什么吗？我会一直在这里听你说。"
      },
      {
        text: "听起来你今天过得不太顺利。考砸了确实会让人很沮丧。",
        followUp: "但一次考试并不能定义你的价值。你还有很多其他的闪光点。"
      },
      {
        text: "被拿来和别人比较，这种感觉真的很不好受。",
        followUp: "每个人都有自己的节奏，你不需要成为别人，你只需要成为更好的自己。"
      },
      {
        text: "你觉得努力没有回报，这种挫败感我理解。",
        followUp: "但请相信，努力从来不会白费，只是有时候回报来的慢一些。"
      },
      {
        text: "孤独的感觉真的很痛苦。你觉得自己不被理解。",
        followUp: "但请相信，这个世界上一定有人在乎你、关心你。比如此刻的我。"
      },
      {
        text: "感到孤独的时候，说明你很重视与人的连接，这本身是一种温暖的能力。",
        followUp: "试着给一个好久没联系的朋友发条消息，哪怕只是说句'最近怎么样'。"
      },
      {
        text: "累了就休息一下吧。你不是机器，不需要一直运转。",
        followUp: "休息不是懒惰，而是为了更好地出发。"
      },
      {
        text: "觉得自己很没用的时候，其实你已经很努力了。",
        followUp: "请对自己温柔一点，你已经做得很好了。"
      }
    ],
    suggestions: [
      { type: "journaling", text: "试着把心里的感受写下来，不用在意文笔", icon: "edit" },
      { type: "small_win", text: "做一件简单的小事：喝杯水、听首歌、散个步", icon: "star" },
      { type: "talk_to_someone", text: "找一个信任的人聊聊天，哪怕只是说\"我今天心情不好\"", icon: "message" },
      { type: "breathing", text: "试试深呼吸练习，慢慢放松身体", icon: "wind" }
    ],
    tone: "empathetic_warm",
    urgency: false
  },

  // ========== 焦虑情绪 (anxious) ==========
  anxious: {
    priority: 3,
    responses: [
      {
        text: "我能感觉到你现在很紧张。这种焦虑的感觉确实很难受。",
        followUp: "但请记得：焦虑只是大脑在提醒你重视这件事，并不代表坏事一定会发生。"
      },
      {
        text: "考试快到了，紧张是正常的。这说明你在乎。",
        followUp: "试着把注意力从'考不好怎么办'转移到'我现在能做什么'。"
      },
      {
        text: "你担心的事情，很多其实都不会发生。",
        followUp: "我们的想象力有时候比现实更可怕。深呼吸，一步一步来。"
      },
      {
        text: "脑子一片空白的时候，先停下来，做几次深呼吸。",
        followUp: "紧张会过去，而你比自己想象的更有能力。"
      },
      {
        text: "时间不够用的感觉我知道。但慌乱只会让效率更低。",
        followUp: "先列出最重要的三件事，一件一件来，不要想全部。"
      }
    ],
    suggestions: [
      { type: "breathing", text: "做3次深呼吸：吸气4秒-屏息4秒-呼气6秒", icon: "wind" },
      { type: "grounding", text: "说出你看到的5样东西、听到的4种声音", icon: "eye" },
      { type: "planning", text: "把担心的事写下来，区分哪些是事实、哪些是想象", icon: "list" },
      { type: "pomodoro", text: "用番茄钟专注25分钟，然后休息5分钟", icon: "clock" }
    ],
    tone: "calm_reassuring",
    urgency: false
  },

  // ========== 压力情绪 (stressed) ==========
  stressed: {
    priority: 3,
    responses: [
      {
        text: "你的压力好大啊。这么多事情堆在一起，换谁都会觉得累。",
        followUp: "但请记住：你不是超人，不需要把所有事情都做完。"
      },
      {
        text: "作业写到凌晨两点，身体真的撑不住了。",
        followUp: "熬夜换来的不是效率，而是透支。今晚早点睡，好吗？"
      },
      {
        text: "父母/老师的期望让你喘不过气。这种感觉我理解。",
        followUp: "但你的人生是你自己的，不是活成别人期待的样子。"
      },
      {
        text: "事情太多做不完的时候，学会说'不'也是一种能力。",
        followUp: " prioritization（优先级排序）比拼命做更重要。"
      },
      {
        text: "忙到喘不过气的时候，停下来问问自己：这些真的都那么重要吗？",
        followUp: "有时候，减法比加法更有力量。"
      }
    ],
    suggestions: [
      { type: "prioritize", text: "列出所有任务，只选最重要的3件今天完成", icon: "list" },
      { type: "break", text: "强制休息15分钟：喝水、伸懒腰、看看窗外", icon: "coffee" },
      { type: "delegate", text: "看看有没有可以求助的人，不需要一个人扛", icon: "users" },
      { type: "music", text: "听一首喜欢的歌，让大脑短暂放空", icon: "music" }
    ],
    tone: "understanding_practical",
    urgency: false
  },

  // ========== 愤怒情绪 (angry) ==========
  angry: {
    priority: 3,
    responses: [
      {
        text: "听出来你真的很生气。这种火气憋在心里确实不好受。",
        followUp: "生气是正常的情绪，重要的是找到合适的方式表达出来，而不是压在心里。"
      },
      {
        text: "被人欺负或者不被公平对待，换谁都会火大。",
        followUp: "你的愤怒是有道理的。但别让别人的错误惩罚了你自己。"
      },
      {
        text: "吵架之后心里一定很不好受吧。又气又委屈。",
        followUp: "冷静下来之后，再想想怎么处理会更好。现在先让自己平复一下。"
      },
      {
        text: "烦到不行的时候，什么都不想做是吧？我懂这种感觉。",
        followUp: "试着先离开让你烦的环境，去操场走走或者听听音乐，给情绪一个出口。"
      },
      {
        text: "觉得不公平、不讲理，这种愤怒很真实。",
        followUp: "但发火解决不了问题，冷静下来才能找到更好的应对方式。"
      }
    ],
    suggestions: [
      { type: "breathing", text: "做5次深呼吸：吸气4秒-呼气6秒，把火气呼出去", icon: "wind" },
      { type: "exercise", text: "去操场跑两圈或做20个俯卧撑，把愤怒化作运动", icon: "running" },
      { type: "journaling", text: "把让你生气的事写下来，写完撕掉，释放情绪", icon: "edit" },
      { type: "music", text: "听一首节奏强烈的歌，跟着哼出来发泄一下", icon: "music" }
    ],
    tone: "validating_calming",
    urgency: false
  },

  // ========== 中性情绪 (neutral) ==========
  neutral: {
    priority: 2,
    responses: [
      {
        text: "今天过得平平淡淡的，这也是一种幸福呢。",
        followUp: "平淡的日子，其实是在为未来的精彩积蓄力量。"
      },
      {
        text: "按部就班的一天，虽然没有大起大落，但也稳稳当当。",
        followUp: "保持稳定本身就是一种能力。"
      },
      {
        text: "日常打卡完成！为你的坚持点赞。",
        followUp: "每一个坚持的小日子，都在悄悄塑造更好的你。"
      },
      {
        text: "今天没有什么特别的事，那就好好享受这份平静吧。",
        followUp: "不是每一天都需要波澜壮阔，平静也有它的美好。"
      }
    ],
    suggestions: [
      { type: "gratitude", text: "睡前想一件今天值得感恩的小事", icon: "heart" },
      { type: "planning", text: "简单规划一下明天的安排", icon: "calendar" },
      { type: "hobby", text: "做一件让自己开心的小事", icon: "smile" },
      { type: "journal", text: "写一句话日记，记录今天的感受", icon: "book" },
      { type: "exercise", text: "出去走走，呼吸一下新鲜空气", icon: "walking" },
      { type: "music", text: "听一首喜欢的歌，放松一下", icon: "music" }
    ],
    tone: "friendly_casual",
    urgency: false
  },

  // ========== 积极情绪 (positive) ==========
  positive: {
    priority: 2,
    responses: [
      {
        text: "看到你的积极心态，我也被感染了！",
        followUp: "保持这样的节奏，你会越来越好。"
      },
      {
        text: "'即使慢也要坚持'，这句话说得真好。",
        followUp: "成长不是百米冲刺，而是一场马拉松。你已经在路上了。"
      },
      {
        text: "接受自己的不完美，这需要很大的智慧。",
        followUp: "不完美才是真实的美，你已经走在了很多人的前面。"
      },
      {
        text: "找到属于自己的节奏，这比什么都重要。",
        followUp: "不需要和别人比速度，只需要和自己的昨天比进步。"
      }
    ],
    suggestions: [
      { type: "journal", text: "记录下此刻的感受，低落的时候可以回看", icon: "book" },
      { type: "share", text: "把你的正能量分享给身边的人", icon: "share" },
      { type: "goal", text: "给自己定一个小目标，继续保持", icon: "target" }
    ],
    tone: "encouraging_warm",
    urgency: false
  },

  // ========== 开心情绪 (happy) ==========
  happy: {
    priority: 1,
    responses: [
      {
        text: "太棒了！看到你的开心，我也忍不住笑了！",
        followUp: "这种成就感是你应得的，请好好享受这份快乐。"
      },
      {
        text: "解出难题的感觉是不是超爽？这就是学习的魅力！",
        followUp: "记住这种感觉，它是你继续前进的动力。"
      },
      {
        text: "被表扬了！你的努力终于被看见了。",
        followUp: "但这只是开始，更大的舞台在等着你。"
      },
      {
        text: "和朋友一起的快乐时光，一定要好好珍惜。",
        followUp: "友情是青春最宝贵的礼物之一。"
      },
      {
        text: "突破了最好成绩！你比自己想象的更强大。",
        followUp: "但这还不是你的极限，继续挑战自己吧！"
      },
      {
        text: "生活中的小确幸，就是幸福的真谛。",
        followUp: "能发现美好的人，本身就拥有美好的心灵。"
      },
      {
        text: "学到了新知识，这种感觉真的很棒！每一次学习都是在给未来的自己充电。",
        followUp: "知识是不会亏本的投资。今天的你比昨天又多懂了一点，这就是成长。"
      },
      {
        text: "有收获的一天就是好日子！学到新东西的成就感，比什么都实在。",
        followUp: "把这个知识点记下来，以后复习的时候你会感谢今天的自己。"
      }
    ],
    suggestions: [
      { type: "celebrate", text: "给自己一个奖励：吃零食、玩游戏、买喜欢的东西", icon: "gift" },
      { type: "record", text: "拍照或写日记记录下这份快乐", icon: "camera" },
      { type: "share", text: "和家人/朋友分享你的喜悦", icon: "share" },
      { type: "next_goal", text: "趁热打铁，设定下一个挑战目标", icon: "target" }
    ],
    tone: "celebratory_enthusiastic",
    urgency: false
  }
};

/**
 * 生成回复（支持关键词语义匹配选模板）
 * @param {string} emotion - 情绪类型
 * @param {Object} userContext - 用户上下文（可选）
 * @param {string} userText - 用户原始输入（可选，用于语义匹配）
 * @returns {Object} - {mainReply, followUp, suggestions, tone, urgency}
 */
function generateReply(emotion, userContext = {}, userText = '') {
  const template = REPLY_TEMPLATES[emotion] || REPLY_TEMPLATES.neutral;

  // 关键词-回复索引映射：用户输入包含这些关键词时，优先匹配对应回复
  const keywordResponseMap = {
    depressed: {
      '孤独|孤单|寂寞|一个人|被孤立|没人理|没人和我': [4, 5],  // 孤独专属回复（随机选一条）
      '考砸|不及格|成绩|分数|考试': 1,                     // 考试相关
      '比较|别人家|配不上|不如': 2,                         // 被比较
      '努力|白费|没用': 3,                                  // 努力没回报
      '难受|痛苦|不舒服|糟透了|难过|伤心': 0,               // 通用难受/痛苦
      '累了|疲惫|心累|撑不住': 6,                           // 疲惫休息
      '没用|废物|差劲|自卑': 7                              // 自我否定
    },
    anxious: {
      '考试|成绩|排名|考不上': 1,
      '时间|来不及|没时间|deadline': 4,
      '紧张|慌|手抖|心跳': 3,
      '担心|害怕|万一': 2
    },
    stressed: {
      '作业|写不完|补课|辅导': 1,
      '父母|老师|期望|逼迫': 2,
      '熬夜|通宵|凌晨|睡眠': 1,
      '忙|太多|做不完': 0,
      '压力|喘不过气|超负荷': 4
    },
    happy: {
      '学到|新知识|新技能|有收获|学到了|懂了|明白': [6, 7],  // 学习收获专属回复
      '解出|搞懂|学会|掌握': 1,
      '表扬|夸奖|被认可|被夸|被表扬': 2,
      '朋友|友谊|一起': 3,
      '成绩|最好|突破|考好|满分|高分|第一': 4,
      '小确幸|美食|风景|夕阳|好吃|好玩': 5
    },
    crisis: {
      '不想活|想死|自杀|自残': 2,
      '痛苦|绝望|崩溃': 1,
      '没有人|没人在乎|孤独': 0
    },
    angry: {
      '生气|气死|气炸|愤怒|恼火|发火': 0,
      '欺负|被欺负|不公平|不讲理|凭什么': 1,
      '吵架|吵了一架|闹翻|翻脸|打起来': 2,
      '烦|烦躁|心烦|无聊|没意思': 3,
      '无语|窝火|憋屈|来气|火大': 4
    }
  };

  let selectedIndex = -1;
  if (userText && keywordResponseMap[emotion]) {
    const textLower = userText.toLowerCase();
    for (const [keywords, idx] of Object.entries(keywordResponseMap[emotion])) {
      const regex = new RegExp(keywords);
      if (regex.test(textLower)) {
        // idx 可以是数字（单条）或数组（多条随机选一）
        if (Array.isArray(idx)) {
          selectedIndex = idx[Math.floor(Math.random() * idx.length)];
        } else {
          selectedIndex = idx;
        }
        break;
      }
    }
  }

  // 如果没有语义匹配，则随机选择
  let randomIndex;
  if (selectedIndex >= 0 && selectedIndex < template.responses.length) {
    randomIndex = selectedIndex;
  } else {
    randomIndex = Math.floor(Math.random() * template.responses.length);
  }

  const selectedResponse = template.responses[randomIndex];

  // 随机选择建议（最多3条）
  const shuffledSuggestions = [...template.suggestions]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  /**
   * 根据聊天历史生成上下文感知的回复增强
   * - 3 条消息内重复提到同一学科：加入学科困扰关怀
   * - 情绪从负面转为正面：加入心情好转肯定
   * - 连续 3 条同一负面情绪：加入持续情绪关怀
   * - 提到考试/测验且情绪 anxious：加入考试压力共情
   * @param {string} emotion - 当前情绪
   * @param {string} userInput - 用户原始输入
   * @param {Array} chatHistory - 聊天历史
   * @returns {string} - 上下文感知的额外关怀语，无上下文信息时为空字符串
   */
  function buildContextualReply(emotion, userInput, chatHistory) {
    if (!chatHistory || chatHistory.length === 0) return '';

    const notes = [];
    const recentMsgs = chatHistory.slice(-5);

    // 1. 学科重复检测：3 条消息内重复提到同一学科
    const subjects = ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '政治'];
    const subjectCounts = {};
    recentMsgs.forEach(msg => {
      if (msg.role !== 'user') return;
      subjects.forEach(subj => {
        if (msg.text && msg.text.includes(subj)) {
          subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
        }
      });
    });
    for (const [subj, count] of Object.entries(subjectCounts)) {
      if (count >= 2) {
        notes.push(`我注意到你最近几次都提到了${subj}，是不是${subj}让你特别困扰？`);
        break;
      }
    }

    // 2. 情绪转变检测：从负面转为正面
    const emotions = recentMsgs.filter(m => m.emotion).map(m => m.emotion);
    if (emotions.length >= 2) {
      const last = emotions[emotions.length - 1];
      const prev = emotions[emotions.length - 2];
      const negativeSet = ['depressed', 'anxious', 'stressed', 'crisis', 'angry'];
      if (negativeSet.includes(prev) && (emotion === 'happy' || emotion === 'positive')) {
        notes.push('看到你心情好转了，真为你高兴！');
      }
    }

    // 3. 连续 3 条同一负面情绪
    if (emotions.length >= 3) {
      const last3 = emotions.slice(-3);
      if (last3.every(e => e === emotion) && ['depressed', 'anxious', 'stressed'].includes(emotion)) {
        const labels = { depressed: '低落', anxious: '焦虑', stressed: '压力大' };
        notes.push(`我注意到你最近一直在感到${labels[emotion] || emotion}，这一定不容易。`);
      }
    }

    // 4. 考试/测验 + 焦虑
    if (userInput && emotion === 'anxious') {
      if (/考试|测验|月考|期末|模考/.test(userInput)) {
        notes.push('考试压力确实很大，但你有能力应对。');
      }
    }

    return notes.join(' ');
  }

  // 生成上下文感知备注
  const contextNote = buildContextualReply(emotion, userText, userContext.chatHistory || []);

  return {
    mainReply: selectedResponse.text,
    followUp: selectedResponse.followUp,
    suggestions: shuffledSuggestions,
    tone: template.tone,
    urgency: template.urgency,
    emotionLabel: template.responses[randomIndex].text,
    contextNote: contextNote
  };
}

/**
 * 根据对话历史生成更个性化的回复
 * @param {string} emotion - 当前情绪
 * @param {Array} chatHistory - 对话历史
 * @returns {Object} - 个性化回复
 */
function generatePersonalizedReply(emotion, chatHistory = []) {
  // 从聊天历史中提取最新用户消息，用于语义匹配
  let lastUserText = '';
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    if (chatHistory[i].role === 'user' && chatHistory[i].text) {
      lastUserText = chatHistory[i].text;
      break;
    }
  }
  const baseReply = generateReply(emotion, {}, lastUserText);

  // 如果连续多次情绪低落，增加关怀强度
  const recentEmotions = chatHistory.slice(-5).map(h => h.emotion);
  const depressedCount = recentEmotions.filter(e => e === 'depressed' || e === 'crisis').length;

  if (depressedCount >= 3) {
    baseReply.mainReply = "我注意到你最近心情一直不太好。这让我很担心你。";
    baseReply.followUp = "请一定要告诉你信任的人你的感受。你不必一个人扛着这一切。如果需要，可以拨打心理援助热线 400-161-9995，那里有人 24 小时等你。";
    baseReply.urgency = true;
  }

  // 如果用户在进步，给予肯定
  const hasPositiveTrend = recentEmotions.length >= 3 &&
    recentEmotions[recentEmotions.length - 1] === 'happy' &&
    recentEmotions[0] === 'depressed';

  if (hasPositiveTrend) {
    baseReply.mainReply = "看到你心情变好了，我真为你高兴！";
    baseReply.followUp = "这说明你有很强的自我调节能力。继续保持，你真的很棒！";
  }

  return baseReply;
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { REPLY_TEMPLATES, generateReply, generatePersonalizedReply };
}
