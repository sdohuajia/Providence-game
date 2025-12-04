#!/usr/bin/env node
/**
 * Providence 全自动打卡 + 任务机器人
 * 
 * 极简干净版 | 无水印 | 无询问 | 有代理用代理，没代理自动直连
 * 
 * 2025.12 最新可用 - JavaScript 版本
 */

const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

// 生成随机 User-Agent
function getRandomUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

class Providence {
    constructor() {
        this.api = 'https://hub.playprovidence.io/api';
        this.headers = {};
        this.cookies = {};
        this.proxies = [];
        this.proxyIndex = 0;
        this.accountProxy = {};
    }

    clearScreen() {
        process.stdout.write('\x1B[2J\x1B[0f');
    }

    log(msg) {
        const now = new Date();
        const wib = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const t = wib.toISOString().replace('T', ' ').substring(0, 19);
        console.log(`${chalk.cyan(`[${t}]`)} ${msg}`);
    }

    banner() {
        this.clearScreen();
        console.log(
            chalk.green.bold(
                '██████╗ ██████╗  ██████╗ ██╗   ██╗██╗██████╗ ███████╗███╗   ██╗ ██████╗███████╗\n' +
                '██╔══██╗██╔══██╗██╔═══██╗██║   ██║██║██╔══██╗██╔════╝████╗  ██║██╔════╝██╔════╝\n' +
                '██████╔╝██████╔╝██║   ██║██║   ██║██║██║  ██║█████╗  ██╔██╗ ██║██║     █████╗  \n' +
                '██╔═══╝ ██╔══██╗██║   ██║╚██╗ ██╔╝██║██║  ██║██╔══╝  ██║╚██╗██║██║     ██╔══╝  \n' +
                '██║     ██║  ██║╚██████╔╝ ╚████╔╝ ██║██████╔╝███████╗██║ ╚████║╚██████╗███████╗\n' +
                '╚═╝     ╚═╝  ╚═╝ ╚═════╝   ╚═══╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝\n'
            ) +
            chalk.white.bold('               全自动每日打卡 + 任务完成机器人 · 2025.12 稳定版\n') +
            chalk.reset()
        );
    }

    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    async loadProxies() {
        try {
            await fs.access('proxy.txt');
        } catch {
            this.log(chalk.yellow('未检测到 proxy.txt → 使用直连模式'));
            return;
        }

        const content = await fs.readFile('proxy.txt', 'utf-8');
        const lines = content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));

        if (lines.length === 0) {
            this.log(chalk.yellow('proxy.txt 为空 → 使用直连模式'));
            return;
        }

        this.proxies = lines.map(p => {
            if (!p.startsWith('http') && !p.startsWith('socks')) {
                return 'http://' + p;
            }
            return p;
        });

        this.log(chalk.green(`成功加载 ${this.proxies.length} 个代理`));
    }

    getProxy(token) {
        if (this.proxies.length === 0) {
            return null;
        }

        if (!this.accountProxy[token]) {
            const proxy = this.proxies[this.proxyIndex];
            this.accountProxy[token] = proxy;
            this.proxyIndex = (this.proxyIndex + 1) % this.proxies.length;
        }

        return this.accountProxy[token];
    }

    hideEmail(email) {
        if (!email || !email.includes('@')) {
            return '未知邮箱';
        }

        const [local, domain] = email.split('@', 2);
        return `${local.substring(0, 3)}***${local.substring(local.length - 2)}@${domain}`;
    }

    async request(method, url, token, data = null, proxy = null) {
        const headers = {
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Origin': 'https://hub.playprovidence.io',
            'Referer': 'https://hub.playprovidence.io/',
            'User-Agent': getRandomUserAgent(),
        };

        if (data) {
            headers['Content-Type'] = 'application/json';
        }

        const config = {
            method,
            url,
            headers: {
                ...headers,
                'Cookie': `__Secure-authjs.session-token=${token.trim()}`
            },
            timeout: 60000,
        };

        if (data) {
            config.data = typeof data === 'string' ? data : JSON.stringify(data);
        }

        // 配置代理
        if (proxy) {
            if (proxy.startsWith('socks')) {
                // SOCKS 代理需要使用 agent
                const agent = new SocksProxyAgent(proxy);
                config.httpsAgent = agent;
                config.httpAgent = agent;
            } else {
                // HTTP/HTTPS 代理可以直接使用 URL
                config.proxy = false; // 禁用默认代理
                const agent = new HttpsProxyAgent(proxy);
                config.httpsAgent = agent;
                config.httpAgent = agent;
            }
        }

        try {
            const response = await axios(config);
            if (response.data) {
                return response.data;
            }
        } catch (error) {
            // 静默处理错误
        }

        return null;
    }

    async processAccount(token) {
        const proxy = this.getProxy(token);

        // 获取用户信息
        const info = await this.request('GET', `${this.api}/user/stats`, token, null, proxy);
        if (!info || !info.data) {
            this.log(chalk.red('✗ 账号失效或网络错误'));
            return;
        }

        const user = info.data;
        this.log(
            chalk.cyan(
                `账号: ${this.hideEmail(user.user_email || '未知')} | 等级 ${user.level || 0} | 总经验 ${user.total_xp || 0} XP`
            )
        );

        // 每日打卡
        const status = await this.request('GET', `${this.api}/daily-checkin/status`, token, null, proxy);
        if (status && status.data && status.data.canCheckinToday) {
            const result = await this.request('POST', `${this.api}/daily-checkin/checkin`, token, null, proxy);
            if (result && result.success) {
                const xp = result.data.xpEarned;
                this.log(chalk.green(`✓ 每日打卡成功 +${xp} XP`));
            } else {
                this.log(chalk.red('✗ 打卡失败'));
            }
        } else {
            this.log(chalk.yellow('今日已打卡'));
        }

        // 每日任务
        const tasks = await this.request('GET', `${this.api}/quests/daily-link/today`, token, null, proxy);
        if (tasks && tasks.data) {
            const total = tasks.data.length;
            const completed = tasks.data.filter(t => t.isCompleted).length;
            this.log(`发现 ${total} 个日常任务（${completed} 个已完成）`);

            for (const task of tasks.data) {
                if (task.isCompleted) {
                    continue;
                }

                const result = await this.request(
                    'POST',
                    `${this.api}/quests/daily-link/complete`,
                    token,
                    JSON.stringify({ questId: task.id }),
                    proxy
                );

                if (result && result.success) {
                    this.log(chalk.green(`   ✓ ${task.title} +${task.xp} XP`));
                } else {
                    this.log(chalk.red(`   ✗ ${task.title} 完成失败`));
                }

                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        } else {
            this.log(chalk.cyan('暂无日常任务'));
        }
    }

    async run() {
        this.banner();

        let tokens = [];
        try {
            await fs.access('tokens.txt');
            const content = await fs.readFile('tokens.txt', 'utf-8');
            tokens = content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line);
        } catch {
            this.log(chalk.red('错误：未找到 tokens.txt 文件'));
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on('data', () => {
                process.exit(0);
            });
            return;
        }

        if (tokens.length === 0) {
            this.log(chalk.red('tokens.txt 为空'));
            return;
        }

        this.log(`共加载 ${tokens.length} 个账号`);
        await this.loadProxies();

        const processCycle = async () => {
            this.banner();
            this.log(`开始处理 ${tokens.length} 个账号`);

            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                this.log(`${'─'.repeat(20)} 第 ${i + 1}/${tokens.length} 个账号 ${'─'.repeat(20)}`);
                await this.processAccount(token);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            this.log(chalk.green.bold('本轮全部完成，进入 12 小时等待周期'));

            let remaining = 12 * 3600;
            while (remaining > 0) {
                process.stdout.write(`\r${chalk.cyan(`下一轮倒计时：${this.formatTime(remaining)}     `)}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                remaining--;
            }
            console.log(''); // 换行

            // 继续下一轮
            processCycle();
        };

        processCycle();
    }
}

// 主程序入口
if (require.main === module) {
    const bot = new Providence();
    bot.run().catch(error => {
        console.error(chalk.red('运行出错:'), error);
        process.exit(1);
    });

    // 处理 Ctrl+C
    process.on('SIGINT', () => {
        console.log(`\n${chalk.red('已手动停止脚本')}`);
        process.exit(0);
    });
}

module.exports = Providence;

