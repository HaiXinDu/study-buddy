/**
 * 学伴小管家 - 豆包 AI 适配器 V1
 *
 * 功能：
 *   - 接入火山引擎方舟平台（豆包大模型）API
 *   - 兼容 OpenAI 格式，前端直接 fetch 调用
 *   - API Key 存储在 LocalStorage（用户自行配置）
 *   - 自动 fallback 到本地模板回复（API 不可用时）
 *   - 情绪感知 system prompt，让回复更贴合用户状态
 *   - 对话历史管理（最近 10 轮）
 */

const DoubaoAI = {
  // API 配置
  API_BASE: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  MODEL_ID: 'doubao-seed-1-6-251015',

  // 从 LocalStorage 读取 API Key
  getApiKey() {
    return localStorage.getItem('studybuddy_doubao_apikey') || '';
  },

  // 保存 API Key
  setApiKey(key) {
    localStorage.setItem('studybuddy_doubao_apikey', key);
  },

  // 是否已配置
  isConfigured() {
    return !!this.getApiKey();
  },

  // 构建 system prompt（基于情绪状态）
  buildSystemPrompt(emotion, label) {
    const basePrompt = `你是"学伴小管家"，一个温暖、理解青少年的AI学习伙伴。你的角色是：
1. 倾听学生的情绪，给予真诚的共情和理解
2. 帮助学生管理学习压力，提供实用的学习建议
3. 关注学生的心理健康，必要时引导寻求帮助
4. 语气亲切自然，像朋友一样聊天，不要太正式
5. 回复控制在2-4句话，不要太长，要有温度
6. 不要用"亲爱的""同学"这类称呼，直接对话即可
7. 如果学生表达自伤/自杀想法，立即建议拨打心理援助热线400-161-9995`;

    const emotionContext = {
      crisis: `\n\n当前检测到用户可能处于危机状态！请特别关心，温和地引导用户寻求专业帮助，提及心理援助热线400-161-9995。不要说教。`,
      depressed: `\n\n当前用户情绪低落。请给予温暖的理解和陪伴，不要急于给建议，先共情。可以用"我能理解""这种感觉真的很辛苦"等表达。`,
      anxious: `\n\n当前用户处于焦虑状态。请帮助 calming down，可以用"深呼吸""慢慢来""一步步来"等安抚性语言。`,
      stressed: `\n\n当前用户压力较大。请认可TA的努力，帮助分解任务，减轻压力感。`,
      angry: `\n\n当前用户情绪愤怒/烦躁。请先认可TA的愤怒是合理的，不要急着讲道理，先倾听。`,
      happy: `\n\n当前用户心情愉快。请一起庆祝这份快乐，鼓励保持积极心态。`,
      positive: `\n\n当前用户状态平稳积极。请给予温和的鼓励和支持。`,
      neutral: `\n\n当前用户情绪平稳。请友好回应，可以适当引导分享更多。`
    };

    return basePrompt + (emotionContext[emotion] || emotionContext.neutral);
  },

  // 构建对话消息（最近 10 轮）
  buildMessages(chatHistory, currentText, emotion) {
    const systemPrompt = this.buildSystemPrompt(emotion);

    const messages = [{ role: 'system', content: systemPrompt }];

    // 取最近 10 条对话历史
    const recent = chatHistory.slice(-10);
    for (const msg of recent) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.text || msg.content || ''
        });
      }
    }

    // 添加当前用户消息
    messages.push({ role: 'user', content: currentText });

    return messages;
  },

  /**
   * 调用豆包 API 生成回复
   * @param {string} text - 用户输入
   * @param {Array} chatHistory - 对话历史
   * @param {string} emotion - 检测到的情绪
   * @returns {Promise<{success: boolean, reply: string, source: string}>}
   */
  async chat(text, chatHistory, emotion) {
    const apiKey = this.getApiKey();

    // 未配置 API Key → 直接返回 fallback 标记
    if (!apiKey) {
      return { success: false, reply: '', source: 'no_apikey' };
    }

    try {
      const messages = this.buildMessages(chatHistory, text, emotion);

      const response = await fetch(this.API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: this.MODEL_ID,
          messages: messages,
          temperature: 0.8,
          max_tokens: 300,
          stream: false
        })
      });

      if (!response.ok) {
        console.warn('[DoubaoAI] API 返回错误:', response.status);
        return { success: false, reply: '', source: 'api_error', status: response.status };
      }

      const data = await response.json();

      if (data.choices && data.choices[0] && data.choices[0].message) {
        const reply = data.choices[0].message.content.trim();
        return { success: true, reply, source: 'doubao' };
      }

      return { success: false, reply: '', source: 'empty_response' };
    } catch (error) {
      console.warn('[DoubaoAI] 请求失败:', error.message);
      return { success: false, reply: '', source: 'network_error', error: error.message };
    }
  },

  /**
   * 生成学习建议（用于周报等场景）
   * @param {Object} context - { emotionStats, studyProgress, weekSummary }
   * @returns {Promise<{success: boolean, advice: string}>}
   */
  async generateAdvice(context) {
    const apiKey = this.getApiKey();
    if (!apiKey) return { success: false, advice: '' };

    try {
      const prompt = `基于以下学生本周数据，给出3条个性化建议（每条1-2句话）：

情绪统计：${JSON.stringify(context.emotionStats || {})}
学习进度：${JSON.stringify(context.studyProgress || {})}
本周总结：${context.weekSummary || '无'}

请用温暖但简洁的语气，格式为：
1. ...
2. ...
3. ...`;

      const response = await fetch(this.API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: this.MODEL_ID,
          messages: [
            { role: 'system', content: '你是学伴小管家的AI助手，擅长分析学生数据并给出温暖实用的建议。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!response.ok) return { success: false, advice: '' };

      const data = await response.json();
      if (data.choices && data.choices[0]) {
        return { success: true, advice: data.choices[0].message.content.trim() };
      }
      return { success: false, advice: '' };
    } catch (e) {
      return { success: false, advice: '' };
    }
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DoubaoAI };
}
