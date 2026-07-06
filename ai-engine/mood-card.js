/**
 * 学伴小管家 - 心情卡片生成器
 * 将情绪打卡生成精美图片卡片，支持下载和分享
 *
 * 功能：
 *   - Canvas 绘制 400x600 心情卡片
 *   - 根据情绪类型自动切换配色和 emoji
 *   - 支持自定义文案和健康评分
 *   - 下载 PNG 图片 / 原生分享（Web Share API）
 */

const MoodCard = {
  // ========== 卡片尺寸 ==========
  WIDTH: 400,
  HEIGHT: 600,

  // ========== 情绪配置映射 ==========

  /**
   * 每种情绪对应的视觉配置
   * - emoji: 展示图标
   * - label: 中文名称
   * - gradient: 渐变色 [起始色, 结束色]
   * - textColor: 文字颜色
   */
  emotionConfig: {
    crisis: {
      emoji: '💔',
      label: '需要关注',
      gradient: ['#8B1A1A', '#4A0E0E'],
      textColor: '#FFFFFF'
    },
    depressed: {
      emoji: '😢',
      label: '情绪低落',
      gradient: ['#5B7FA6', '#3A4F6A'],
      textColor: '#FFFFFF'
    },
    anxious: {
      emoji: '😰',
      label: '焦虑不安',
      gradient: ['#E8893C', '#B5652A'],
      textColor: '#FFFFFF'
    },
    stressed: {
      emoji: '😓',
      label: '压力过大',
      gradient: ['#C97B3A', '#8B5527'],
      textColor: '#FFFFFF'
    },
    neutral: {
      emoji: '😐',
      label: '平平淡淡',
      gradient: ['#8B7FA5', '#5C5472'],
      textColor: '#FFFFFF'
    },
    positive: {
      emoji: '🙂',
      label: '状态平稳',
      gradient: ['#4A9BD9', '#2E6A9E'],
      textColor: '#FFFFFF'
    },
    happy: {
      emoji: '😄',
      label: '心情愉快',
      gradient: ['#3DBB78', '#228B52'],
      textColor: '#FFFFFF'
    }
  },

  /**
   * 获取情绪配置，不存在的类型回退到 neutral
   */
  _getEmotionConfig(emotion) {
    return this.emotionConfig[emotion] || this.emotionConfig.neutral;
  },

  // ========== 求助资源卡片（crisis 专用）==========

  /**
   * 生成「求助资源卡片」
   * 在心理危机场景下，不展示情绪 emoji 与健康评分，
   * 而是提供心理援助热线等求助资源。
   * 该卡片允许下载（方便保存热线信息），但禁止分享。
   * @returns {HTMLCanvasElement} 已绘制完成的 canvas 元素
   */
  _generateCrisisCard() {
    const canvas = document.createElement('canvas');
    canvas.width = this.WIDTH;
    canvas.height = this.HEIGHT;
    const ctx = canvas.getContext('2d');
    const W = this.WIDTH;
    const H = this.HEIGHT;

    // —— 1. 背景渐变（沉稳、安抚）——
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#3A4F6A');
    gradient.addColorStop(1, '#1F2D40');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // —— 2. 顶部装饰圆 ——
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(W * 0.8, H * 0.1, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W * 0.2, H * 0.25, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // —— 3. 标题「你并不孤单」——
    ctx.font = 'bold 36px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('你并不孤单', W / 2, H * 0.22);

    // —— 4. 分隔线 ——
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W * 0.2, H * 0.30);
    ctx.lineTo(W * 0.8, H * 0.30);
    ctx.stroke();

    // —— 5. 心理援助热线 ——
    ctx.font = '18px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText('心理援助热线', W / 2, H * 0.40);

    ctx.font = 'bold 32px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('400-161-9995', W / 2, H * 0.48);

    // —— 6. 北京心理危机研究与干预中心 ——
    ctx.font = '15px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('北京心理危机研究与干预中心', W / 2, H * 0.58);

    ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('010-82951332', W / 2, H * 0.66);

    // —— 7. 分隔线 ——
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(W * 0.2, H * 0.74);
    ctx.lineTo(W * 0.8, H * 0.74);
    ctx.stroke();

    // —— 8. 求助文案 ——
    ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    const message = '请立即联系你信任的人或拨打热线';
    const maxWidth = W * 0.8;
    const lines = this._wrapText(ctx, message, maxWidth);
    const startY = H * 0.80;
    const lineHeight = 24;
    lines.slice(0, 4).forEach((line, i) => {
      ctx.fillText(line, W / 2, startY + i * lineHeight);
    });

    // —— 9. 底部日期 + 品牌水印 ——
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    ctx.font = '13px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(dateStr, W / 2, H - 50);

    ctx.font = 'bold 14px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('学伴小管家', W / 2, H - 28);

    // console.log('[MoodCard] 已生成求助资源卡片（crisis）');
    return canvas;
  },

  // ========== 生成卡片 ==========

  /**
   * 生成心情卡片
   * @param {string} emotion - 情绪类型 (crisis/depressed/anxious/stressed/neutral/positive/happy)
   * @param {string} text    - 用户输入的文案（可选，默认显示情绪标签）
   * @param {number} score   - 健康评分 0-100（可选，不传则不显示）
   * @returns {HTMLCanvasElement} 已绘制完成的 canvas 元素
   */
  generate(emotion, text = '', score = null) {
    // crisis 情绪：生成「求助资源卡片」而非心情卡片（产品伦理考量）
    if (emotion === 'crisis') {
      const crisisCanvas = this._generateCrisisCard();
      // 标记为 crisis 卡片，share() 据此禁止分享
      crisisCanvas._isCrisisCard = true;
      return crisisCanvas;
    }

    const config = this._getEmotionConfig(emotion);
    const canvas = document.createElement('canvas');
    canvas.width = this.WIDTH;
    canvas.height = this.HEIGHT;

    const ctx = canvas.getContext('2d');
    const W = this.WIDTH;
    const H = this.HEIGHT;

    // —— 1. 背景渐变 ——
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, config.gradient[0]);
    gradient.addColorStop(1, config.gradient[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // —— 2. 顶部装饰圆 ——
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(W * 0.8, H * 0.1, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W * 0.2, H * 0.25, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // —— 3. 中间大 emoji ——
    ctx.font = '80px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.emoji, W / 2, H * 0.35);

    // —— 4. 情绪文字标签 ——
    ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = config.textColor;
    ctx.fillText(config.label, W / 2, H * 0.48);

    // —— 5. 分隔线 ——
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W * 0.2, H * 0.54);
    ctx.lineTo(W * 0.8, H * 0.54);
    ctx.stroke();

    // —— 6. 用户文案（如果有） ——
    if (text && text.trim()) {
      ctx.font = '18px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';

      // 自动换行处理
      const maxWidth = W * 0.75;
      const lineHeight = 28;
      const lines = this._wrapText(ctx, text.trim(), maxWidth);

      const startY = H * 0.59;
      lines.slice(0, 4).forEach((line, i) => { // 最多显示4行
        ctx.fillText(line, W / 2, startY + i * lineHeight);
      });
    } else {
      // 没有文案时显示一句默认话
      ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText('记录此刻，拥抱自己', W / 2, H * 0.62);
    }

    // —— 7. 健康评分（如果有） ——
    if (score !== null && score !== undefined) {
      const scoreY = H * 0.76;
      const scoreClamped = Math.max(0, Math.min(100, Math.round(score)));

      // 评分背景圆环
      ctx.beginPath();
      ctx.arc(W / 2, scoreY, 30, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 分数文字
      ctx.font = 'bold 22px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`${scoreClamped}`, W / 2, scoreY + 1);

      // "健康评分"标签
      ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText('健康评分', W / 2, scoreY + 46);
    }

    // —— 8. 底部日期 + 品牌水印 ——
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

    ctx.font = '13px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(dateStr, W / 2, H - 50);

    // 品牌水印
    ctx.font = 'bold 14px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('学伴小管家', W / 2, H - 28);

    console.log('[MoodCard] 卡片生成完成:', config.label);

    return canvas;
  },

  // ========== 文字换行工具 ==========

  /**
   * 将长文本按最大宽度自动换行
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text     - 原始文本
   * @param {number} maxWidth - 每行最大宽度（像素）
   * @returns {Array<string>}  - 分行后的字符串数组
   */
  _wrapText(ctx, text, maxWidth) {
    const lines = [];
    let currentLine = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  },

  // ========== 下载 ==========

  /**
   * 触发下载 canvas 为 PNG 图片
   * @param {HTMLCanvasElement} canvas - MoodCard.generate() 返回的 canvas
   * @param {string} filename - 文件名（可选，默认 mood_card.png）
   */
  download(canvas, filename = 'mood_card.png') {
    try {
      // 将 canvas 转换为 Blob 并触发下载
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('[MoodCard] Canvas 转 Blob 失败');
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();

        // 清理
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);

        // console.log('[MoodCard] 卡片已下载:', filename);
      }, 'image/png');
    } catch (e) {
      console.error('[MoodCard] 下载失败:', e);
    }
  },

  // ========== 分享 ==========

  /**
   * 触发原生分享（Web Share API）
   * 如果浏览器不支持 Web Share API，则自动回退为下载
   * @param {HTMLCanvasElement} canvas - MoodCard.generate() 返回的 canvas
   * @param {string} title - 分享标题（可选，默认"我的心情卡片"）
   * @param {string} text  - 分享文案（可选，默认"来自学伴小管家的情绪打卡"）
   */
  async share(canvas, title = '我的心情卡片', text = '来自学伴小管家的情绪打卡') {
    // crisis 求助资源卡片禁止分享（产品伦理考量，避免将危机状态对外传播）
    if (canvas._isCrisisCard) {
      console.log('[MoodCard] crisis 求助资源卡片禁止分享');
      return;
    }

    // 检查是否支持 Web Share API（需在 HTTPS 或 localhost 下）
    if (!navigator.share || !navigator.canShare) {
      // console.log('[MoodCard] Web Share API 不可用，回退为下载');
      this.download(canvas);
      return;
    }

    try {
      // 将 canvas 转换为 PNG Blob
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas 转 Blob 失败'));
        }, 'image/png');
      });

      // 创建 File 对象用于分享
      const file = new File([blob], 'mood_card.png', { type: 'image/png' });

      // 检查是否可以分享文件
      const shareData = {
        title,
        text,
        files: [file]
      };

      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        console.log('[MoodCard] 分享成功');
      } else {
        // 不支持文件分享，尝试不带文件的分享
        await navigator.share({ title, text });
        console.log('[MoodCard] 文字分享成功（不含图片）');
      }
    } catch (e) {
      // 用户取消分享或发生错误，回退为下载
      if (e.name === 'AbortError') {
        // console.log('[MoodCard] 用户取消分享');
      } else {
        console.warn('[MoodCard] 分享失败，回退为下载:', e.message);
        this.download(canvas);
      }
    }
  },

  // ========== 快捷方法 ==========

  /**
   * 一站式生成并下载卡片
   * @param {string} emotion - 情绪类型
   * @param {string} text    - 用户文案（可选）
   * @param {number} score   - 健康评分（可选）
   */
  generateAndDownload(emotion, text, score) {
    const canvas = this.generate(emotion, text, score);
    this.download(canvas, `mood_${emotion}_${Date.now()}.png`);
  },

  /**
   * 一站式生成并分享卡片
   * @param {string} emotion - 情绪类型
   * @param {string} text    - 用户文案（可选）
   * @param {number} score   - 健康评分（可选）
   */
  async generateAndShare(emotion, text, score) {
    const canvas = this.generate(emotion, text, score);
    await this.share(canvas);
  }
};

// 兼容 CommonJS 模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MoodCard };
}
