import fs from 'fs';
import readline from 'readline';
import chalk from 'chalk';
import axios from 'axios';
import inquirer from 'inquirer';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import ProxyAgent from 'proxy-agent';

const BASE_API = 'https://hub.playprovidence.io/api';

function setConsoleTitle(title) {
  if (process.platform === 'win32') {
    process.title = title;
    process.stdout.write(`\x1b]0;${title}\x07`);
  } else {
    process.title = title;
  }
}

function clearTerminal() {
  process.stdout.write(process.platform === 'win32' ? '\x1Bc' : '\x1b[2J\x1b[3J\x1b[H');
}

function formatBeijing(date) {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const y = map.year;
  const m = String(Number(map.month));
  const d = String(Number(map.day));
  const hh = map.hour.padStart(2, '0');
  const mm = map.minute.padStart(2, '0');
  const ss = map.second.padStart(2, '0');
  return `${y}/${m}/${d}, ${hh}:${mm}:${ss}`;
}

function nowStr() {
  return formatBeijing(new Date());
}

function log(message) {
  console.log(
    `${chalk.cyanBright(`[ ${nowStr()} ]`)}${chalk.whiteBright(' | ')}${message}`
  );
}

function welcome() {
  console.log(`\n${chalk.greenBright('Providence')} ${chalk.blueBright('自动 BOT')}\n`);
}

function formatSeconds(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

function ensureProtocol(proxy) {
  if (!proxy) return null;
  const schemes = ['http://', 'https://', 'socks4://', 'socks5://'];
  if (schemes.some(s => proxy.startsWith(s))) return proxy;
  return `http://${proxy}`;
}

function buildAxiosConfigForProxy(proxy) {
  if (!proxy) return { httpAgent: undefined, httpsAgent: undefined, headers: {} };

  const url = ensureProtocol(proxy);
  if (url.startsWith('socks4://') || url.startsWith('socks5://')) {
    const agent = new SocksProxyAgent(url);
    return { httpAgent: agent, httpsAgent: agent, headers: {} };
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Extract possible auth in http://user:pass@host:port
    const match = url.match(/^http:\/\/(.*?):(.*?)@(.*)$/);
    if (match) {
      const [, username, password, hostPort] = match;
      const clean = `http://${hostPort}`;
      const agent = new HttpsProxyAgent(clean);
      const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
      return { httpAgent: agent, httpsAgent: agent, headers: { 'Proxy-Authorization': authHeader } };
    }
    const agent = new HttpsProxyAgent(url);
    return { httpAgent: agent, httpsAgent: agent, headers: {} };
  }

  return { httpAgent: undefined, httpsAgent: undefined, headers: {} };
}

async function checkConnection(proxy) {
  try {
    const { httpAgent, httpsAgent, headers } = buildAxiosConfigForProxy(proxy);
    await axios.get('https://api.ipify.org?format=json', { httpAgent, httpsAgent, headers, timeout: 30000 });
    return true;
  } catch (e) {
    log(`${chalk.cyanBright('状态   :')}${chalk.redBright(' 连接非 200 OK ')}${chalk.magentaBright('-')}${chalk.yellowBright(` ${e.message} `)}`);
    return false;
  }
}

async function userStats(token, proxy) {
  const url = `${BASE_API}/user/stats`;
  const { httpAgent, httpsAgent, headers } = buildAxiosConfigForProxy(proxy);
  try {
    const res = await axios.get(url, {
      httpAgent, httpsAgent, headers,
      timeout: 60000,
      headers: {
        ...headers,
        'Accept': '*/*',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Origin': 'https://hub.playprovidence.io',
        'Referer': 'https://hub.playprovidence.io/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Cookie': `__Secure-authjs.session-token=${token}`
      }
    });
    return res.data;
  } catch (e) {
    throw e;
  }
}

async function checkinStatus(token, proxy) {
  const url = `${BASE_API}/daily-checkin/status`;
  const { httpAgent, httpsAgent, headers } = buildAxiosConfigForProxy(proxy);
  const res = await axios.get(url, {
    httpAgent, httpsAgent, headers,
    timeout: 60000,
    headers: {
      ...headers,
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'Origin': 'https://hub.playprovidence.io',
      'Referer': 'https://hub.playprovidence.io/',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Cookie': `__Secure-authjs.session-token=${token}`
    }
  });
  return res.data;
}

async function claimCheckin(token, proxy) {
  const url = `${BASE_API}/daily-checkin/checkin`;
  const { httpAgent, httpsAgent, headers } = buildAxiosConfigForProxy(proxy);
  const res = await axios.post(url, undefined, {
    httpAgent, httpsAgent, headers,
    timeout: 60000,
    headers: {
      ...headers,
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'Origin': 'https://hub.playprovidence.io',
      'Referer': 'https://hub.playprovidence.io/',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Content-Length': '0',
      'Cookie': `__Secure-authjs.session-token=${token}`
    }
  });
  return res.data;
}

async function dailyTasks(token, proxy) {
  const url = `${BASE_API}/quests/daily-link/today`;
  const { httpAgent, httpsAgent, headers } = buildAxiosConfigForProxy(proxy);
  const res = await axios.get(url, {
    httpAgent, httpsAgent, headers,
    timeout: 60000,
    headers: {
      ...headers,
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'Origin': 'https://hub.playprovidence.io',
      'Referer': 'https://hub.playprovidence.io/',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Cookie': `__Secure-authjs.session-token=${token}`
    }
  });
  return res.data;
}

async function completeTask(token, questId, questName, proxy) {
  const url = `${BASE_API}/quests/daily-link/complete`;
  const { httpAgent, httpsAgent, headers } = buildAxiosConfigForProxy(proxy);
  const body = { questId };
  const res = await axios.post(url, body, {
    httpAgent, httpsAgent, headers,
    timeout: 60000,
    headers: {
      ...headers,
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'Origin': 'https://hub.playprovidence.io',
      'Referer': 'https://hub.playprovidence.io/',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Content-Type': 'application/json',
      'Cookie': `__Secure-authjs.session-token=${token}`
    }
  });
  return res.data;
}

async function askRuntimeOptions() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'proxyChoice',
      message: '选择运行模式',
      choices: [
        { name: '1. 使用代理运行', value: 1 },
        { name: '2. 不使用代理运行', value: 2 }
      ]
    }
  ]);
  return { proxyChoice: answers.proxyChoice, rotateProxy: false };
}

function loadTokens() {
  if (!fs.existsSync('tokens.txt')) throw new Error("未找到文件 'tokens.txt'");
  return fs.readFileSync('tokens.txt', 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function loadProxies() {
  const filename = 'proxy.txt';
  if (!fs.existsSync(filename)) {
    log(chalk.redBright(`未找到文件 ${filename}`));
    return [];
  }
  const list = fs.readFileSync(filename, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!list.length) {
    log(chalk.redBright('未找到任何代理。'));
  } else {
    log(`${chalk.greenBright('代理总数      : ')}${chalk.whiteBright(list.length)}`);
  }
  return list;
}

function makeAccountProxyRotator(proxies) {
  let index = 0;
  const accountToProxy = new Map();
  function nextFor(account) {
    if (!proxies.length) return null;
    if (!accountToProxy.has(account)) {
      accountToProxy.set(account, ensureProtocol(proxies[index]));
      index = (index + 1) % proxies.length;
    }
    return accountToProxy.get(account);
  }
  function rotate(account) {
    if (!proxies.length) return null;
    const p = ensureProtocol(proxies[index]);
    accountToProxy.set(account, p);
    index = (index + 1) % proxies.length;
    return p;
  }
  return { nextFor, rotate };
}

async function processCheckConnection(token, useProxy, rotateProxy, rotator) {
  while (true) {
    const proxy = useProxy ? rotator.nextFor(token) : null;
    log(`${chalk.cyanBright('代理   :')}${chalk.whiteBright(` ${proxy} `)}`);
    const valid = await checkConnection(proxy);
    if (!valid) {
      if (rotateProxy && useProxy) rotator.rotate(token);
      continue;
    }
    return true;
  }
}

async function processAccount(token, useProxy, rotateProxy, rotator) {
  const ok = await processCheckConnection(token, useProxy, rotateProxy, rotator);
  if (!ok) return;
  const proxy = useProxy ? rotator.nextFor(token) : null;

  try {
    const stats = await userStats(token, proxy);
    if (stats) {
      const email = stats?.data?.user_email ?? '未知';
      const level = stats?.data?.level ?? 0;
      const points = stats?.data?.total_xp ?? 0;
      log(`${chalk.cyanBright('账号   :')}${chalk.whiteBright(` ${maskAccount(email)} `)}`);
      log(`${chalk.cyanBright('等级   :')}${chalk.whiteBright(` ${level} `)}`);
      log(`${chalk.cyanBright('积分   :')}${chalk.whiteBright(` ${points} XP `)}`);
    }
  } catch (e) {
    log(`${chalk.cyanBright('账号   :')}${chalk.redBright(' 获取数据失败 ')}${chalk.magentaBright('-')}${chalk.yellowBright(` ${e.message} `)}`);
  }

  try {
    const status = await checkinStatus(token, proxy);
    const canCheckin = status?.data?.canCheckinToday;
    if (canCheckin) {
      try {
        const claim = await claimCheckin(token, proxy);
        const reward = claim?.data?.xpEarned;
        log(`${chalk.cyanBright('签到   :')}${chalk.greenBright(' 领取成功 ')}${chalk.magentaBright('-')}${chalk.cyanBright(' 奖励: ')}${chalk.whiteBright(`${reward} XP`)}`);
      } catch (e) {
        log(`${chalk.cyanBright('签到   :')}${chalk.redBright(' 未领取 ')}${chalk.magentaBright('-')}${chalk.yellowBright(` ${e.message} `)}`);
      }
    } else {
      const nextMs = status?.data?.nextCheckinIn;
      if (typeof nextMs === 'number') {
        const nextDate = new Date(Date.now() + nextMs);
        const fmt = formatBeijing(nextDate);
        log(`${chalk.cyanBright('签到   :')}${chalk.yellowBright(' 还未到领取时间 ')}${chalk.magentaBright('-')}${chalk.cyanBright(' 预计时间: ')}${chalk.whiteBright(`${fmt}`)}`);
      }
    }
  } catch (e) {
    log(`${chalk.cyanBright('签到   :')}${chalk.redBright(' 获取状态失败 ')}${chalk.magentaBright('-')}${chalk.yellowBright(` ${e.message} `)}`);
  }

  try {
    const list = await dailyTasks(token, proxy);
    const quests = Array.isArray(list?.data) ? list.data : [];
    if (quests.length) {
      log(`${chalk.cyanBright('任务   :')}`);
      for (const q of quests) {
        const questId = q.id;
        const questName = q.title;
        const questXp = q.xp;
        const isCompleted = q.isCompleted;
        if (isCompleted) {
          log(`${chalk.cyanBright('   > ')}${chalk.whiteBright(questName)}${chalk.yellowBright(' 已完成 ')}`);
          continue;
        }
        try {
          await completeTask(token, questId, questName, proxy);
          log(`${chalk.cyanBright('   > ')}${chalk.whiteBright(questName)}${chalk.greenBright(' 完成 ')}${chalk.magentaBright('-')}${chalk.cyanBright(' 奖励: ')}${chalk.whiteBright(` ${questXp} XP `)}`);
        } catch (e) {
          log(`${chalk.cyanBright('   > ')}${chalk.whiteBright(questName)}${chalk.redBright(' 未完成 ')}${chalk.magentaBright('-')}${chalk.yellowBright(` ${e.message} `)}`);
        }
      }
    } else {
      log(`${chalk.cyanBright('任务   :')}${chalk.yellowBright(' 没有可用的每日任务 ')}`);
    }
  } catch (e) {
    log(`${chalk.cyanBright('任务   :')}${chalk.redBright(' 获取每日任务失败 ')}${chalk.magentaBright('-')}${chalk.yellowBright(` ${e.message} `)}`);
  }
}

function maskAccount(email) {
  if (!email || !email.includes('@')) return email || '未知';
  const [local, domain] = email.split('@');
  const masked = local.slice(0, 3) + '*'.repeat(3) + local.slice(-3);
  return `${masked}@${domain}`;
}

async function main() {
  setConsoleTitle('Providence-Bot');
  const tokens = loadTokens();
  const { proxyChoice, rotateProxy } = await askRuntimeOptions();

  while (true) {
    clearTerminal();
    welcome();
  log(`${chalk.greenBright('账号总数      : ')}${chalk.whiteBright(tokens.length)}`);

    const useProxy = proxyChoice === 1;
    const proxies = useProxy ? loadProxies() : [];
    const rotator = makeAccountProxyRotator(proxies);

    const separator = '='.repeat(26);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;
      log(`${chalk.cyanBright(separator + '[')}${chalk.whiteBright(` ${i + 1} `)}${chalk.cyanBright('共')}${chalk.whiteBright(` ${tokens.length} `)}${chalk.cyanBright(']' + separator)}`);
      await processAccount(token, useProxy, rotateProxy, rotator);
      await new Promise(r => setTimeout(r, 3000));
    }

    log(chalk.cyanBright('='.repeat(63)));
    let seconds = 12 * 60 * 60;
    while (seconds > 0) {
      const formatted = formatSeconds(seconds);
      const line = `${chalk.cyanBright('[ 等待')}${chalk.whiteBright(` ${formatted} `)}${chalk.cyanBright('... ]')}${chalk.whiteBright(' | ')}${chalk.blueBright('所有账号已处理完成。')}`;
      process.stdout.write(`${line}\r`);
      await new Promise(r => setTimeout(r, 1000));
      seconds -= 1;
    }
  }
}

process.on('SIGINT', () => {
  console.log(
    `${chalk.cyanBright(`[ ${nowStr()} ]`)}${chalk.whiteBright(' | ')}${chalk.redBright('[ 退出 ] Providence - BOT')}   `
  );
  process.exit(0);
});

main().catch((e) => {
  log(chalk.redBright(`错误: ${e.message}`));
  process.exit(1);
});


