## Providence-Bot

简洁说明：本工具用于自动签到与每日任务，多账号支持，支持代理（可选）。

### 环境要求
- 已安装 Node.js 18+ 与 npm

### 拉取与进入目录
```bash
git clone https://github.com/sdohuajia/Providence-game.git
cd Providence-game
```

### 安装依赖
```bash
npm install
```

### 配置
- 在项目根目录创建或编辑 `tokens.txt`，每行一个会话 token：
```
your_session_token_1
your_session_token_2
```
- 如需代理（可选），创建或编辑 `proxy.txt`：
```
192.168.1.1:8080
http://192.168.1.1:8080
http://username:password@192.168.1.1:8080
```

### 运行
```bash
npm start
```
运行后按提示选择“使用代理运行 / 不使用代理运行”。程序标题会显示为 `Providence-Bot`。

### 说明
- 程序输出与提示为中文。
- 不会自动轮换无效代理。
- 若出现网络异常，请检查本地网络或代理设置。
