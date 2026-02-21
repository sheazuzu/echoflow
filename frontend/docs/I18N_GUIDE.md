# 多语言功能使用指南

## 概述

Meet and Note 现已支持中英文双语切换功能。用户可以通过右上角的语言选择器在中文和英文之间切换，系统会自动保存语言偏好。

## 功能特性

### 1. 基于路径的语言切换
- **中文路径**: `/zh` 或 `/`（默认）
- **英文路径**: `/en`
- 语言偏好会自动保存到 localStorage

### 2. 语言选择器
- 位于页面右上角
- 显示当前语言
- 点击可切换语言
- 响应式设计，移动端自动适配

### 3. 自动语言检测
优先级顺序：
1. URL 路径中的语言参数
2. localStorage 中保存的语言偏好
3. 浏览器语言设置
4. 默认语言（中文）

### 4. SEO 和可访问性
- 自动更新 `<html lang="...">` 属性
- 自动更新页面标题
- 自动更新 meta description
- 支持 RTL 语言（预留）

## 开发指南

### 使用翻译功能

在组件中使用 `useTranslation` Hook：

```jsx
import { useTranslation } from './i18n';

function MyComponent() {
  const { t, currentLanguage } = useTranslation();
  
  return (
    <div>
      <h1>{t('home.title')}</h1>
      <p>{t('home.subtitle')}</p>
    </div>
  );
}
```

### 带参数的翻译

```jsx
// 翻译文件中
{
  upload: {
    maxFileSize: '最大文件大小：{size}MB'
  }
}

// 组件中使用
<p>{t('upload.maxFileSize', { size: 100 })}</p>
```

### 使用格式化工具

```jsx
import { formatDate, formatFileSize, formatDuration } from './i18n';
import { useTranslation } from './i18n';

function MyComponent() {
  const { currentLanguage } = useTranslation();
  
  return (
    <div>
      <p>{formatDate(new Date(), currentLanguage)}</p>
      <p>{formatFileSize(1024000, currentLanguage)}</p>
      <p>{formatDuration(3665, currentLanguage)}</p>
    </div>
  );
}
```

### 监听语言变化

```jsx
import { useLanguageChange } from './i18n';

function MyComponent() {
  useLanguageChange((newLanguage) => {
    console.log('Language changed to:', newLanguage);
    // 执行需要的操作
  });
  
  return <div>...</div>;
}
```

### 更新文档语言属性

```jsx
import { useDocumentLanguage } from './i18n';

function App() {
  useDocumentLanguage(); // 自动更新 HTML lang 属性和页面标题
  
  return <div>...</div>;
}
```

## 添加新语言

### 1. 创建翻译文件

在 `frontend/src/i18n/locales/` 目录下创建新的语言文件，例如 `ja.js`（日语）：

```javascript
export default {
  common: {
    appName: 'Meet and Note',
    buttons: {
      confirm: '確認',
      cancel: 'キャンセル',
      // ...
    },
    // ...
  },
  // ...
};
```

### 2. 更新配置

在 `frontend/src/i18n/config.js` 中添加新语言：

```javascript
export const SUPPORTED_LANGUAGES = ['zh', 'en', 'ja'];

export const LANGUAGE_METADATA = {
  // ...
  ja: {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    htmlLang: 'ja',
    direction: 'ltr'
  }
};
```

### 3. 导出翻译资源

在 `frontend/src/i18n/locales/index.js` 中导出新语言：

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

## 翻译文件结构

翻译文件按功能模块组织：

```
translations/
├── common          # 通用文本（按钮、标签、消息）
├── home            # 首页
├── upload          # 上传功能
├── recording       # 录音功能
├── processing      # 处理步骤
├── minutes         # 会议纪要
├── email           # 邮件发送
├── errors          # 错误消息
├── success         # 成功消息
├── footer          # 页脚
├── features        # 功能特性
├── shortcuts       # 快捷键
├── states          # 状态
├── dialogs         # 对话框
└── tips            # 提示
```

## 最佳实践

### 1. 翻译键命名
- 使用点号分隔的层级结构
- 使用描述性的键名
- 保持一致的命名风格

```javascript
// 好的示例
t('upload.dragDropHint')
t('recording.startRecording')
t('errors.networkError')

// 不好的示例
t('text1')
t('btn')
t('err')
```

### 2. 避免硬编码文本
```jsx
// ❌ 不好
<button>开始录音</button>

// ✅ 好
<button>{t('recording.startRecording')}</button>
```

### 3. 使用格式化工具
```jsx
// ❌ 不好
<p>{fileSize} bytes</p>

// ✅ 好
<p>{formatFileSize(fileSize, currentLanguage)}</p>
```

### 4. 保持翻译文件同步
- 添加新键时，同时更新所有语言文件
- 使用相同的结构和键名
- 定期检查缺失的翻译

## 故障排除

### 翻译不显示
1. 检查翻译键是否正确
2. 检查翻译文件中是否存在该键
3. 查看浏览器控制台是否有警告

### 语言切换不生效
1. 检查 URL 路径是否正确
2. 清除浏览器 localStorage
3. 检查路由配置

### 格式化显示异常
1. 检查传入的数据类型是否正确
2. 检查语言代码是否有效
3. 查看浏览器控制台错误信息

## 技术架构

### 核心组件
- **I18nProvider**: 提供国际化上下文
- **useTranslation**: 翻译 Hook
- **LanguageRouter**: 路由语言守卫
- **LanguageSwitcher**: 语言选择器 UI

### 工具函数
- **config.js**: 语言配置和元数据
- **utils.js**: 语言检测和路径处理
- **formatters.js**: 本地化格式化工具
- **useDocumentLanguage.js**: 文档语言更新

### 翻译资源
- **locales/zh.js**: 中文翻译
- **locales/en.js**: 英文翻译
- **locales/index.js**: 翻译资源索引

## 性能优化

1. **懒加载翻译文件**（未来优化）
   - 按需加载语言包
   - 减少初始加载体积

2. **翻译缓存**
   - 使用 useMemo 缓存翻译结果
   - 避免重复计算

3. **代码分割**
   - 将翻译文件独立打包
   - 支持并行加载

## 未来扩展

- [ ] 支持更多语言（日语、韩语、法语等）
- [ ] 翻译管理后台
- [ ] 自动翻译集成
- [ ] 翻译质量检查工具
- [ ] 翻译进度追踪
- [ ] 社区翻译贡献

## 相关资源

- [React Internationalization](https://react.i18next.com/)
- [Intl API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)
- [CLDR](http://cldr.unicode.org/)
