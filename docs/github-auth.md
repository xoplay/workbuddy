# GitHub 授权与恢复

沙箱里的 GitHub 凭证存在 **沙箱本地文件** `~/.config/gh/hosts.yml`，不是平台云端凭证。
因此：**同一会话内不用重复授权；新建任务（新沙箱）需要重新授权一次。**

## 需要的 scopes

| scope | 用途 | 缺了会怎样 |
|---|---|---|
| `repo` | 仓库读写、PR、分支、Actions 读取 | 基本啥都干不了 |
| `workflow` | 读写 `.github/workflows/*.yml` | **push 被拒**：`refusing to allow an OAuth App to create or update workflow without 'workflow' scope`，且 API 写该路径返回 404（不是 403，容易误判） |
| `delete_repo` | `gh repo delete` | **403**：`Must have admin rights to Repository` |
| `admin:repo_hook` | 管理仓库 Webhook | 无法配置自动化触发 |
| `admin:org` | 组织管理（含 `read:org`） | 列不出组织资源 |
| `admin:public_key` / `admin:gpg_key` | 部署密钥、GPG 签名 | 无法加部署 key |
| `gist` | Gist 读写 | 无法存片段 |
| `notifications` | 通知读写 | 无法标记已读 |
| `user` | 个人资料 / 邮箱 / 关注 | 无法改个人信息 |
| `write:packages` / `delete:packages` | 包发布与删除 | 无法发 npm/docker 包 |
| `codespace` | Codespaces 管理 | 无法起云端开发环境 |
| `project` | Projects V2 | 无法管看板 |
| `copilot` | Copilot 相关接口 | 无法调用 Copilot API |

> `repo` 已含 `public_repo` / `repo:status` / `repo_deployment`，不必重复列。
> `admin:repo_hook` 已含 `write:repo_hook` / `read:repo_hook`。

## 恢复方式

### 方式一：设备流（无需准备）

```bash
gh auth refresh -h github.com -s repo,workflow,delete_repo,admin:org,admin:public_key,admin:repo_hook,admin:gpg_key,gist,notifications,user,write:packages,delete:packages,codespace,project,copilot
```

输出一次性码 → 打开 https://github.com/login/device → 输入 → 完成。
**码 15 分钟有效**，超时重新执行即可（`gh auth refresh` 不接受 `--web` 参数）。

### 方式二：PAT（更快，不用开浏览器）

在 [Fine-grained tokens](https://github.com/settings/personal-access-tokens) 建 token（有效期最长 1 年），然后：

```bash
echo "<token>" | gh auth login --with-token
gh auth setup-git        # 配 git credential helper，否则 push 会报 "could not read Username"
```

## 验证

```bash
gh auth status                       # 看 scopes 是否齐全
gh api rate_limit                    # 5000/hr 说明生效
git -C . push origin main --dry-run  # 确认 git 凭据也通
```

## 已知坑

- **设备码过期** → `context deadline exceeded`，重新生成即可。
- **`gh auth setup-git` 没跑** → `git push` 报 `could not read Username for 'https://github.com'`。
- **平台侧 `github.agent-gateway.auth-proxy.local` 返回 401** → 那是另一套机制（WorkBuddy GitHub 连接器），与 `gh` 的本地 token 无关，沙箱内无法修复，走 `gh` 即可。
- **token 默认不过期**（`gho_` 为 OAuth token），只要 `hosts.yml` 在就一直有效。
