// 前置类型声明
interface DataReadRuntime {}
interface PermissionRuntime {}
interface DataWriteSupportMesh {}
interface DataWriteCallback {}
interface DataWriteOptions {}
interface DataWriteConfigProviders {}
interface DataWriteOuterCtx {}
interface DataWriteInnerCtx {}
interface DataWriteErrorCtx {}
interface TransactionCtx {}
interface DataWriteImmutableSnapshot {}
interface DataWriteMutableSnapshot {}

// 默认值工厂
const createDefaultOptions = (): DataWriteOptions => ({});
const createDefaultConfigProviders = (): DataWriteConfigProviders => ({});
const createDefaultOuterCtx = (): DataWriteOuterCtx => ({});
const createDefaultInnerCtx = (): DataWriteInnerCtx => ({});
const createDefaultErrorCtx = (): DataWriteErrorCtx => ({});
const createDefaultTransactionCtx = (): TransactionCtx => ({});
const createDefaultImmutableSnapshot = (): DataWriteImmutableSnapshot => ({});
const createDefaultMutableSnapshot = (): DataWriteMutableSnapshot => ({});

export class DataWriteRuntime {
  // 其他域的runtime实例 start
  public readRuntime?: DataReadRuntime;
  public permissionRuntime?: PermissionRuntime;
  // 其他域的runtime实例 end

  // 逻辑依赖 start
  public supportMesh?: DataWriteSupportMesh; // 以接口interface形式提供的固定依赖
  public callback?: DataWriteCallback; // 零散的逻辑依赖合集，有强依赖和可选依赖之分。对象中的字段允许为空，表示可选的依赖函数回调
  // 逻辑依赖 end

  // 引擎配置 start
  public options: DataWriteOptions = createDefaultOptions(); // 零散的，已经计算好的值，bool, number, string
  public configProviders: DataWriteConfigProviders = createDefaultConfigProviders(); // 对象中的每个字段，存放的是引擎执行过程中，需要动态主动调用一下获取最新配置的函数
  // 引擎配置 end

  // 外部上下文 start
  // 【外部产生】【值对象】【不可变】在一次外部调用过程中，本模块将输入转换成的内部不可变参数
  public outerCtx: DataWriteOuterCtx = createDefaultOuterCtx();
  // 外部上下文 end

  // 内部上下文 start
  // 【内部产生】【值对象】【可变】在一次外部调用过程中，在内存中进行记录的数据。
  public innerCtx: DataWriteInnerCtx = createDefaultInnerCtx();
  // 【内部产生】【值对象】【可变】在一次外部调用过程中，如果出现了错误，错误相关的数据存储在这个上下文中
  public errorCtx: DataWriteErrorCtx = createDefaultErrorCtx();
  public transactionCtx: TransactionCtx = createDefaultTransactionCtx();
  // 内部上下文 end

  // 数据镜像 start
  // ImmutableSnapshot： 【其他模块产生】【实体、值对象】【不可变】在整个被调用过程中，依赖的需要加载到内存中的持久化存储数据。
  public immutableSnapshot: DataWriteImmutableSnapshot = createDefaultImmutableSnapshot();
  // MutableSnapshot： 【本模块产生】【实体、值对象】【可变】在整个被调用过程中，会产生数据变化的，需要从持久化存储加载和保存的数据, 和再次加工计算得到的数据
  public mutableSnapshot: DataWriteMutableSnapshot = createDefaultMutableSnapshot();
  // 数据镜像 end
}
