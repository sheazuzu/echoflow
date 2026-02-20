# 多语言功能快速开始

## 🚀 快速体验

1. **启动应用**
   ```bash
   cd frontend
   npm run dev
   ```

2. **访问应用**
   - 中文版：http://localhost:5174/zh 或 http://localhost:5174/
   - 英文版：http://localhost:5174/en

3. **切换语言**
   - 点击右上角的语言选择器
   - 或直接修改 URL 路径

## 📝 在代码中使用

### 1. 翻译文本

```jsx
import { useTranslation } from './i18n';

function MyComponent() {
  const { t } = useTranslation();
  
  return <h1>{t('home.title')}</h1>;
}
```

### 2. 带参数的翻译

```jsx
const { t } = useTranslation();

// 翻译文件中: "欢迎 {name}"
<p>{t('welcome.message', { name: '张三' })}</p>
```

### 3. 格式化日期和数字

```jsx
import { formatDate, formatFileSize } from './i18n';
import { useTranslation } from './i18n';

function MyComponent() {
  const { currentLanguage } = useTranslation();
  
  return (
    <div>
      <p>{formatDate(new Date(), currentLanguage)}</p>
      <p>{formatFileSize(1024000, currentLanguage)}</p>
    </div>
  );
}
```

## 🌍 添加新语言

### 步骤 1: 创建翻译文件

在 `frontend/src/i18n/locales/` 创建 `ja.js`：

```javascript
export default {
  common: {
    appName: 'EchoFlow Pro',
    buttons: {
      confirm: '確認',
      cancel: 'キャンセル',
    },
  },
  home: {
    title: 'AI会議議事録生成',
  },
  // ... 其他翻译
};
```

### 步骤 2: 更新配置

编辑 `frontend/src/i18n/config.js`：

```javascript
export const SUPPORTED_LANGUAGES = ['zh', 'en', 'ja'];

export const LANGUAGE_METADATA = {
  // ... 现有配置
  ja: {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    htmlLang: 'ja',
    direction: 'ltr'
  }
};
```

### 步骤 3: 导出翻译

编辑 `frontend/src/i18n/locales/index.js`：

```javascript
import zh from './zh.js';
import en from './en.js';
import ja from './ja.js';

export default {
  zh,
  en,
  ja,
};
```

完成！现在可以访问 http://localhost:5174/ja

## 📚 更多文档

- [完整使用指南](./I18N_GUIDE.md)
- [实施总结](./I18N_IMPLEMENTATION_SUMMARY.md)

## ❓ 常见问题

**Q: 翻译不显示怎么办？**
A: 检查翻译键是否正确，查看浏览器控制台是否有警告。

**Q: 如何修改默认语言？**
A: 编辑 `frontend/src/i18n/config.js` 中的 `DEFAULT_LANGUAGE`。

**Q: 语言切换后页面没有更新？**
A: 确保组件使用了 `useTranslation` Hook，并且使用 `t()` 函数而不是硬编码文本。

## 🎯 核心 API

### useTranslation()
```jsx
const { t, currentLanguage, changeLanguage } = useTranslation();
```

### 格式化函数
```jsx
formatDate(date, lang)
formatTime(date, lang)
formatFileSize(bytes, lang)
formatDuration(seconds, lang)
```

## 💡 最佳实践

1. ✅ 始终使用 `t()` 函数，避免硬编码文本
2. ✅ 使用描述性的翻译键名
3. ✅ 保持所有语言文件结构一致
4. ✅ 使用格式化函数处理日期、数字等
5. ❌ 不要在翻译文本中包含 HTML 标签

## 🔧 开发工具

### 查找缺失的翻译
```bash
# 比较中英文翻译文件
diff frontend/src/i18n/locales/zh.js frontend/src/i18n/locales/en.js
```

### 验证翻译键
在浏览器控制台中，缺失的翻译键会显示警告。

---

**祝你使用愉快！** 🎉
