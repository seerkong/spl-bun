# Operation Model

## 设计原则

Operation 是“可被 catalog 描述、可被请求调用、可被 runtime 分发、可被 response 观察”的统一入口。它不是 BO Action 的别名，也不是一个无限增长的 `kind` 枚举。

Operation Definition 使用五个正交维度：

| 维度 | 值 | 回答的问题 |
| --- | --- | --- |
| `owner` | domain-context、business-object、association、lifecycle、constraint、business-process、capability、raw | 这项语义由谁拥有 |
| `behavior` | action、mutation、query、transition、validate、computed、composed、raw | 它做哪类行为 |
| `subject` | none、single、selection | 一个 invocation 对谁做 |
| `invocation` | single、batch | 一个 request 带几个独立调用 |
| `effect` | read-only、write、mixed | 对事实态产生何种影响 |

事务要求是 Operation identity 之外的 capability/request 约束：

- `atomic`：整个声明边界要么提交，要么不提交；
- `best-effort`：允许独立 invocation 成功或失败，并返回逐项状态；
- definition 声明可请求集合，binding 声明实际支持集合，server 声明当前可用集合，request 选择本次模式；
- request choice 不在三者交集时失败，不把 atomic 静默改为 best-effort。

## Selection

`selection` 是原 `collection` 概念的消歧名称。它表示 selector 圈定的一组对象被当作一个逻辑 subject：

```ts
type Subject =
  | { kind: "none" }
  | { kind: "single"; ref: SubjectRef }
  | {
      kind: "selection"
      selector:
        | { kind: "all" }
        | { kind: "filter"; where: QueryFilterDto }
        | { kind: "ids"; ids: readonly SubjectRef[] }
    }
```

即使 selector 使用 `ids`，只要一组 id 共用一个 payload、一个业务语义和一个整体结果，它仍是 selection。例如“将这些待验收行作为一个集合执行关闭”。

## Batch

`batch` 表示 request 中有多个独立 invocation。每个 item 都有自己的 subject、verb、payload、结果和错误：

```ts
type ExecuteInvocation =
  | {
      mode: "single"
      subject: Subject
      verb: string
      payload: JsonValue
    }
  | {
      mode: "batch"
      items: readonly {
        key: string
        subject: Subject
        verb: string
        payload: JsonValue
      }[]
    }
```

不同 Operation definition 可以分别选择 none、single 或 selection 作为 batch item 的 subject shape；同一个 batch request 的所有 item 必须服从该 Operation definition 的同一个 `subjectKind` 和静态 `verb`。每个 item 仍独立拥有 key、subject value、payload、结果和错误。两个维度不互相替代：

- selection 回答“一个调用的主语集合是谁”；
- batch 回答“一次请求有多少个独立调用”。

## DEPA 归一化

HTTP DTO 在 transport boundary 被转换为：

```text
fn(runtime, targets, invocation, config) -> OperationExecutionResult
```

- `targets`：由 subject 解析出的稳定引用或 selector，不包含 DOM、Vue state、数据库 row object；
- `invocation`：不可变的 operation ref、verb、payload 与 item key；
- `config`：request 本次选择的 atomicity、observation channels 等执行配置；
- `runtime`：bundle schema、target resolver、handler registry、公开 depa-orm reader/writer 和 effects。

`subject` 与 payload 不互塞。target resolution、授权/可见性、selection expansion 和 batch scheduling 属于 runtime/processor。

## 分发

执行器按稳定 ref 分发：

```text
operation.ref -> registered handler -> normalized result
```

五维用于：

- catalog 筛选和 UI 分组；
- request/catalog 一致性校验；
- capability negotiation；
- result/trace 解释；
- 测试覆盖矩阵。

禁止按 `owner x behavior x subject x invocation x effect` 写巨大 switch。新增 Operation 默认只注册 definition、schema、handler 和 presets；只有出现真正的新机制时才修改 runtime。

Catalog match 在执行前验证 definition 的五维、ownerRef、静态 verb、subject shape 和 requestable capability。Runtime 再把 definition requestable、binding actual 与 server current capability 求交集；任何一层都不得从另一层推导默认值。

## 代表性覆盖矩阵

| 示例 | owner | behavior | subject | invocation | effect |
| --- | --- | --- | --- | --- | --- |
| 计算 domain context 概览 | domain-context | computed | none | single | read-only |
| 查询单个资产 | business-object | query | single | single | read-only |
| 取消报修 | business-object | action | single | single | mixed |
| 标记取消 | business-object | mutation | single | single | write |
| 按条件批量归档 | business-object | mutation | selection | single | write |
| 多个独立资产修正 | business-object | mutation | single per item | batch | write |
| 建立资产与供应商关系 | association | mutation | single | single | write |
| 验收进度迁移 | lifecycle | transition | single | single | write |
| 校验采购来源 | constraint | validate | single | single | read-only |
| 退货重新入库 | business-process | composed | selection | single | mixed |
| 资产概览 | capability | composed | single | single | read-only |
| 影响分析 | raw | query | none | single | read-only |
| 导入 seed batch | raw | raw | none | single | write |

表中的“导入 batch”是一个 raw operation 的 payload 语义，不自动等同于 invocation `mode=batch`。是否是 batch 只由调用封套决定。
