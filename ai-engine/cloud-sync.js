/**
 * 学伴小管家 - 数据云同步模块 V1
 *
 * 功能：
 *   - 接入 Supabase 免费层（可选，用户自行配置）
 *   - 支持跨设备同步情绪记录、学习计划、成就数据
 *   - 本地优先：无网络/未配置时纯本地，配置后自动同步
 *   - 数据导出/导入（JSON 格式，不依赖云端）
 *   - 隐私保护：所有数据加密传输，用户可随时清除
 *
 * 使用方式：
 *   1. 用户在设置中填入 Supabase URL 和 Anon Key
 *   2. 数据自动在 LocalStorage 变更后同步到云端
 *   3. 新设备登录后可拉取历史数据
 */

const CloudSync = {
  // Supabase 配置
  _supabaseUrl: '',
  _supabaseKey: '',
  _userId: '',

  // 初始化
  init() {
    this._supabaseUrl = localStorage.getItem('studybuddy_supabase_url') || '';
    this._supabaseKey = localStorage.getItem('studybuddy_supabase_key') || '';
    this._userId = localStorage.getItem('studybuddy_user_id') || this._generateUserId();
  },

  _generateUserId() {
    const id = 'user_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('studybuddy_user_id', id);
    return id;
  },

  // 是否已配置
  isConfigured() {
    return !!(this._supabaseUrl && this._supabaseKey);
  },

  // 保存配置
  setConfig(url, key) {
    this._supabaseUrl = url;
    this._supabaseKey = key;
    localStorage.setItem('studybuddy_supabase_url', url);
    localStorage.setItem('studybuddy_supabase_key', key);
  },

  // 清除配置
  clearConfig() {
    this._supabaseUrl = '';
    this._supabaseKey = '';
    localStorage.removeItem('studybuddy_supabase_url');
    localStorage.removeItem('studybuddy_supabase_key');
  },

  /**
   * 同步数据到云端
   * @param {string} type - 数据类型：emotion_log | study_plan | achievements | settings
   * @param {any} data - 要同步的数据
   */
  async sync(type, data) {
    if (!this.isConfigured()) return { success: false, reason: 'not_configured' };

    try {
      const response = await fetch(`${this._supabaseUrl}/rest/v1/user_data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this._supabaseKey,
          'Authorization': `Bearer ${this._supabaseKey}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          user_id: this._userId,
          data_type: type,
          data: JSON.stringify(data),
          updated_at: new Date().toISOString()
        })
      });

      if (response.ok || response.status === 201) {
        return { success: true };
      }
      console.warn('[CloudSync] 同步失败:', response.status);
      return { success: false, reason: 'api_error', status: response.status };
    } catch (e) {
      console.warn('[CloudSync] 网络错误:', e.message);
      return { success: false, reason: 'network_error' };
    }
  },

  /**
   * 从云端拉取数据
   * @param {string} type - 数据类型
   */
  async pull(type) {
    if (!this.isConfigured()) return { success: false, data: null };

    try {
      const response = await fetch(
        `${this._supabaseUrl}/rest/v1/user_data?user_id=eq.${this._userId}&data_type=eq.${type}&order=updated_at.desc&limit=1`,
        {
          headers: {
            'apikey': this._supabaseKey,
            'Authorization': `Bearer ${this._supabaseKey}`
          }
        }
      );

      if (!response.ok) return { success: false, data: null };

      const result = await response.json();
      if (result && result.length > 0 && result[0].data) {
        return { success: true, data: JSON.parse(result[0].data) };
      }
      return { success: false, data: null };
    } catch (e) {
      return { success: false, data: null };
    }
  },

  /**
   * 拉取所有数据（新设备恢复用）
   */
  async pullAll() {
    if (!this.isConfigured()) return { success: false };

    const types = ['emotion_log', 'study_plan', 'achievements', 'settings'];
    const results = {};

    for (const type of types) {
      const r = await this.pull(type);
      if (r.success && r.data) {
        results[type] = r.data;
      }
    }

    return { success: Object.keys(results).length > 0, data: results };
  },

  /**
   * 导出所有数据为 JSON 文件（不依赖云端）
   */
  exportAll() {
    const data = {
      _meta: {
        app: '学伴小管家',
        version: '1.0',
        exportTime: new Date().toISOString(),
        userId: this._userId
      },
      emotion_log: JSON.parse(localStorage.getItem('studybuddy_emotion_log') || '[]'),
      chat_history: JSON.parse(localStorage.getItem('studybuddy_chat_history') || '[]'),
      study_plans: JSON.parse(localStorage.getItem('studybuddy_study_plans') || '[]'),
      achievements: JSON.parse(localStorage.getItem('studybuddy_achievements') || '{}'),
      task_check_state: JSON.parse(localStorage.getItem('studybuddy_task_check') || '{}'),
      care_dismissed: JSON.parse(localStorage.getItem('studybuddy_care_dismissed') || '{}'),
      pomodoro_stats: JSON.parse(localStorage.getItem('studybuddy_pomodoro') || '{}')
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `学伴小管家-数据导出-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return true;
  },

  /**
   * 从 JSON 文件导入数据
   * @param {File} file - 用户选择的 JSON 文件
   */
  async importFromFile(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data._meta || data._meta.app !== '学伴小管家') {
        return { success: false, reason: 'invalid_format' };
      }

      if (data.emotion_log) {
        localStorage.setItem('studybuddy_emotion_log', JSON.stringify(data.emotion_log));
      }
      if (data.chat_history) {
        localStorage.setItem('studybuddy_chat_history', JSON.stringify(data.chat_history));
      }
      if (data.study_plans) {
        localStorage.setItem('studybuddy_study_plans', JSON.stringify(data.study_plans));
      }
      if (data.achievements) {
        localStorage.setItem('studybuddy_achievements', JSON.stringify(data.achievements));
      }
      if (data.task_check_state) {
        localStorage.setItem('studybuddy_task_check', JSON.stringify(data.task_check_state));
      }
      if (data.care_dismissed) {
        localStorage.setItem('studybuddy_care_dismissed', JSON.stringify(data.care_dismissed));
      }
      if (data.pomodoro_stats) {
        localStorage.setItem('studybuddy_pomodoro', JSON.stringify(data.pomodoro_stats));
      }

      return { success: true, count: Object.keys(data).length - 1 };
    } catch (e) {
      return { success: false, reason: 'parse_error', error: e.message };
    }
  },

  /**
   * 清除所有本地数据
   */
  clearAllLocal() {
    const keys = [
      'studybuddy_emotion_log', 'studybuddy_chat_history', 'studybuddy_study_plans',
      'studybuddy_achievements', 'studybuddy_task_check', 'studybuddy_care_dismissed',
      'studybuddy_pomodoro', 'studybuddy_doubao_apikey'
    ];
    keys.forEach(k => localStorage.removeItem(k));
    return true;
  }
};

// 自动初始化
if (typeof window !== 'undefined') {
  CloudSync.init();
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CloudSync };
}
