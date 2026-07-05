/**
 * 学伴小管家 - 前端情绪分类器 V2
 * 改进：使用通用中文词表做分词，不再仅依赖模型词表
 */

class EmotionClassifier {
  constructor() {
    this.model = null;
    this.loaded = false;
    this.vocabMap = {};
    // 通用中文词表（从 chinese_words.json 加载）
    this.wordSet = new Set();
    // 停用词
    this.stopWords = new Set([
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
  }

  /**
   * 加载模型和词表
   */
  async loadModel(modelUrl = 'ai-engine/emotion_model.json') {
    // 加载词表
    try {
      const wordResp = await fetch('ai-engine/chinese_words.json');
      if (wordResp.ok) {
        const wordData = await wordResp.json();
        this.wordSet = new Set(wordData.words);
        console.log('[EmotionClassifier] 通用词表加载成功:', wordData.word_count, '个词');
      }
    } catch (e) {
      console.warn('[EmotionClassifier] 词表加载失败，使用基本分词');
    }

    // 加载模型
    try {
      const response = await fetch(modelUrl);
      this.model = await response.json();

      this.model.vocab.forEach((word, idx) => {
        this.vocabMap[word] = idx;
      });

      // 将模型词汇也加入通用词表
      this.model.vocab.forEach(w => this.wordSet.add(w));

      this.loaded = true;
      console.log('[EmotionClassifier] 模型加载成功', {
        vocabSize: this.model.vocab.length,
        classes: this.model.classes,
        totalWords: this.wordSet.size
      });
      return true;
    } catch (error) {
      console.error('[EmotionClassifier] 模型加载失败:', error);
      this.loaded = false;
      return false;
    }
  }

  /**
   * 中文分词 V2 - 使用通用词表做前向最大匹配
   * 最大匹配长度从 6 提升到 8
   */
  tokenize(text) {
    text = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ');
    const words = [];
    let i = 0;
    const len = text.length;

    while (i < len) {
      if (/\s/.test(text[i])) { i++; continue; }

      // 前向最大匹配，最大长度 8（支持更长的复合词）
      let matched = false;
      const maxLen = Math.min(8, len - i);

      for (let wlen = maxLen; wlen >= 2; wlen--) {
        const candidate = text.substring(i, i + wlen);
        if (this.wordSet.has(candidate) && !this.stopWords.has(candidate)) {
          words.push(candidate);
          i += wlen;
          matched = true;
          break;
        }
      }

      if (!matched) {
        // 单字：保留中文实词
        if (/[\u4e00-\u9fa5]/.test(text[i]) && !this.stopWords.has(text[i])) {
          words.push(text[i]);
        }
        i++;
      }
    }

    return words;
  }

  /**
   * 将文本转换为 TF-IDF 向量
   */
  transform(text) {
    const words = this.tokenize(text);
    const vector = new Array(this.model.vocab.length).fill(0);

    if (words.length === 0) return vector;

    const wordCount = {};
    words.forEach(w => { wordCount[w] = (wordCount[w] || 0) + 1; });

    const total = words.length;
    for (const [w, count] of Object.entries(wordCount)) {
      if (this.vocabMap[w] !== undefined) {
        const idx = this.vocabMap[w];
        const tf = count / total;
        vector[idx] = tf * this.model.idf[idx];
      }
    }

    return vector;
  }

  /**
   * 模型预测（Softmax 概率）
   */
  predictWithModel(text) {
    if (!this.loaded || !this.model) return null;

    const vector = this.transform(text);
    const scores = {};

    for (const cls of this.model.classes) {
      let score = this.model.class_prior[cls];
      const logProb = this.model.feature_log_prob[cls];
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
    for (const cls of this.model.classes) {
      probabilities[cls] = expScores[cls] / total;
    }

    const predicted = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0];
    return { emotion: predicted[0], confidence: predicted[1], probabilities };
  }

  /**
   * 混合推理：词典优先 + 模型辅助
   */
  classify(text) {
    // 第一层：词典快速匹配（高危优先）
    const dictResult = detectEmotionByDictionary(text);

    if (dictResult.emotion === 'crisis') {
      return {
        ...dictResult,
        source: 'dictionary_priority',
        confidence: 0.95,
        probabilities: this.loaded ? this.predictWithModel(text)?.probabilities : null
      };
    }

    // 第二层：模型预测
    const modelResult = this.predictWithModel(text);

    if (!modelResult) {
      return {
        ...dictResult,
        source: 'dictionary_fallback',
        confidence: dictResult.matchCount ? Math.min(0.7, 0.3 + dictResult.matchCount * 0.1) : 0.5
      };
    }

    // 第三层：决策融合
    if (dictResult.emotion === modelResult.emotion) {
      return {
        emotion: modelResult.emotion,
        severity: dictResult.severity,
        label: dictResult.label,
        color: dictResult.color,
        action: dictResult.action,
        confidence: Math.min(0.98, modelResult.confidence + 0.1),
        probabilities: modelResult.probabilities,
        source: 'fusion_agree',
        matchedWords: dictResult.matchedWords
      };
    }

    // 高严重度（depressed/crisis）只需1个关键词匹配即优先词典
    if (dictResult.severity >= 4 && dictResult.matchedWords.length >= 1) {
      return {
        ...dictResult,
        confidence: Math.min(0.85, 0.6 + dictResult.matchedWords.length * 0.1),
        probabilities: modelResult.probabilities,
        source: 'dictionary_priority',
        modelEmotion: modelResult.emotion
      };
    }

    // 愤怒情绪：模型未训练此类别，词典匹配1个即优先
    if (dictResult.emotion === 'angry' && dictResult.matchedWords.length >= 1) {
      return {
        ...dictResult,
        confidence: Math.min(0.8, 0.55 + dictResult.matchedWords.length * 0.08),
        probabilities: modelResult.probabilities,
        source: 'dictionary_priority',
        modelEmotion: modelResult.emotion
      };
    }

    // 中等严重度（anxious/stressed）需至少2个关键词
    if (dictResult.severity >= 3 && dictResult.matchedWords.length >= 2) {
      return {
        ...dictResult,
        confidence: Math.min(0.85, 0.6 + dictResult.matchedWords.length * 0.05),
        probabilities: modelResult.probabilities,
        source: 'dictionary_priority',
        modelEmotion: modelResult.emotion
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
      matchedWords: dictResult.matchedWords
    };
  }
}

// 全局分类器实例
let emotionClassifier = null;

async function initEmotionClassifier() {
  emotionClassifier = new EmotionClassifier();
  await emotionClassifier.loadModel();
  return emotionClassifier;
}
