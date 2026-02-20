# EchoFlow Pro - 多语言功能文档

## 📖 文档导航

### 快速开始
- **[快速开始指南](./I18N_QUICKSTART.md)** - 5分钟快速上手多语言功能

### 详细文档
- **[完整使用指南](./I18N_GUIDE.md)** - 详细的功能介绍、开发指南和最佳实践
- **[实施总结](./I18N_IMPLEMENTATION_SUMMARY.md)** - 技术架构和实施细节

## 🌍 功能概览

EchoFlow Pro 现已支持完整的多语言功能：

- ✅ **中英文双语支持** - 完整的中英文翻译（300+ 条）
- ✅ **基于路径的语言切换** - `/zh`、`/en`、`/`（默认中文）
- ✅ **智能语言检测** - 自动检测浏览器语言
- ✅ **语言偏好持久化** - 使用 localStorage 保存用户选择
- ✅ **语言选择器 UI** - 右上角优雅的下拉菜单
- ✅ **本地化格式化** - 日期、时间、数字、文件大小等
- ✅ **SEO 优化** - 自动更新 HTML lang 属性和 meta 标签
- ✅ **高可扩展性** - 易于添加新语言

## 🚀 快速体验

```bash
# 启动应用
cd frontend
npm run dev

# 访问不同语言版本
# 中文：http://localhost:5174/zh
# 英文：http://localhost:5174/en
```

## 💻 基本使用

```jsx
import { useTranslation } from './i18n';

function MyComponent() {
  const { t, currentLanguage } = useTranslation();
  
  return (
    <div>
      <h1>{t('home.title')}</h1>
      <p>{t('upload.maxFileSize', { size: 100 })}</p>
    </div>
  );
}
```

## 📁 文件结构

```
frontend/src/
├── i18n/
│   ├── config.js              # 语言配置
│   ├── utils.js               # 工具函数
│   ├── I18nContext.jsx        # Context 和 Hooks
│   ├── formatters.js          # 格式化工具
│   ├── useDocumentLanguage.js # 文档语言 Hook
│   ├── index.js               # 主入口
│   └── locales/
│       ├── zh.js              # 中文翻译
│       ├── en.js              # 英文翻译
│       └── index.js           # 翻译索引
├── components/
│   ├── LanguageRouter.jsx     # 路由守卫
│   └── LanguageSwitcher.jsx   # 语言选择器
└── docs/
    ├── README.md              # 本文件
    ├── I18N_QUICKSTART.md     # 快速开始
    ├── I18N_GUIDE.md          # 完整指南
    └── I18N_IMPLEMENTATION_SUMMARY.md  # 实施总结
```

## 🎯 核心 API

### Hooks
- `useTranslation()` - 获取翻译函数和语言状态
- `useLanguageChange(callback)` - 监听语言变化
- `useDocumentLanguage()` - 自动更新文档语言属性

### 格式化函数
- `formatDate(date, lang)` - 格式化日期
- `formatTime(date, lang)` - 格式化时间
- `formatFileSize(bytes, lang)` - 格式化文件大小
- `formatDuration(seconds, lang)` - 格式化时长
- `formatNumber(number, lang)` - 格式化数字

### 工具函数
- `buildLanguagePath(lang, path)` - 构建带语言前缀的路径
- `getLanguageFromPath(pathname)` - 从路径提取语言代码
- `getCurrentLanguage()` - 获取当前应该使用的语言

## 🌟 特色功能

### 1. 智能语言检测
系统会按以下优先级自动选择语言：
1. URL 路径中的语言参数
2. localStorage 中保存的语言偏好
3. 浏览器语言设置
4. 默认语言（中文）

### 2. 无缝语言切换
- 切换语言时保持当前页面状态
- URL 自动更新
- 语言偏好自动保存

### 3. 完整的本地化支持
- 日期和时间按语言格式化
- 数字按语言习惯显示
- 文件大小单位本地化

### 4. SEO 友好
- 自动更新 `<html lang="...">`
- 自动更新页面标题
- 自动更新 meta description

## 🔧 添加新语言

只需三步：

1. 创建翻译文件 `locales/[lang].js`
2. 更新 `config.js` 添加语言配置
3. 在 `locales/index.js` 导出新语言

详细步骤请参考 [完整使用指南](./I18N_GUIDE.md#添加新语言)

## 📊 翻译覆盖率

当前翻译覆盖的模块：

- ✅ 通用文本（按钮、标签、消息）
- ✅ 首页和主界面
- ✅ 上传功能
- ✅ 录音功能
- ✅ 处理步骤
- ✅ 会议纪要
- ✅ 邮件发送
- ✅ 错误消息
- ✅ 成功消息
- ✅ 页脚
- ✅ 功能特性
- ✅ 对话框
- ✅ 提示信息

## 🐛 故障排除

### 翻译不显示
- 检查翻译键是否正确
- 查看浏览器控制台警告
- 确认翻译文件中存在该键

### 语言切换不生效
- 检查 URL 路径是否正确
- 清除浏览器 localStorage
- 刷新页面

### 格式化显示异常
- 检查传入的数据类型
- 确认语言代码有效
- 查看控制台错误信息

更多问题请参考 [完整使用指南](./I18N_GUIDE.md#故障排除)

## 📈 性能优化

- ✅ 使用 React Context 避免 prop drilling
- ✅ 使用 useMemo 缓存翻译对象
- ✅ 使用 useCallback 缓存函数
- ✅ 最小化重渲染
- 🔄 未来可实现翻译文件懒加载

## 🚧 后续计划

### 短期
- [ ] 完成 App.jsx 所有文本国际化
- [ ] 添加更多格式化选项
- [ ] 完善错误处理

### 中期
- [ ] 添加更多语言（日语、韩语、法语等）
- [ ] 实现翻译文件懒加载
- [ ] 添加翻译质量检查工具

### 长期
- [ ] 集成翻译管理平台
- [ ] 支持社区翻译贡献
- [ ] 实现自动翻译集成

## 🤝 贡献

欢迎贡献翻译！请参考 [完整使用指南](./I18N_GUIDE.md) 了解如何添加新语言或改进现有翻译。

## 📞 联系方式

如有问题或建议，请联系开发团队。

---

**让 EchoFlow Pro 走向世界！** 🌍✨
