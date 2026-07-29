# Domain Context Bundle

## 定义

`DomainContextBundle` 是工作台最小的可运行领域单元。一个 bundle 对应一个 domain context，而不是一个页面 demo 或单个 BO。它把模型、语义、操作、预设、种子数据与运行时绑定放在同一 capsule 内，但保持各事实 owner 分离。

建议 contract：

```ts
interface DomainContextBundle {
  readonly id: string
  readonly version: string
  readonly title: string
  readonly description?: string
  readonly modelSources: readonly KonModelSource[]
  readonly semanticCatalog: DomainSemanticCatalog
  readonly operationDefinitions: readonly OperationDefinition[]
  readonly invocationPresets: readonly OperationPresetDto[]
  readonly seedData: SeedDataDefinition
  readonly runtimeBindings: RuntimeBindingDeclaration
  readonly observationProbes: readonly ObservationProbeDefinition[]
}
```

字段职责：

| 字段 | 事实 owner | 说明 |
| --- | --- | --- |
| `modelSources` | bundle authoring | 只读 Kon schema source；v1 不在线编辑或重新编译 |
| `semanticCatalog` | bundle authoring | BO、association、lifecycle、constraint、process 等语义索引 |
| `operationDefinitions` | bundle authoring | Operation 身份、五维声明、静态 verb、schema 与 requestable capability set |
| `invocationPresets` | bundle authoring | 外层 catalog link 加完整 `ExecuteOperationRequest v1`；预览、编辑和 POST 共用同一对象 |
| `seedData` | bundle authoring | 每次运行重建数据库的输入 |
| `runtimeBindings` | runtime composition | 把稳定 handler ref 绑定到预注册实现并声明 actual capability set，不包含可远程注入代码 |
| `observationProbes` | bundle authoring/runtime | 声明需要采集的 before/after/diff/trace 视图 |

## Operation Definition 与 Preset 分离

一个 Operation 可以有多个 invocation preset，例如：

- `DamageCase.CancelRepair` 的正常取消、缺少关联资产、已出库但未归还三种 preset；
- 同一个 selection mutation 的 `filter` selector 和 `ids` selector；
- 同一个 batch operation 的 atomic 请求和 best-effort 请求。

Preset 只保存外层 `operationRef`、完整 `request` 和展示信息，不保存 handler、SQL 或任意脚本。`preset.operationRef` 必须等于 `preset.request.operation.ref`；request 中重复出现的五维声明、ownerRef 和 verb 必须与唯一 Operation definition 一致。页面不得把 subject、payload 或 execution 拆成另一份隐藏状态再重建 request。

Operation definition 是五维、静态 verb、schema 与 requestable capability 的 authoring authority。RuntimeBinding 只拥有 actual capability，server 只拥有 current capability projection，request 只拥有本次选择。

## 事实源阶梯

```text
Kon/modelSources + semantic/operation catalog
  -> compiled depa-orm schema and handler registry
  -> seed input
  -> per-execution SQLite live authority
  -> before/after/diff/trace projections
  -> web views
```

- Kon/modelSources 和 catalog 是定义真源。
- compiled schema、normalized operation 和 loaded preset 是可重建投影。
- seed 是重建输入，不是运行后状态的第二真源。
- SQLite 只在一次执行期间拥有 live data。
- response snapshot、diff、plan、SQL、diagnostics 和 UI state 都是只读投影，不反写 bundle 或 SQLite。

## 执行生命周期

每个 execute request 必须完整拥有自己的资源：

1. `create`：创建 invocation scope、临时 SQLite 和空 runtime data。
2. `initialize`：编译/加载只读 Kon model，装配公开 `depa-orm` runtime 与 operation registry。
3. `seed`：在受控事务中导入该 bundle 的 seed data。
4. `execute`：校验 request 与 catalog/capability，归一化 targets/invocation 后执行 handler。
5. `observe`：在资源销毁前采集 outcome、effects、before/after/diff、trace 和 diagnostics。
6. `destroy`：关闭连接、删除临时状态并清理 invocation scope。

任一步失败都必须进入受控 cleanup。并发或连续执行相同 preset 应得到等价初始态，不得读取前一次执行的数据库。

## Bundle 装载

- bundle loader 在分配数据库资源前验证每个完整 preset request、外层 link、definition/binding capability compatibility 和 batch verb/subject 同构，再冻结定义。
- catalog endpoint 只暴露经过验证、冻结的 bundle metadata、完整 presets 和 request schema，并由 server 组合 current capability projection。
- bundle id/version 是稳定身份；展示标题不是引用身份。
- server 用 bundle registry 受控分发，未知 id/version 明确失败。
- handler 只能在 server composition 时注册，HTTP 请求不能提供模块路径或源代码。
- v1 可缓存只读 compile result，但缓存不得包含 execution data、连接或可变 operation state。

## V1 代表性 Bundles

至少提供两套不同领域形状，避免只为单一 IT Asset 示例做特例：

1. `it-asset-lifecycle`：BO、association、constraint、lifecycle、Action/Mutation、BusinessProcess。
2. `commerce-operations` 或等价关系型领域：domain-context 全局 Operation、raw query/write、selection update、batch independent invocations、composed read model。

每套 bundle 都必须有确定性 seed、成功与失败 presets，以及能观察真实关系变化的 probes。
