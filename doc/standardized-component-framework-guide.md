# 标准化组件框架实施指南

> **Data-Oriented Programming (DOP) 在 TypeScript 中的落地实践**
>
> 本文档总结了使用标准化组件定义、封装、分发框架的设计思想、最佳实践和实施经验。

---

## 目录

- [核心思想](#核心思想)
- [架构三大支柱](#架构三大支柱)
- [设计原则：Do & Don't](#设计原则do--dont)
- [实施模式](#实施模式)
- [提示词模板](#提示词模板)
- [实战案例](#实战案例)
- [常见陷阱与解决方案](#常见陷阱与解决方案)

---

## 核心思想

### 组件抽象的本质

```typescript
output = fn(runtime, input, config)
```

**核心理念**：将所有业务逻辑抽象为纯函数形式，其中：

- **`runtime`**：显式化的运行时上下文（数据、服务、依赖）
- **`input`**：当前操作的输入数据
- **`config`**：静态配置，决定组件行为
- **`output`**：确定性的输出结果

### 为什么这样设计？

| 传统方式（隐式依赖） | 标准化方式（显式依赖） |
|-------------------|-------------------|
| `this.service.doSomething()` | `runtime.service.doSomething()` |
| 隐式状态、全局变量 | 所有依赖通过 runtime 传递 |
| 难以测试、难以追踪 | 可测试、可追踪、可替换 |
| 紧耦合 | 松耦合、可组合 |

---

## 架构三大支柱

### 1. StdRunComponentLogic - 标准化封装

**作用**：提供统一的组件执行流程

```typescript
// 执行流程：
Outer Input
  → Compute Derived
  → Transform Runtime/Input/Config
  → Core Logic
  → Transform Output
  → Outer Output
```

**核心函数签名**：

```typescript
async function runByFuncStyleAdapter<
  TOuterRuntime, TOuterInput, TOuterConfig, TOuterDerived, TOuterOutput,
  TInnerRuntime, TInnerInput, TInnerConfig, TInnerOutput
>(
  outerRuntime: TOuterRuntime,
  outerInput: TOuterInput,
  outerConfig: TOuterConfig,
  outerDerivedAdapter: StdOuterComputedAdapter<...>,
  innerRuntimeAdapter: StdInnerRuntimeAdapter<...>,
  innerInputAdapter: StdInnerInputAdapter<...>,
  innerConfigAdapter: StdInnerConfigAdapter<...>,
  coreLogicAdapter: StdInnerLogic<...>,
  outputAdapter: StdOuterOutputAdapter<...>
): Promise<TOuterOutput>
```

**设计要点**：

- **Outer/Inner 分层**：外层处理框架级关注点，内层处理业务逻辑
- **Adapter 模式**：通过一系列 Adapter 函数完成层间转换
- **异步优先**：支持 sync/async，统一返回 Promise

### 2. DispatchEngine - 多策略分发引擎

**作用**：将外部调用路由到具体的处理组件

**支持的 7 种分发策略**：

| 策略类型 | 使用场景 | 示例 |
|---------|---------|------|
| **CLASS** | 按对象类型分发 | `UserRequest` → `UserHandler` |
| **ROUTE_KEY** | 按字符串路由键分发 | `"user.create"` → `createHandler` |
| **ENUM** | 按枚举值分发 | `UserAction.CREATE` → `createHandler` |
| **ROUTE_KEY_TO_ENUM** | 路由键转枚举后分发 | `"create"` → `CREATE` → `createHandler` |
| **COMMAND_TABLE** | 命令表模式 | `"CREATE"` → `commandTable[CREATE]` |
| **PATH** | 路径模式匹配 | `"/users/*/profile"` → `profileHandler` |
| **ACTION_PATH** | 动作+路径组合匹配 | `(POST, "/users")` → `createUserHandler` |

**使用方式**：

```typescript
const engine = new DispatchEngine<TResult>();

// 注册策略
engine.registerStrategy(
  DispatchStrategyConfig.forEnumStrategy({
    handlerMap: new Map([
      [UserAction.CREATE, createHandler],
      [UserAction.UPDATE, updateHandler],
    ]),
    defaultEnumHandler: (enumVal, input) => defaultHandler(enumVal, input),
  })
);

// 分发请求
const result = await engine.dispatch(
  createEnumDispatchRequest(UserAction.CREATE, inputData)
);
```

### 3. Runtime 显式化

**核心原则**：将所有依赖从隐式变为显式

#### ❌ 不要这样（隐式依赖）：

```typescript
class UserService {
  createUser(data: UserData) {
    // 隐式依赖：全局数据库连接
    const user = db.users.create(data);

    // 隐式依赖：全局日志
    logger.info('User created');

    // 隐式依赖：当前用户上下文
    audit.log(currentUser.id, 'CREATE_USER');

    return user;
  }
}
```

#### ✅ 应该这样（显式 Runtime）：

```typescript
interface UserServiceRuntime {
  database: Database;
  logger: Logger;
  auditService: AuditService;
  currentUser: User;
}

class UserService {
  createUser(runtime: UserServiceRuntime, data: UserData) {
    // 所有依赖显式传入
    const user = runtime.database.users.create(data);
    runtime.logger.info('User created');
    runtime.auditService.log(runtime.currentUser.id, 'CREATE_USER');
    return user;
  }
}
```

**Runtime 设计要点**：

```typescript
interface BehaviorTreeCoreRuntime {
  // 1. 数据依赖：运行时需要读写的数据
  innerCtx: BehaviorTreeContext;

  // 2. 逻辑依赖：需要调用的服务/处理器
  actionHandlerRegistry: ActionHandlerRegistry;

  // 3. 副作用依赖：日志、监控、状态更新
  pushCommand: (cmd: BehaviorTreeCmd) => void;
  setNodeStatus: (nodeKey: string, status: BehaviorTreeNodeStatus) => void;
}
```

---

## 设计原则：Do & Don't

### ✅ DO - 应该遵循的原则

#### 1. **保持组件纯函数化**

```typescript
// ✅ GOOD: 纯函数，所有依赖显式传入
async function processOrder(
  runtime: OrderProcessRuntime,
  input: OrderInput,
  config: OrderConfig
): Promise<OrderResult> {
  const validation = runtime.validator.validate(input);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  const order = await runtime.orderService.create(input);
  return { success: true, order };
}
```

#### 2. **使用 Adapter 模式进行层间转换**

```typescript
// ✅ GOOD: 清晰的 Adapter 分层
class ActionNodeLogicAdapter {
  async dispatch(runtime, input) {
    return await runByFuncStyleAdapter(
      runtime,
      input,
      null,
      stdMakeNullOuterComputed,           // Outer Derived
      stdMakeIdentityInnerRuntime,        // Inner Runtime
      (rt, inp) => this.makeInnerInput(inp), // Inner Input
      stdMakeIdentityInnerConfig,         // Inner Config
      (rt, inp, cfg) => this.runCoreLogic(rt, inp, cfg), // Core Logic
      (rt, inp, cfg, derived, out) => out // Outer Output
    );
  }
}
```

#### 3. **Runtime 只包含必要依赖**

```typescript
// ✅ GOOD: 精简的 Runtime，只包含真正需要的依赖
interface ApiRuntime {
  appId: string;           // 应用标识
  userId: string;          // 当前用户
  userService: UserService; // 业务服务
}

// ❌ BAD: 过于臃肿的 Runtime
interface BadRuntime {
  everything: any;  // 把所有东西都塞进去
}
```

#### 4. **异步方法统一使用 async/await**

```typescript
// ✅ GOOD: 统一使用 async/await
async function handleAction(runtime, input) {
  try {
    const result = await handler.execute(context);
    runtime.pushCommand({ type: 'SUCCESS', result });
  } catch (error) {
    runtime.logger.error('Action failed:', error);
    runtime.pushCommand({ type: 'FAILURE', error });
  }
}

// ❌ BAD: 混用 Promise 链式调用
function handleAction(runtime, input) {
  return handler.execute(context)
    .then(result => runtime.pushCommand({ type: 'SUCCESS', result }))
    .catch(error => runtime.pushCommand({ type: 'FAILURE', error }));
}
```

#### 5. **分发引擎策略可组合**

```typescript
// ✅ GOOD: 多种策略组合使用
const engine = new DispatchEngine<ApiResponse>();

engine
  .registerStrategy(DispatchStrategyConfig.forClassStrategy({ ... }))
  .registerStrategy(DispatchStrategyConfig.forRouteKeyStrategy({ ... }))
  .registerStrategy(DispatchStrategyConfig.forEnumStrategy({ ... }));
```

#### 6. **使用类型安全的泛型**

```typescript
// ✅ GOOD: 类型安全
const route = new ActorRoute<ApiResponse>();
route.getClassToHandlerMap().set(
  UserRequest,
  (input: unknown) => handleUserRequest(input as UserRequest)
);

// 调用时类型检查
const result: ApiResponse = await actor.call(new UserRequest());
```

### ❌ DON'T - 应该避免的做法

#### 1. **不要在组件内部创建隐式依赖**

```typescript
// ❌ BAD: 隐式依赖外部状态
class BadAdapter {
  private globalCache = new Map(); // 隐式全局状态

  process(input) {
    // 直接访问隐式依赖
    if (this.globalCache.has(input.id)) {
      return this.globalCache.get(input.id);
    }
    // ...
  }
}

// ✅ GOOD: 通过 Runtime 显式传递
interface CacheRuntime {
  cache: Map<string, any>;
}

function process(runtime: CacheRuntime, input) {
  if (runtime.cache.has(input.id)) {
    return runtime.cache.get(input.id);
  }
  // ...
}
```

#### 2. **不要为逻辑固定的组件添加不必要的分发层**

```typescript
// ❌ BAD: 为逻辑固定的 Sequence 节点添加不必要的分发
class SequenceNodeLogicAdapter {
  async dispatch(runtime, request) {
    return await runByFuncStyleAdapter(
      runtime,
      request,
      null,
      stdMakeNullOuterComputed,
      stdMakeIdentityInnerRuntime,
      (rt, req) => this.makeInnerInput(rt, req),  // 几乎是复制
      stdMakeIdentityInnerConfig,
      (rt, input) => this.runCoreLogic(rt, input),  // 只是转发
      (rt, req, cfg, derived, result) => result
    );
  }

  // 真正的逻辑在这里
  private handleVisitNode(runtime, node) {
    // Sequence 的固定逻辑
  }
}

// ✅ GOOD: 直接实现核心逻辑
class SequenceNodeLogicAdapter {
  visitNode(runtime, node) {
    // 直接编写 Sequence 的核心逻辑，不需要分发
    node.Status = BehaviorTreeNodeStatus.Started;
    const firstChild = this.getFirstExecutableChild(node);
    if (firstChild) {
      runtime.pushCommand({
        Type: BehaviorTreeCmdType.VisitNode,
        NodeId: firstChild.Key,
      });
    }
    // ...
  }
}
```

**判断原则**：
- ✅ **需要分发**：Action 节点（根据 ActionType 动态路由到不同 Handler）
- ❌ **不需要分发**：Sequence/Selector/Condition 节点（逻辑固定，不需要动态路由）

#### 3. **不要跳过标准化封装（针对需要封装的场景）**

```typescript
// ❌ BAD: 直接调用，绕过封装层（当需要封装时）
async function badDispatch(request) {
  // 直接调用业务逻辑，没有统一的处理流程
  return await someBusinessLogic(request);
}

// ✅ GOOD: 使用标准封装（当有实际转换需求时）
async function goodDispatch(runtime, request, pathVars) {
  return await runByFuncStyleAdapter(
    runtime,
    request,
    null,
    // ... adapters 进行实际的转换
  );
}
```

**注意**：标准化封装是为了解决实际问题（Outer/Inner 层转换、统一错误处理等），不是为了封装而封装。

#### 4. **不要在 Core Logic 中处理框架级关注点**

```typescript
// ❌ BAD: Core Logic 中混入框架逻辑
async function badCoreLogic(runtime, input, config) {
  // 路径变量解析应该在 Adapter 层
  const userId = extractPathVariable(input.path, 'userId');

  // 错误处理应该在外层
  try {
    return await runtime.userService.getUser(userId);
  } catch (error) {
    return { code: 500, message: error.message };
  }
}

// ✅ GOOD: Core Logic 只关注业务
async function goodCoreLogic(runtime, input: { userId: string }, config) {
  // 纯业务逻辑
  return await runtime.userService.getUser(input.userId);
}
```

#### 5. **不要创建过深的分发层次**

```typescript
// ❌ BAD: 过多的分发层次
Layer1: Router →
  Layer2: Dispatcher →
    Layer3: SubDispatcher →
      Layer4: ActionRouter →
        Layer5: Finally execute

// ✅ GOOD: 合理的两层分发
Layer1: NodeKind → NodeLogic  (第一层分发)
Layer2: ActionType → ActionHandler (第二层分发)
```

#### 6. **不要在测试中创建真实依赖**

```typescript
// ❌ BAD: 测试中使用真实数据库
test('should create user', async () => {
  const runtime = {
    database: new RealDatabase(), // 真实数据库连接
  };
  // ...
});

// ✅ GOOD: 使用 Mock Runtime
test('should create user', async () => {
  const mockRuntime: UserServiceRuntime = {
    database: {
      users: {
        create: jest.fn().mockResolvedValue(mockUser),
      },
    },
    logger: { info: jest.fn() },
    auditService: { log: jest.fn() },
    currentUser: testUser,
  };
  // ...
});
```

#### 7. **不要在 Runtime 中包含业务逻辑**

```typescript
// ❌ BAD: Runtime 包含业务逻辑
interface BadRuntime {
  calculateDiscount(price: number): number {
    return price * 0.9; // 业务逻辑不应该在 Runtime 中
  }
}

// ✅ GOOD: Runtime 只提供数据和服务引用
interface GoodRuntime {
  discountService: DiscountService; // 服务引用
}
```

---

## 实施模式

### 模式 1: 函数式 Adapter（推荐用于简单场景）

**特点**：将每个转换步骤定义为独立函数

```typescript
// 定义各个 Adapter
const InnerInputAdapter = (runtime, request, config, pathVars) => ({
  keyword: request.queryParams.keyword,
});

const CoreLogicAdapter = (runtime, input, config) => {
  return runtime.userService.searchUsers(input.keyword);
};

const OutputAdapter = (runtime, request, config, pathVars, users) => ({
  code: 200,
  message: 'Success',
  data: users,
});

// 使用标准封装
class FuncStyleApiAdapter implements ApiAdapter {
  async dispatch(runtime, request, pathVars) {
    return await runByFuncStyleAdapter(
      runtime,
      request,
      null,
      stdMakeNullOuterComputed,
      stdMakeIdentityInnerRuntime,
      InnerInputAdapter,
      stdMakeIdentityInnerConfig,
      CoreLogicAdapter,
      OutputAdapter
    );
  }
}
```

**适用场景**：
- 转换逻辑简单
- 不需要复用
- 快速原型开发

### 模式 2: OOP Adapter（推荐用于复杂场景）

**特点**：通过继承和方法重写实现定制化

```typescript
abstract class OOPStyleApiAdapterBase<TInnerInput, TInnerOutput>
  implements ApiAdapter {

  abstract getRoutePattern(): string;
  abstract makeInnerInput(runtime, request, pathVars): TInnerInput;
  abstract runCoreLogic(runtime, input: TInnerInput): TInnerOutput | Promise<TInnerOutput>;

  async dispatch(runtime, request, pathVars) {
    return await runByFuncStyleAdapter(
      runtime,
      request,
      null,
      (rt, req, cfg) => pathVars,
      stdMakeIdentityInnerRuntime,
      (rt, req, cfg, computed) =>
        this.makeInnerInput(rt, req, computed as Record<string, string>),
      stdMakeIdentityInnerConfig,
      (rt, input, cfg) => this.runCoreLogic(rt, input),
      ApiDefaultAdapter.stdMakeOuterOutput
    );
  }
}

// 使用时只需实现三个方法
class UserGetByNameAdapter extends OOPStyleApiAdapterBase<GetUserInput, User> {
  getRoutePattern() {
    return "/user/{username}";
  }

  makeInnerInput(runtime, request, pathVars) {
    return { username: pathVars['username'] };
  }

  runCoreLogic(runtime, input) {
    return runtime.userService.getUserByUsername(input.username);
  }
}
```

**适用场景**：
- 有多个类似组件需要实现
- 需要复用公共逻辑
- 团队熟悉 OOP 模式

### 模式 3: 两层分发模式

**特点**：在一个组件内部进行二次分发

```typescript
class ActionNodeLogicAdapter {
  constructor(private actionHandlerRegistry: ActionHandlerRegistry) {}

  // 第一层已经路由到这里：NodeKind.Action → ActionNodeLogic

  private async handleVisitNode(runtime, node) {
    const actionType = node.Type;

    // 第二层分发：ActionType → ActionHandler
    const handler = this.actionHandlerRegistry.getHandler(actionType);
    if (!handler) {
      throw new Error(`No handler for action type: ${actionType}`);
    }

    try {
      const result = await handler.execute({
        runtime,
        node,
        config: node.Config,
      });

      runtime.pushCommand({
        Type: BehaviorTreeCmdType.FinishLeafNode,
        NodeKey: node.Key,
        Result: result,
      });
    } catch (error) {
      runtime.pushCommand({
        Type: BehaviorTreeCmdType.FinishLeafNode,
        NodeKey: node.Key,
        Result: BehaviorResult.Failure,
      });
    }
  }
}
```

**适用场景**：
- 需要多级路由
- 处理器可动态注册
- 插件化架构

---

## 提示词模板

以下提示词可用于指导 AI 实施标准化组件框架。

### 提示词 1: 新建标准化组件

```markdown
我需要创建一个新的业务组件，请遵循以下标准化组件框架规范：

**组件抽象**：
- 遵循 `output = fn(runtime, input, config)` 的函数式抽象
- 使用 `StdRunComponentLogic.runByFuncStyleAdapter` 进行标准化封装

**Runtime 设计**：
- 定义 `{ComponentName}Runtime` 接口，包含：
  - 数据依赖：组件需要访问的数据结构
  - 逻辑依赖：组件需要调用的服务/处理器
  - 副作用依赖：状态更新、命令推送等方法
- 所有依赖必须显式声明，不使用隐式全局变量

**Input/Output 类型**：
- 定义清晰的 Input 和 Output 类型
- Input 包含组件执行所需的所有输入参数
- Output 定义组件的返回值结构

**实现方式**：
- 简单场景：使用函数式 Adapter（参考 `FuncStyleApiAdapter`）
- 复杂场景：使用 OOP Adapter（参考 `OOPStyleApiAdapterBase`）

**异步处理**：
- 所有可能异步的操作统一使用 `async/await`
- 不使用 Promise 链式调用（`.then()/.catch()`）
- 核心逻辑函数签名支持 `TResult | Promise<TResult>`

**示例结构**：
```typescript
interface MyComponentRuntime {
  // 数据依赖
  context: MyContext;

  // 逻辑依赖
  myService: MyService;

  // 副作用依赖
  updateState: (state: MyState) => void;
}

interface MyComponentInput {
  param1: string;
  param2: number;
}

interface MyComponentOutput {
  success: boolean;
  result?: any;
}

async function runMyComponent(
  runtime: MyComponentRuntime,
  input: MyComponentInput,
  config: MyComponentConfig
): Promise<MyComponentOutput> {
  // 纯业务逻辑
}
```

请为组件 `{具体业务}` 创建完整实现。
```

### 提示词 2: 添加分发策略

```markdown
我需要为现有的 DispatchEngine 添加新的分发策略，请遵循以下规范：

**选择分发策略类型**：
1. CLASS - 按对象类型分发（适合类型化请求）
2. ROUTE_KEY - 按字符串路由键分发（适合字符串标识）
3. ENUM - 按枚举值分发（适合有限的命令集）
4. ROUTE_KEY_TO_ENUM - 路由键转枚举（适合字符串到枚举的映射）
5. COMMAND_TABLE - 命令表模式（适合动态命令查找）
6. PATH - 路径模式匹配（适合 REST 风格路由）
7. ACTION_PATH - 动作+路径组合（适合 HTTP 请求路由）

**实施步骤**：
1. 创建 Handler Map，定义路由键到处理函数的映射
2. 定义 Default Handler（可选），处理未匹配的情况
3. 注册策略到 DispatchEngine
4. 创建分发请求并调用

**示例代码**：
```typescript
const engine = new DispatchEngine<MyResult>();

// 注册策略
engine.registerStrategy(
  DispatchStrategyConfig.for{StrategyType}Strategy({
    handlerMap: new Map([
      [key1, handler1],
      [key2, handler2],
    ]),
    defaultHandler: (key, input) => defaultHandler(key, input),
  })
);

// 分发请求
const result = await engine.dispatch(
  create{StrategyType}DispatchRequest(routeKey, inputData)
);
```

**注意事项**：
- Handler 函数签名必须支持 async：`(input: unknown) => TResult | Promise<TResult>`
- 使用 `DispatchResult.handled(result)` 返回成功结果
- 使用 `DispatchResult.notHandled()` 表示未处理
- 可以组合多个策略，按注册顺序依次尝试

请为 `{具体场景}` 实现分发策略。
```

### 提示词 3: 将现有代码迁移到标准化框架

```markdown
我有一段现有代码需要重构为标准化组件框架，请遵循以下步骤：

**第一步：识别隐式依赖**
- 找出所有全局变量访问
- 找出所有 `this.xxx` 成员变量访问
- 找出所有直接的服务实例化
- 找出所有 side effect 操作（日志、状态更新等）

**第二步：定义 Runtime 接口**
- 将所有隐式依赖提取到 Runtime 接口中
- 按类型分组：数据依赖、逻辑依赖、副作用依赖
- 使用清晰的命名

**第三步：提取 Input/Output**
- 识别函数的真实输入参数
- 定义明确的输入类型
- 定义明确的输出类型

**第四步：重构为纯函数**
- 将原来的方法改为 `(runtime, input, config) => output` 形式
- 所有依赖从 runtime 获取
- 移除副作用，改为通过 runtime 的方法调用

**第五步：使用标准化封装**
- 使用 `runByFuncStyleAdapter` 包装
- 定义必要的 Adapter 函数
- 处理 async/await

**示例重构**：

重构前：
```typescript
class UserService {
  private db = getDatabase(); // 隐式依赖

  async createUser(userData) {
    logger.info('Creating user'); // 隐式日志
    const user = await this.db.users.create(userData);
    globalCache.set(user.id, user); // 隐式缓存
    return user;
  }
}
```

重构后：
```typescript
interface UserServiceRuntime {
  database: Database;
  logger: Logger;
  cache: Cache;
}

interface CreateUserInput {
  userData: UserData;
}

interface CreateUserOutput {
  user: User;
}

async function createUser(
  runtime: UserServiceRuntime,
  input: CreateUserInput,
  config: null
): Promise<CreateUserOutput> {
  runtime.logger.info('Creating user');
  const user = await runtime.database.users.create(input.userData);
  runtime.cache.set(user.id, user);
  return { user };
}
```

请重构以下代码：
```
{粘贴现有代码}
```
```

### 提示词 4: 实施两层分发架构

```markdown
我需要实现一个两层分发架构，请遵循以下模式：

**第一层分发**：粗粒度路由
- 通常按大类型分发（如：NodeKind, RequestType）
- 使用 DispatchEngine 的 ENUM 或 CLASS 策略
- 路由到对应的 Adapter 或 Logic 处理器

**第二层分发**：细粒度路由
- 在第一层 Handler 内部进行二次分发
- 通常按具体操作分发（如：ActionType, CommandType）
- 可以使用 Registry 模式或另一个 DispatchEngine

**实施步骤**：

1. 定义第一层分发键（枚举或类）：
```typescript
enum NodeKind {
  Action = 'Action',
  Sequence = 'Sequence',
  Selector = 'Selector',
}
```

2. 创建第一层 Handler（Adapter）：
```typescript
class ActionNodeLogicAdapter {
  constructor(private actionRegistry: ActionHandlerRegistry) {}

  async dispatch(runtime, input) {
    // 这里会进行第二层分发
  }
}
```

3. 注册第一层分发：
```typescript
const engine = new DispatchEngine();
engine.registerStrategy(
  DispatchStrategyConfig.forEnumStrategy({
    handlerMap: new Map([
      [NodeKind.Action, (input) => actionAdapter.dispatch(runtime, input)],
      [NodeKind.Sequence, (input) => sequenceAdapter.dispatch(runtime, input)],
    ]),
  })
);
```

4. 实现第二层分发（在 Adapter 内部）：
```typescript
class ActionNodeLogicAdapter {
  private async handleVisitNode(runtime, node) {
    const actionType = node.Type; // 第二层分发键

    const handler = this.actionRegistry.getHandler(actionType);
    if (!handler) {
      throw new Error(`No handler for action: ${actionType}`);
    }

    const result = await handler.execute({
      runtime,
      node,
      config: node.Config,
    });

    // 处理结果...
  }
}
```

**关键点**：
- 两层分发各司其职，不要混淆
- 第一层关注"做什么"（What），第二层关注"怎么做"（How）
- 每层都应该支持动态注册和扩展
- 使用统一的错误处理机制

请为 `{具体场景}` 实现两层分发架构。
```

### 提示词 5: 测试标准化组件

```markdown
我需要为标准化组件编写测试，请遵循以下规范：

**测试 Runtime 的构造**：
- 创建 Mock Runtime，不使用真实依赖
- 使用 jest.fn() 模拟所有服务方法
- 准备测试数据

```typescript
const mockRuntime: MyComponentRuntime = {
  // 数据依赖 - 使用测试数据
  context: {
    userId: 'test-user',
    data: testData,
  },

  // 逻辑依赖 - 使用 Mock
  myService: {
    doSomething: jest.fn().mockResolvedValue(mockResult),
    doAnotherThing: jest.fn().mockReturnValue(mockValue),
  },

  // 副作用依赖 - 使用 Mock 追踪调用
  updateState: jest.fn(),
  pushCommand: jest.fn(),
};
```

**测试用例结构**：

```typescript
describe('MyComponent', () => {
  let runtime: MyComponentRuntime;

  beforeEach(() => {
    runtime = createMockRuntime(); // 创建 Mock Runtime
  });

  test('should handle normal case', async () => {
    // Arrange
    const input: MyComponentInput = { param1: 'value1' };
    const config = null;

    // Act
    const result = await runMyComponent(runtime, input, config);

    // Assert
    expect(result.success).toBe(true);
    expect(runtime.myService.doSomething).toHaveBeenCalledWith('value1');
    expect(runtime.updateState).toHaveBeenCalledTimes(1);
  });

  test('should handle error case', async () => {
    // Arrange
    runtime.myService.doSomething.mockRejectedValue(new Error('Failed'));

    // Act & Assert
    await expect(
      runMyComponent(runtime, input, config)
    ).rejects.toThrow('Failed');
  });
});
```

**测试 DispatchEngine**：

```typescript
describe('MyDispatchEngine', () => {
  test('should dispatch to correct handler', async () => {
    const engine = new DispatchEngine<MyResult>();
    const mockHandler = jest.fn().mockResolvedValue({ success: true });

    engine.registerStrategy(
      DispatchStrategyConfig.forEnumStrategy({
        handlerMap: new Map([[MyAction.CREATE, mockHandler]]),
      })
    );

    const result = await engine.dispatch(
      createEnumDispatchRequest(MyAction.CREATE, inputData)
    );

    expect(result.isHandled()).toBe(true);
    expect(mockHandler).toHaveBeenCalledWith(inputData);
  });
});
```

**关键点**：
- 所有异步测试必须使用 async/await
- 使用 Mock Runtime 隔离外部依赖
- 验证副作用调用（如 `pushCommand`、`updateState`）
- 测试正常路径和异常路径
- 验证分发引擎的路由逻辑

请为 `{组件名称}` 编写完整测试。
```

---

## 实战案例

### 案例 1: API 路由适配器（双风格实现）

**场景**：实现用户管理 API 的路由和处理

**函数式风格实现**：

```typescript
// 1. 定义 Runtime
interface ApiRuntime {
  appId: string;
  userId: string;
  userService: UserService;
}

// 2. 定义 Adapters
const UserSearchAdapter = {
  InnerInputAdapter: (runtime, request, config, pathVars) => ({
    keyword: request.queryParams.keyword,
  }),

  CoreLogicAdapter: async (runtime, input, config) => {
    return await runtime.userService.searchUsers(input.keyword);
  },
};

// 3. 使用标准封装
class UserSearchApiAdapter implements ApiAdapter {
  getRoutePattern() {
    return "/user/search";
  }

  async dispatch(runtime, request, pathVars) {
    return await runByFuncStyleAdapter(
      runtime,
      request,
      null,
      stdMakeNullOuterComputed,
      stdMakeIdentityInnerRuntime,
      UserSearchAdapter.InnerInputAdapter,
      stdMakeIdentityInnerConfig,
      UserSearchAdapter.CoreLogicAdapter,
      ApiDefaultAdapter.stdMakeOuterOutput
    );
  }
}
```

**OOP 风格实现**：

```typescript
class UserGetByNameAdapter extends OOPStyleApiAdapterBase<GetUserInput, User> {
  getRoutePattern() {
    return "/user/{username}";
  }

  makeInnerInput(runtime, request, pathVars) {
    return {
      username: pathVars['username']
    };
  }

  async runCoreLogic(runtime, input) {
    return await runtime.userService.getUserByUsername(input.username);
  }
}
```

**使用路由表**：

```typescript
class UserApiAdapterRouter {
  static routes: ApiAdapter[] = [
    new UserSearchApiAdapter(),
    new UserGetByNameAdapter(),
    new UserCreateApiAdapter(),
  ];
}

// 路由匹配和分发
async function dispatch(request: ApiRequest): Promise<ApiResponse | null> {
  for (const adapter of UserApiAdapterRouter.routes) {
    const pathVars = matcher.match(adapter.getRoutePattern(), request.path);
    if (pathVars) {
      return await adapter.dispatch(runtime, request, pathVars);
    }
  }
  return null;
}
```

### 案例 2: 行为树节点逻辑（两层分发）

**场景**：行为树引擎的节点处理

**第一层分发：NodeKind → NodeLogic**

```typescript
class NodeLogicDispatcher {
  private dispatchEngine: DispatchEngine<NodeLogicDispatchOutput>;

  constructor(
    private sequenceAdapter: SequenceNodeLogicAdapter,
    private selectorAdapter: SelectorNodeLogicAdapter,
    private actionAdapter: ActionNodeLogicAdapter,
  ) {
    this.dispatchEngine = new DispatchEngine();
    this.registerNodeKindDispatch();
  }

  private registerNodeKindDispatch() {
    const handlerMap = new Map<BehaviorTreeNodeKind, (input: unknown) => Promise<NodeLogicDispatchOutput>>();

    handlerMap.set(BehaviorTreeNodeKind.Sequence, async (input) => {
      const dispatchInput = input as NodeLogicDispatchInput;
      return await this.sequenceAdapter.dispatch(dispatchInput.runtime, dispatchInput.input);
    });

    handlerMap.set(BehaviorTreeNodeKind.Action, async (input) => {
      const dispatchInput = input as NodeLogicDispatchInput;
      return await this.actionAdapter.dispatch(dispatchInput.runtime, dispatchInput.input);
    });

    this.dispatchEngine.registerStrategy(
      DispatchStrategyConfig.forEnumStrategy({ handlerMap })
    );
  }

  async visitNode(runtime, node) {
    const request = createEnumDispatchRequest(node.Kind, { runtime, input: { node, commandType: 'VisitNode' } });
    await this.dispatchEngine.dispatch(request);
  }
}
```

**第二层分发：ActionType → ActionHandler**

```typescript
class ActionNodeLogicAdapter {
  constructor(private actionHandlerRegistry: ActionHandlerRegistry) {}

  private async handleVisitNode(runtime, node) {
    const actionType = node.Type;

    // 第二层分发
    const handler = this.actionHandlerRegistry.getHandler(actionType);
    if (!handler) {
      throw new Error(`No handler registered for action type: ${actionType}`);
    }

    try {
      const result = await handler.execute({
        runtime: runtime.innerCtx,
        node,
        config: node.Config,
      });

      runtime.pushCommand({
        Type: BehaviorTreeCmdType.FinishLeafNode,
        NodeKey: node.Key,
        Result: result,
      });
    } catch (error) {
      console.error(`Error executing action handler:`, error);
      runtime.pushCommand({
        Type: BehaviorTreeCmdType.FinishLeafNode,
        NodeKey: node.Key,
        Result: BehaviorResult.Failure,
      });
    }
  }
}
```

### 案例 3: Actor 模型（多策略分发）

**场景**：Actor 支持 5 种调用方式

```typescript
class AbstractActor<TResult> implements IActor<TResult> {
  protected route: ActorRoute<TResult> | null = null;

  // 方式 1: 按类分发
  async call(input: unknown): Promise<TResult> {
    const result = await this.dispatch(createClassDispatchRequest(input));
    if (result.isHandled()) {
      return result.getResult();
    }
    throw new Error('No handler found for input type');
  }

  // 方式 2: 按路由键分发
  async callByRouteKey(routeKey: string, input: unknown): Promise<TResult> {
    const result = await this.dispatch(createRouteKeyDispatchRequest(routeKey, input));
    if (result.isHandled()) {
      return result.getResult();
    }
    throw new Error(`No handler found for route key: ${routeKey}`);
  }

  // 方式 3: 按枚举分发
  async callByEnum(routeEnum: string | number, input: unknown): Promise<TResult> {
    const result = await this.dispatch(createEnumDispatchRequest(routeEnum, input));
    if (result.isHandled()) {
      return result.getResult();
    }
    throw new Error(`No handler found for enum: ${routeEnum}`);
  }

  // 内部统一分发
  private async dispatch(request: DispatchRequest<TResult>): Promise<DispatchResult<TResult>> {
    const engine = this.route!.getDispatchEngine();
    return await engine.dispatch(request);
  }
}

// 使用示例
class UserApiActor extends AbstractActor<ApiResponse> {
  constructor() {
    super();
    this.route = new ActorRoute<ApiResponse>();

    // 注册多种分发策略
    this.registerClassHandlers();
    this.registerRouteKeyHandlers();
    this.registerEnumHandlers();

    // 配置分发引擎
    const engine = new DispatchEngine<ApiResponse>();
    engine
      .registerStrategy(DispatchStrategyConfig.forClassStrategy({
        handlerMap: this.route.getClassToHandlerMap(),
      }))
      .registerStrategy(DispatchStrategyConfig.forRouteKeyStrategy({
        handlerMap: this.route.getKeyToHandlerMap(),
      }))
      .registerStrategy(DispatchStrategyConfig.forEnumStrategy({
        handlerMap: this.route.getEnumToHandlerMap(),
      }));

    this.route.setDispatchEngine(engine);
  }
}
```

---

## 常见陷阱与解决方案

### 陷阱 0: 不必要的分发层（过度设计）⚠️

**问题**：为逻辑固定的组件添加不必要的分发层

**背景**：并非所有组件都需要二次分发。只有需要根据类型动态路由到不同处理器的组件才需要分发机制。

```typescript
// ❌ 陷阱：为 Sequence 节点过度设计
class SequenceNodeLogicAdapter {
  // 不必要的 dispatch 方法
  async dispatch(runtime, request) {
    return await runByFuncStyleAdapter(
      runtime,
      request,
      null,
      stdMakeNullOuterComputed,
      stdMakeIdentityInnerRuntime,
      (rt, req) => this.makeInnerInput(rt, req),  // 几乎是 identity mapping
      stdMakeIdentityInnerConfig,
      (rt, input) => this.runCoreLogic(rt, input),  // 只是转发
      (rt, req, cfg, derived, result) => result    // 直接返回
    );
  }

  // 不必要的 makeInnerInput
  makeInnerInput(runtime, request) {
    return {
      node: request.node,
      commandType: request.commandType,
      // ... 只是简单复制
    };
  }

  // 不必要的 runCoreLogic
  async runCoreLogic(runtime, input) {
    switch (input.commandType) {
      case 'VisitNode':
        return await this.handleVisitNode(runtime, input.node);
      // ... 只是路由到私有方法
    }
  }

  // 真正的核心逻辑
  private async handleVisitNode(runtime, node) {
    // Sequence 的固定逻辑
    node.Status = BehaviorTreeNodeStatus.Started;
    const firstChild = this.getFirstExecutableChild(node);
    if (firstChild) {
      runtime.pushCommand({
        Type: BehaviorTreeCmdType.VisitNode,
        NodeId: firstChild.Key,
      });
    }
    // ...
  }
}
```

**问题分析**：

1. **Sequence/Selector/Condition/Until 节点**：逻辑是固定的，不需要二次分发
2. **Action 节点**：需要二次分发（ActionType → ActionHandler），因为有多种 Action 类型
3. **过度封装**：添加了 `dispatch` → `makeInnerInput` → `runCoreLogic` → `handleVisitNode` 四层间接调用
4. **没有价值**：中间层几乎是 identity mapping，没有实际转换逻辑

**解决方案**：直接实现核心逻辑，不添加不必要的分发层

```typescript
// ✅ 解决方案：简化的 Sequence 节点
class SequenceNodeLogicAdapter {
  /**
   * 访问节点 - 直接实现核心逻辑
   */
  visitNode(
    runtime: BehaviorTreeCoreRuntime,
    node: BehaviorTreeNode
  ): void {
    node.Status = BehaviorTreeNodeStatus.Started;

    const firstChild = this.getFirstExecutableChild(node);
    if (firstChild) {
      runtime.pushCommand({
        Type: BehaviorTreeCmdType.VisitNode,
        NodeId: firstChild.Key,
      });
    } else {
      node.Status = BehaviorTreeNodeStatus.Success;
      this.notifyParentNodeFinish(runtime, node, BehaviorResult.Success);
    }
  }

  /**
   * 子节点完成 - 直接实现核心逻辑
   */
  onChildNodeFinish(
    runtime: BehaviorTreeCoreRuntime,
    node: BehaviorTreeNode,
    childIndex: number,
    childResult: BehaviorResult
  ): void {
    if (childResult === BehaviorResult.Failure) {
      node.Status = BehaviorTreeNodeStatus.Failure;
      this.markRemainingChildrenAsOmitted(node, childIndex);
      this.notifyParentNodeFinish(runtime, node, BehaviorResult.Failure);
    } else if (childResult === BehaviorResult.Success) {
      const nextChild = this.getNextExecutableChild(node, childIndex);
      if (nextChild) {
        runtime.pushCommand({
          Type: BehaviorTreeCmdType.VisitNode,
          NodeId: nextChild.Key,
        });
      } else {
        node.Status = BehaviorTreeNodeStatus.Success;
        this.notifyParentNodeFinish(runtime, node, BehaviorResult.Success);
      }
    }
  }

  // ... 其他辅助方法
}
```

**对比：Action 节点（需要二次分发）**

```typescript
// ✅ Action 节点需要二次分发，因为有多种 Action 类型
class ActionNodeLogicAdapter {
  constructor(private actionHandlerRegistry: ActionHandlerRegistry) {}

  private async handleVisitNode(runtime, node) {
    const actionType = node.Type;

    // 第二层分发：ActionType → ActionHandler
    const handler = this.actionHandlerRegistry.getHandler(actionType);
    if (!handler) {
      throw new Error(`No handler for action type: ${actionType}`);
    }

    try {
      const result = await handler.execute({
        runtime,
        node,
        config: node.Config,
      });
      runtime.pushCommand({
        Type: BehaviorTreeCmdType.FinishLeafNode,
        NodeId: node.Key,
        Result: result,
      });
    } catch (error) {
      console.error(`Error executing action handler:`, error);
      runtime.pushCommand({
        Type: BehaviorTreeCmdType.FinishLeafNode,
        NodeId: node.Key,
        Result: BehaviorResult.Failure,
      });
    }
  }
}
```

**判断标准**：

| 场景 | 是否需要分发 | 理由 |
|------|------------|------|
| **逻辑固定** | ❌ 不需要 | Sequence/Selector/Condition/Until - 逻辑是确定的 |
| **需要动态路由** | ✅ 需要 | Action 节点 - 根据 ActionType 路由到不同 Handler |
| **有多种实现** | ✅ 需要 | API 路由 - 不同路径对应不同处理器 |
| **插件化** | ✅ 需要 | 支持动态注册和扩展的组件 |

**关键教训**：

1. **标准化框架不是银弹**：不要为了使用框架而使用框架
2. **简单优于复杂**：能直接实现就直接实现，不要过度抽象
3. **分层有成本**：每增加一层间接调用，都会增加理解和维护成本
4. **识别真正需要的地方**：只在需要动态分发的地方使用分发机制

---

### 陷阱 1: Runtime 过度臃肿

**问题**：把所有东西都塞进 Runtime

```typescript
// ❌ 陷阱
interface BadRuntime {
  everything: any;
  globals: GlobalState;
  allServices: ServiceContainer;
}
```

**解决方案**：精简 Runtime，只包含真正需要的依赖

```typescript
// ✅ 解决方案
interface GoodRuntime {
  // 只包含这个组件真正需要的
  userId: string;
  userService: UserService;
  logger: Logger;
}
```

### 陷阱 2: 忘记处理异步

**问题**：异步函数没有 await

```typescript
// ❌ 陷阱
async function dispatch(runtime, input) {
  const result = handler.execute(input); // 忘记 await
  return result; // 返回 Promise 而不是实际结果
}
```

**解决方案**：统一使用 async/await

```typescript
// ✅ 解决方案
async function dispatch(runtime, input) {
  const result = await handler.execute(input);
  return result;
}
```

### 陷阱 3: 分发层次混乱

**问题**：在错误的层级进行分发

```typescript
// ❌ 陷阱：在 Core Logic 中进行分发
async function coreLogic(runtime, input, config) {
  // 不应该在核心逻辑中做路由分发
  if (input.type === 'A') {
    return handlerA(input);
  } else if (input.type === 'B') {
    return handlerB(input);
  }
}
```

**解决方案**：分发放在 Adapter 或 Dispatcher 层

```typescript
// ✅ 解决方案：使用专门的 Dispatcher
class MyDispatcher {
  async dispatch(runtime, input) {
    const engine = new DispatchEngine();
    engine.registerStrategy(/* ... */);
    return await engine.dispatch(createRequest(input.type, input));
  }
}
```

### 陷阱 4: 测试使用真实依赖

**问题**：测试中创建真实的数据库连接、HTTP 请求等

```typescript
// ❌ 陷阱
test('should create user', async () => {
  const runtime = {
    database: new RealDatabase(), // 连接真实数据库
    httpClient: new RealHttpClient(), // 发送真实请求
  };
  await createUser(runtime, input, config);
});
```

**解决方案**：使用 Mock Runtime

```typescript
// ✅ 解决方案
test('should create user', async () => {
  const mockRuntime = {
    database: {
      users: {
        create: jest.fn().mockResolvedValue(mockUser),
      },
    },
    httpClient: {
      post: jest.fn().mockResolvedValue({ status: 200 }),
    },
  };
  await createUser(mockRuntime, input, config);

  expect(mockRuntime.database.users.create).toHaveBeenCalledWith(input);
});
```

### 陷阱 5: 类型安全缺失

**问题**：过度使用 `any` 类型

```typescript
// ❌ 陷阱
const handler = (input: any) => {
  return processData(input); // 失去类型检查
};
```

**解决方案**：使用泛型保持类型安全

```typescript
// ✅ 解决方案
const handler = <TInput extends UserInput>(input: TInput) => {
  return processData(input); // 保持类型安全
};

// 或者在注册时明确类型
route.getClassToHandlerMap().set(
  UserRequest,
  (input: unknown) => handleUserRequest(input as UserRequest)
);
```

### 陷阱 6: 忽略错误处理

**问题**：没有统一的错误处理机制

```typescript
// ❌ 陷阱
async function handle(runtime, input) {
  const result = await someOperation(input); // 可能抛出异常
  return result;
}
```

**解决方案**：在 Adapter 层统一处理错误

```typescript
// ✅ 解决方案
async function handle(runtime, input) {
  try {
    const result = await someOperation(input);
    return { success: true, data: result };
  } catch (error) {
    runtime.logger.error('Operation failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

---

## 总结

### 核心价值

1. **可测试性**：Runtime 显式化使得测试更容易
2. **可维护性**：清晰的分层和职责划分
3. **可扩展性**：通过 DispatchEngine 灵活添加新功能
4. **类型安全**：TypeScript 泛型保证编译时类型检查
5. **统一规范**：团队使用相同的模式和抽象

### 关键原则回顾

- ✅ **显式优于隐式**：所有依赖通过 Runtime 显式传递
- ✅ **纯函数优于有状态类**：output = fn(runtime, input, config)
- ✅ **组合优于继承**：通过 Adapter 组合功能
- ✅ **类型安全优于灵活性**：使用 TypeScript 泛型
- ✅ **异步优先**：统一使用 async/await
- ✅ **分层清晰**：Outer 层处理框架，Inner 层处理业务

### 适用场景

✅ **适合使用的场景**：
- 复杂业务逻辑系统
- 需要高可测试性的项目
- 插件化/可扩展架构
- 团队协作的大型项目

❌ **不适合的场景**：
- 极简单的 CRUD 应用
- 一次性脚本
- 性能极其敏感的底层库（额外抽象层有性能开销）

---

## 参考资源

- 项目源码：`src/component/StdRunComponentLogic.ts`
- 分发引擎：`src/dispatch/DispatchEngine.ts`
- 实战案例：`tests/business/UserApiAdapterRouter.test.ts`
- 行为树示例：`src/control/BehaviorTreeCore/`

---

**版本**: v1.0
**最后更新**: 2025-11-18
**维护者**: AI Assistant
**许可**: MIT
