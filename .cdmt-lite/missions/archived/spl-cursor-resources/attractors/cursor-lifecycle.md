# Cursor位置与资源生命周期吸引子

本文件约束结构，测试与运行指标为实际态证据。

## 方程

```text
cursorState = owner(position, terminal, pendingCommand)
fetch(n) = next n values, not slice(source,0,n)
demand -> bounded source reads -> batch
terminal -> close source exactly once
derivedCursor -> consumes and owns upstream lifecycle
async boundary != sync interpreter value
fileCommit = atomicReplace(complete temporary bytes)
```

## 原语

source iterator、单owner cursor、命令队列、EOF/closed/cancel/error、batch、AbortSignal、资源scope、有界materialize、文件effect、临时制品/原子提交。

## 硬不变量

1. ❌ 每次fetch从首项slice，adapter各持位置。✅ 一个owner推进，每条命令线性化，两个cursor不共享位置。
2. ❌ first batch前all/整文件读取，或无限缓存。✅ source惰性，buffer/batch/record有界，非流式算子显式materialize上限。
3. ❌ only happy-path close或重复close破坏状态。✅ EOF/error/cancel/break均同一终态释放，幂等且可观测。
4. ❌ Promise被同步Kon当普通值输出。✅ async facade明确，sync拒绝并清理自己获得的资源。
5. ❌ 自动创建资源无owner或关闭调用者连接。✅ 每次执行scope拥有其创建资源，外部注入资源由调用者裁决。
6. ❌ file写到一半覆盖原文件/任意路径。✅ 工作区effect先完整写临时文件再原子替换，失败清理。
7. ❌ 状态/副作用藏在纯数值模块、输入反写。✅ IO实现位于support/宿主，cursor仅调用显式source协议。

## 排除集

- 全量读取或SQL LIMIT分页冒充cursor、跨请求位置cache、未声明资源生命周期。
- 未选分支打开资源、sync静默接收Promise、错误遗留半成品。
- hidden IO/eval、输入反写或移入企业容器。

## Harness

MISSION定义终点，loop拥有唯一工作图，evidence只追加；百万行/RSS必须实测，不以mock/接口名代替资源与背压证据。
