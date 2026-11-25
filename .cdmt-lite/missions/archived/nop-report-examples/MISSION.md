# Mission: 七个复杂报表案例

终点: 七个模板通过共享报表入口，核对表格文字、布局和生成的码图。

## Attractors

[AT1 数据与派生结果](attractor.md)

## Notes

来源为 nop-report TestReportDemoBizModel。使用 cdmt-mission-lite 和 depa-expert。

## 期望结果

- 期望-1: 七个模板通过共享报表入口，核对表格文字、布局和生成的码图。

## 约束

- 约束-1: 保留输入及既有调用协议，按 AT1 验证边界。

## Acceptance

- [x] 期望-1、约束-1 → `bun test packages/report-xlsx-support/__tests__/nop-examples.test.ts` → 七个案例、快照比对、四个码图和输入不变。

## 范围外

企业平台及外部源码改写。
