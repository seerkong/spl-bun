# 布局实施设计（以反例调和，不是执行状态）

- 当前expandAxis串联siblings并全局独立rows/cols，需共用一个空间模型替换，不保留第二套平行引擎。
- 初始两轴序列合并/overlay假说已由源码和反例否定。实际只保留一个layoutSheet实例表，父依赖满足后按实例展开，插槽移动空间但不改变来源身份。可交替行列依赖，不设全局主轴。
- 第一项原位，后项复制owner及同轴后代；复制内部父关系重新连接，外部父关系保持。实际矩形跨度直接生成合并格，不把padding当记录。
- inplace复用原有预留槽，仅超容量才插入；其他行列的静态格不会随预留区删除。同父siblings使用槽的generator来源复用最大空间，实例绑定各自独立。
- 完整父关联与公式selector已有。隐藏/删除在求值后显式计算；物理删除后重分配坐标，重新按保留实例求值/导出公式，不复用旧cache当事实。
- style/display/export与raw分列，模板提供style palette（含命名样本），表达式只返回选择或patch，不修改共享style。多行配置先聚合字符串值再做字段类型校验。
- 后续document-reference-projection统一消费源地址→输出实例映射，不能只依赖rowOrigins/colOrigins描述inplace/复杂二维格。
