# DBSA 网站部署与运维手册

站点：**https://dbsa-africa.github.io** ｜ 仓库：`dbsa-africa/dbsa-africa.github.io`
零后台、零费用：静态页面（GitHub Pages）+ Google 表单（报损）+ 发布为 CSV 的回复表（看板数据）。

---

## 1. 首次上线（约 10 分钟）

本地文件夹就是仓库。改动确认后：

```bash
cd "/Users/paulineli/Desktop/DBSA/dbsa-africa.github.io"
git add -A
git commit -m "Launch DBSA site v1 (Book Corner)"
git push origin main
```

然后开启 Pages（只需一次）：
1. 打开 https://github.com/dbsa-africa/dbsa-africa.github.io → **Settings → Pages**
2. Source 选 **Deploy from a branch**，Branch 选 `main` / `/ (root)` → Save
3. 1–2 分钟后访问 https://dbsa-africa.github.io

> 之后每次更新网站 = 改文件 → commit → push，1 分钟内自动生效。

## 2. 日常更新去哪改

| 想改什么 | 改哪里 |
|---|---|
| 文案 | `index.html` / `bookcorner.html` 里直接改文字 |
| 照片 | 换 `assets/photos/photo-XX.jpg`（保持文件名即可） |
| 品牌色 | `styles.css` 顶部 `--maroon` 等变量 |
| 各校书单数据 | 重新生成 `assets/catalog.js`（数据源是采购/捐赠 Excel，找志愿者或 Claude 重跑生成脚本） |
| 中文界面（未来） | `site.js` 里 `I18N` 加 `zh` 字典 + 页面加切换按钮 |

## 3. 创建报损 Google Form（5 分钟，需 Google 账号）

新建表单 https://forms.new ，标题 **DBSA Book Corner — Report a Book**，四个问题：

1. **School**（下拉，必填）选项按此顺序（顺序决定预填链接，别乱动）：
   Pilot School / Changqin DBSA School / Myto Junior Academy / Joy Day Care /
   Caso Upendo Academy / Genesis Joy School / Bilgates School / Hope Baptist School /
   Recada Academy / Jasil School / Changrong School / Hanka School / Happy Star School
2. **Book title or number**（简答，必填）
3. **What happened?**（单选，必填）：Lost / Damaged
4. **Notes**（段落，选填）
（可选第 5 题：照片上传——注意会要求填表人登录 Google，肯尼亚老师多数没有账号，**建议不加**）

设置里关掉"仅限组织内"“限一次回复”，确保**无需登录**即可提交。

## 4. 把回复接到看板（status.html）

1. 表单 → Responses → 绿色表格图标 → 创建回复表格（Google Sheet）
2. 打开该 Sheet → **文件 → 共享 → 发布到网络** → 选择该工作表 + **CSV** → 发布，复制链接
3. 编辑 `status.html` 底部：`const CSV_URL = "粘贴这里";` → commit + push
4. （提醒）Sheet 里 **工具 → 通知规则** 设“每次提交邮件通知”，团队实时知晓

看板地址（不在导航里，仅分享给团队/资方）：`https://dbsa-africa.github.io/status.html`

## 5. 生成 13 校专属二维码

拿到表单的**预填链接模板**：表单编辑页 → ⋮ → **获取预填充链接** → School 选第一所 → 生成并复制链接（形如 `https://docs.google.com/forms/d/e/FORM_ID/viewform?usp=pp_url&entry.123456=Pilot+School`）。

然后运行：

```bash
cd "/Users/paulineli/Desktop/DBSA/dbsa-africa.github.io"
pip3 install qrcode pillow   # 只需一次
python3 gen_qr.py "粘贴预填链接"
```

脚本自动替换学校名生成 `qr/` 下 13 张 PNG。打印（建议 5×5cm 以上）塑封，贴在每校**书柜门内侧**，另在 `bookcorner.html` 的 `data-form` 里填入表单普通链接。

## 6. 交接清单（8/12 离场前）

- [ ] GitHub 组织 People 里至少 2 名 Owner（你 + 锐锐/DBSA）
- [ ] Google 表单和回复表的所有权移交给 DBSA 共用账号（表单 ⋮ → 添加协作者）
- [ ] 本手册连同仓库一起交接；改版找志愿者或用 Claude 打开仓库即可
