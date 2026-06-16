# 排队预约挂号系统

在线预约挂号、排队叫号管理系统。患者可在线预约挂号获取排队号，医生可叫号并记录诊断，管理员可监控排队情况和统计数据。

## 功能

**患者端**
- 注册登录
- 浏览科室和医生
- 选择时段预约挂号，获取排队号
- 查看我的预约记录，取消预约

**医生端**
- 登录工作台，查看今日预约列表
- 一键叫下一位患者
- 填写诊断记录

**管理员端**
- 查看各科室实时排队情况
- 每日/按科室的挂号量统计
- 等待、就诊、完成、取消等状态统计

**排队大屏**
- 实时显示各医生当前叫号、等待人数、预计等待时间
- 15秒自动刷新

## 技术栈

- **前端**: React 18 + TypeScript + Vite
- **后端**: Express + TypeScript + better-sqlite3
- **认证**: JWT + bcryptjs
- **并发启动**: concurrently

## 快速开始

```bash
# 安装所有依赖
npm run install:all

# 初始化种子数据
npm run seed

# 启动开发服务器（前后端同时启动）
npm run dev
```

前端: http://localhost:5205  
后端: http://localhost:3205

## 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 患者 | patient_zhang | 123456 |
| 医生 | doc_wang | 123456 |
| 管理员 | admin | admin123 |

## 项目结构

```
├── package.json          # 根配置
├── server/
│   ├── package.json
│   ├── src/
│   │   ├── index.ts      # Express 服务入口
│   │   ├── db.ts         # 数据库初始化
│   │   ├── auth.ts       # JWT 认证中间件
│   │   ├── seed.ts       # 种子数据
│   │   └── routes/
│   │       ├── auth.ts       # 登录注册
│   │       ├── departments.ts # 科室与医生
│   │       ├── appointments.ts # 预约挂号
│   │       ├── doctor.ts      # 医生叫号与诊断
│   │       ├── queue.ts       # 排队大屏
│   │       └── admin.ts       # 管理后台
│   └── data.db           # SQLite 数据库（自动生成）
└── client/
    ├── package.json
    ├── index.html         # HTML + 全局样式
    ├── vite.config.ts
    └── src/
        ├── main.tsx       # React 入口
        ├── App.tsx        # 应用主组件（路由 + 页面）
        └── api.ts         # API 请求封装
```
