# 媒体与文档投影不变量

本文钉结构形状；代码/产物为可重算投影，非执行清单。

## 方程

sourceMedia = (sourceSheetId, drawingId, sourceAnchor, immutableBytes, bindings)
mediaInstance = (sourceMedia, finalCellInstance, evaluatedBindings)
renderedMedia = project(mediaInstance, explicitEncoder)
relationship = (ownerPart, localId, targetPart)
output -/> templateBytes

## 原语

图片/图表声明、来源anchor、最终格实例、媒体字节、图表数据引用/cache、编码请求、part与局部关系。

## 硬不变量

1. ❌ 展开只复制drawing标签。✅ 每个媒体有最终实例anchor、目标part与关系，图表缓存和引用一致。
2. ❌ 原图路径即隐式IO授权。✅ 数据只能来自输入bytes或显式窄端口，不恢复服务定位器。
3. ❌ 动态sheet共享可变chart/drawing。✅ 每个实例有自己的文档，静态图片字节可以共享不可变资源。
4. ❌ 媒体按物理地址猜来源。✅ 源格身份及统一reference projection决定最终坐标。
5. ❌ dataExpr任意对象、坏图片或无限体积静默输出。✅ 明确bytes/mime契约、尺寸/数量/体积边界及位置诊断。
6. ❌ 表达式/HTML/data cache分开编造结果。✅ 同一实例值生成当前缓存和产品观察。
7. ❌ 原模板或输入反写。✅ 渲染请求内衍生值独立，输出结束可丢弃。

## 排除集

- core读文件/网络、隐式容器、跨请求媒体cache。
- 漏失被声明的动态图片/图表，或用静态part存在冒称支持。
- 调用第三方编码器而把任意脚本/服务路径传入编码器。

## Harness

MISSION为期望态，loop拥有当前工作图，evidence只追加；测试度量字节/坐标/关系和负向边界。
