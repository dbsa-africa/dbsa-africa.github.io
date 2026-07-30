# DBSA 网站部署与运维手册

站点：**https://dbsa-africa.github.io** ｜ 仓库：`dbsa-africa/dbsa-africa.github.io`

零后台、零费用、零维护：
静态页面（GitHub Pages）+ 自建报损页 `report.html`（模糊书名自动补全，英/斯瓦希里双语）
+ 一个 Cloudflare Worker（免费额度，把报损写进仓库 `data/reports.json`）+ 看板 `status.html` 直接读该文件。
**没有 Google 表单、没有数据库，所有数据都存在 DBSA 自己的 GitHub 组织里。**

```
教师扫书柜二维码 → report.html?school=xx（校名已选好）
  → 输书名，从该校捐赠书单里弹出候选，点选 → Lost/Damaged → 提交
  → Cloudflare Worker 校验后 append 到仓库 data/reports.json（一条 = 一次 commit）
  → status.html 实时读取：汇总、按校统计、自动对照书单生成补书清单
```

---

## 1. 网站更新（日常）

本地文件夹就是仓库。改动确认后：

```bash
cd "/Users/paulineli/Desktop/DBSA/dbsa-africa.github.io"
git add -A
git commit -m "描述这次改了什么"
git push origin main
```

push 后 1–2 分钟自动生效（`*.github.io` 仓库的 Pages 是自动开启的）。

| 想改什么 | 改哪里 |
|---|---|
| 文案 | `index.html` / `bookcorner.html` 里直接改文字 |
| 照片 | 换 `assets/photos/photo-XX.jpg`（保持文件名即可） |
| 品牌色 | `styles.css` 顶部 `--maroon` 等变量 |
| 各校书单数据 | 重新生成 `assets/catalog.js`（数据源是采购/捐赠 Excel，找志愿者或 Claude 重跑生成脚本） |
| 报损页文案/斯瓦希里语 | `report.html` 里直接改 |
| 中文界面（未来） | `site.js` 里 `I18N` 加 `zh` 字典 + 页面加切换按钮 |

## 2. 报损后端：部署 Cloudflare Worker（一次性，约 15 分钟）

需要：dbsa-africa 组织的 Owner 权限 + 一个 Cloudflare 免费账号（建议用 DBSA 邮箱注册，方便交接）。

**A. 生成 GitHub Token（Worker 用它写入仓库）**
1. 用 dbsa-africa 的 Owner 账号打开 github.com → 右上头像 → **Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. **Generate new token (classic)**：Note 填 `dbsa-report-worker`，Expiration 选 **No expiration**，勾选 **repo** 一项即可 → Generate
3. 复制生成的 `ghp_…` 字符串（只显示一次）

**B. 部署 Worker**（Cloudflare 界面时有改版，找不到按钮就搜 "Create Worker"）
1. 注册/登录 https://dash.cloudflare.com （免费版即可）
2. 左栏 **Compute → Workers & Pages** → 右上角蓝色 **Create application**
   → 选 **Workers**（不是 Pages）→ **Start with Hello World!** → Get started
3. 名称改成 `dbsa-report` → **Deploy**（先部署示例代码，没关系）
4. 部署成功页点 **Edit code**，全选删掉示例代码，把仓库里 `worker.js`
   的全部内容粘贴进去 → 右上角 **Deploy**
5. 返回该 Worker 页面 → **Settings → Variables and Secrets → + Add**：
   Type 选 **Secret**，Variable name 填 `GITHUB_TOKEN`，Value 粘贴步骤 A 的 token → **Deploy**
6. 同样方法再加一个 Secret：名称 `REPORT_KEY`，值填一句**自己编的长口令**（比如三四个随机单词）。
   它用来给每所学校的二维码签发专属校验码——**学校只能用自己的二维码报自己的书**。
   口令记进交接文档，别提交进仓库
7. 复制 Worker 网址（形如 `https://dbsa-report.<子域名>.workers.dev`）。
   浏览器直接打开它显示 `{"error":"POST only"}` 就说明 Worker 活着

> 以后仓库里的 `worker.js` 有更新时，重复第 4 步（Edit code → 覆盖粘贴 → Deploy）即可。

**C. 接线**
1. 编辑 `report.html` 顶部脚本：`const ENDPOINT = "粘贴 Worker 网址";`
2. commit + push。报损页会自动退出"Test mode"，提交开始真实入库

**验证**：手机开 https://dbsa-africa.github.io/report.html?school=pilot 提交一条测试报损 →
仓库里 `data/reports.json` 应多出一条（一条 commit）→ status.html 上能看到。
测试数据删除：直接在 GitHub 网页上编辑 `data/reports.json` 删掉那条即可。

**防滥用**：Worker 只收本站发来的合法学校名，蜜罐字段拦截机器人；若地址被恶意刷，
在 Cloudflare 里删掉 Worker 重建（换个名字 = 换网址），再更新 `report.html` 的 ENDPOINT。

## 3. 看板（status.html）

- 地址：`https://dbsa-africa.github.io/status.html`（不在导航里，仅分享给团队/资方）
- 数据直接来自 `data/reports.json`，**无需任何配置**；Worker 上线前显示示例数据并有黄框提示
- **补书建议清单**：报损书名自动和该校捐赠书单模糊匹配，汇总出"哪校补哪本几册"，
  回访采购直接照单；没匹配上的会标"not in catalogue"
- 预览演示数据：`status.html?sample=1`
- 想收邮件提醒：GitHub 仓库页 → **Watch → Custom → 勾 Pushes**（每条报损 = 一次 push）

## 4. 生成 13 校专属二维码

```bash
cd "/Users/paulineli/Desktop/DBSA/dbsa-africa.github.io"
pip3 install qrcode pillow   # 只需一次
python3 gen_qr.py "和 Worker 里 REPORT_KEY 一模一样的口令"
```

`qr/` 下生成 13 张 PNG，每张指向 `report.html?school=<该校 id>&k=<该校专属码>`：
校名自动锁定、不能切换；专属码由 Worker 验证，改网址冒充别校无效；
不带二维码直接打开报损页只会看到"请扫本校二维码"的提示。

打印（建议 5×5cm 以上）塑封，贴在每校**书柜门内侧**。
⚠️ 二维码 PNG **不要提交进仓库**（已 gitignore）——里面的专属码就是钥匙。
换了 REPORT_KEY 就要重新生成并重印全部二维码。

## 5. 交接清单（8/12 离场前）

- [ ] GitHub 组织 People 里至少 2 名 Owner（你 + 锐锐/DBSA）
- [ ] Cloudflare 账号用 DBSA 邮箱注册，密码交接（或把接班人加为账号成员）
- [ ] REPORT_KEY 口令写进交接文档（补印/重印二维码时要用）
- [ ] GITHUB_TOKEN 用组织 Owner 账号生成、无过期时间；人员变动时重新生成并更新 Worker Secret
- [ ] 本手册连同仓库一起交接；改版找志愿者或用 Claude 打开仓库即可
