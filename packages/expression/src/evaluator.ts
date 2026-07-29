import {splString} from "./formatting";
import type { CompiledExpression, ExpressionNode, BinaryOperator, UnaryOperator } from "./ast";
import { builtins, type FunctionRegistry } from "./functions";
import { defaultMemberRegistry, type MemberFunctionRegistry } from "./memberRegistry";
import { parseExpression } from "./parser";
import { isNullish, truthy } from "./utils";
import { getValueType, type TypedValue } from "./types";
import { combineSequences } from "./sequence";

import { scalarArithmetic, scalarCompare, scalarEquals, isSplNumber, numericBinary } from "./scalar";

function evaluateBinary(op: BinaryOperator, left: unknown, right: unknown, scope: Record<string, unknown>, registry: FunctionRegistry): unknown {
  switch (op) {
    case "add": case "subtract": case "multiply": case "divide": case "mod":
      return scalarArithmetic(op,left,right);
    case "eq": return scalarEquals(left,right);
    case "neq": return !scalarEquals(left,right);
    case "lt": return scalarCompare(left,right)<0;
    case "lte": return scalarCompare(left,right)<=0;
    case "gt": return scalarCompare(left,right)>0;
    case "gte": return scalarCompare(left,right)>=0;
    case "and":
      return truthy(left) && truthy(right);
    case "or":
      return truthy(left) || truthy(right);
    case "comma":
      return right;
    case "assign":
      if (typeof left !== "string") {
        throw new Error("Assignment target must be an identifier");
      }
      scope[left] = right;
      return right;
    case "add_assign":
      if (typeof left !== "string") {
        throw new Error("Assignment target must be an identifier");
      }
      const currentAdd = scope[left];
      const newValAdd = evaluateBinary("add", currentAdd, right, scope, registry);
      scope[left] = newValAdd;
      return newValAdd;
    case "subtract_assign":
      if (typeof left !== "string") {
        throw new Error("Assignment target must be an identifier");
      }
      const currentSub = scope[left];
      const newValSub = evaluateBinary("subtract", currentSub, right, scope, registry);
      scope[left] = newValSub;
      return newValSub;
    case "multiply_assign":
      if (typeof left !== "string") {
        throw new Error("Assignment target must be an identifier");
      }
      const currentMul = scope[left];
      const newValMul = evaluateBinary("multiply", currentMul, right, scope, registry);
      scope[left] = newValMul;
      return newValMul;
    case "divide_assign":
      if (typeof left !== "string") {
        throw new Error("Assignment target must be an identifier");
      }
      const currentDiv = scope[left];
      const newValDiv = evaluateBinary("divide", currentDiv, right, scope, registry);
      scope[left] = newValDiv;
      return newValDiv;
    case "mod_assign":
      if (typeof left !== "string") {
        throw new Error("Assignment target must be an identifier");
      }
      const currentMod = scope[left];
      const newValMod = evaluateBinary("mod", currentMod, right, scope, registry);
      scope[left] = newValMod;
      return newValMod;
    case "union": return combineSequences("union",left,right);
    case "intersect": {
      if((left!=null&&!Array.isArray(left))||(right!=null&&!Array.isArray(right)))throw new Error("intersect expects array operands");
      return left==null||right==null?null:combineSequences("isect",left,right);
    }
    case "diff": {
      if (Array.isArray(left)) {
        return combineSequences("diff",left,right);
      }
      if (left == null) {
        return null;
      }
      if (right == null) {
        return left;
      }
      if (!isSplNumber(left) || !isSplNumber(right)) throw new Error("Integer division requires numbers");
      return numericBinary("intDivide",left,right);
    }
    case "conj": {
      const leftArr = Array.isArray(left) ? left : left == null ? [] : [left];
      const rightArr = Array.isArray(right) ? right : right == null ? [] : [right];
      return [...leftArr, ...rightArr];
    }
    default:
      throw new Error(`Unsupported operator ${op}`);
  }
}

function evaluateUnary(op: UnaryOperator, value: unknown): unknown {
  switch (op) {
    case "negate":
      if (value == null) return null;
      if (!isSplNumber(value)) throw new Error("Negation requires a number");
      return numericBinary("subtract",0,value);
    case "plus":
      if (value == null) return null;
      if (!isSplNumber(value)) throw new Error("Unary plus requires a number");
      return value;
    case "not":
      return !truthy(value);
  }
}

export function evaluateAst(
  node: ExpressionNode,
  scope: Record<string, unknown>,
  registry: FunctionRegistry,
  memberRegistry: MemberFunctionRegistry = defaultMemberRegistry,
): unknown {
  switch (node.type) {
    case "literal":
      return node.value;
    case "identifier":
      return scope[node.name];
    case "member": {
      const obj = evaluateAst(node.object, scope, registry, memberRegistry);
      if (obj == null) return null;
      if (typeof obj === "object" && node.property in obj) {
        return (obj as Record<string, unknown>)[node.property];
      }
      return null;
    }
    case "member_call": {
      const target = evaluateAst(node.object, scope, registry, memberRegistry);
      if (target == null) {
        throw new Error(`Cannot call method '${node.method}' on null`);
      }
      const contextual = memberRegistry.resolveExpression(node.method,target);
      if(contextual) return contextual({scope,compile:source=>compileExpression(source,registry,memberRegistry),evaluate:(ast,local)=>evaluateAst(ast,local,registry,memberRegistry)},{target,call:node});
      if(node.aliases) throw new Error(node.method+" does not accept column aliases");
      if(node.orders) throw new Error(node.method+" order annotations require a row-aware member adapter");
      const memberFn = memberRegistry.resolve(node.method, target);
      if (memberFn) {
        const args = node.args.map((arg) => evaluateAst(arg, scope, registry, memberRegistry));
        if (node.argGroups) {
          const groups = node.argGroups.map((group) =>
            group.map((arg) => evaluateAst(arg, scope, registry, memberRegistry))
          );
          args.push(groups);
        }
        if (node.option) {
          args.push(node.option);
        }
        return memberFn(target, ...args);
      }
      if (typeof target === "object" && target !== null) {
        const method = (target as Record<string, unknown>)[node.method];
        if (typeof method === "function") {
          const args = node.args.map((arg) => evaluateAst(arg, scope, registry, memberRegistry));
          if (node.argGroups) {
            const groups = node.argGroups.map((group) =>
              group.map((arg) => evaluateAst(arg, scope, registry, memberRegistry))
            );
            args.push(groups);
          }
          if (node.option) {
            args.push(node.option);
          }
          return (method as (...args: unknown[]) => unknown).apply(target, args);
        }
      }
      throw new Error(`Unknown member function '${node.method}'`);
    }
    case "list": {
      return node.items.map((item) => evaluateAst(item, scope, registry, memberRegistry));
    }
    case "record": {
      const out: Record<string, unknown> = {};
      for (const entry of node.entries) {
        out[entry.key] = evaluateAst(entry.value, scope, registry, memberRegistry);
      }
      return out;
    }
    case "unary":
      return evaluateUnary(node.op, evaluateAst(node.operand, scope, registry, memberRegistry));
    case "binary": {
      if (node.op === "and" || node.op === "or") {
        const left = truthy(evaluateAst(node.left, scope, registry, memberRegistry));
        return node.op === "and"
          ? left && truthy(evaluateAst(node.right, scope, registry, memberRegistry))
          : left || truthy(evaluateAst(node.right, scope, registry, memberRegistry));
      }
      if (node.op === "comma") {
        evaluateAst(node.left, scope, registry, memberRegistry);
        return evaluateAst(node.right, scope, registry, memberRegistry);
      }
      if (
        node.op === "assign" ||
        node.op === "add_assign" ||
        node.op === "subtract_assign" ||
        node.op === "multiply_assign" ||
        node.op === "divide_assign" ||
        node.op === "mod_assign"
      ) {
        if (node.left.type !== "identifier") {
          throw new Error("Assignment target must be an identifier");
        }
        const rightValue = evaluateAst(node.right, scope, registry, memberRegistry);
        return evaluateBinary(node.op, node.left.name, rightValue, scope, registry);
      }
      return evaluateBinary(
        node.op,
        evaluateAst(node.left, scope, registry, memberRegistry),
        evaluateAst(node.right, scope, registry, memberRegistry),
        scope,
        registry,
      );
    }
    case "call": {
      const fn = registry[node.callee.toLowerCase()];
      if (!fn) {
        throw new Error(`Unknown function '${node.callee}'`);
      }
      const callee = node.callee.toLowerCase();
      if (fn === builtins.parse && (node.argGroups || node.args.length < 1 || node.args.length > 2 || node.option && node.args.length !== 1))
        throw new Error('parse: expected one value and optional q/e/n options');
      if (fn===builtins.string && node.option && !node.argGroups && node.args.length===1) return splString(evaluateAst(node.args[0],scope,registry,memberRegistry),undefined,undefined,node.option);
      if (["string","number","format"].includes(callee) && fn===builtins[callee] && (node.option||node.argGroups)) throw new Error(callee+": unsupported options or parameter groups");
      if (fn===builtins.string && (node.args.length<1||node.args.length>3) || fn===builtins.number && (node.args.length<1||node.args.length>2)) throw new Error(callee+": unsupported parameter overload");
      const fixedArity: Record<string,number> = {long:1,decimal:1,elapse:2,dateadd:2,interval:2,datediff:2};
      const arity = fixedArity[callee];
      if (arity && fn === builtins[callee]) {
        const numeric = callee === "long" || callee === "decimal";
        if (node.argGroups || node.args.length < arity || node.args.length > arity + (numeric ? 0 : 1) || node.option && (numeric || node.args.length > arity)) throw new Error(`${callee}: unsupported options or parameter overload`);
      }
      if(fn===builtins.union && (node.option||node.argGroups))throw new Error("Global union options/parameter groups are not supported");
      if (fn === builtins.if && !node.option && !node.argGroups) {
        if (node.args.length < 1 || node.args.length > 3) throw new Error("if() expects 1-3 arguments");
        const condition = truthy(evaluateAst(node.args[0], scope, registry, memberRegistry));
        if (node.args.length === 1) return condition;
        const branch = node.args[condition ? 1 : 2];
        return branch ? evaluateAst(branch, scope, registry, memberRegistry) : null;
      }
      if (fn === builtins.case && !node.option && !node.argGroups) {
        if (!node.args.length) throw new Error("case() expects at least 1 argument");
        const value = evaluateAst(node.args[0], scope, registry, memberRegistry);
        for (let i = 1; i + 1 < node.args.length; i += 2) {
          if (scalarEquals(value, evaluateAst(node.args[i], scope, registry, memberRegistry))) {
            return evaluateAst(node.args[i + 1], scope, registry, memberRegistry);
          }
        }
        return null;
      }
      const args = node.args.map((a, idx) => {
        // SPL flow control: func(A1, ...) treats the first argument as a cellRef literal.
        // We preserve identifier-as-scope lookup for all other contexts.
        if (callee === "func" && idx === 0 && a.type === "identifier") {
          return a.name;
        }
        return evaluateAst(a, scope, registry, memberRegistry);
      });
      if (node.argGroups) {
        const groups = node.argGroups.map((group) => group.map((a) => evaluateAst(a, scope, registry, memberRegistry)));
        args.push(groups);
      }
      if (node.option) {
        args.push(node.option);
      }
      return fn(...args);
    }
    default:
      // eslint-disable-next-line @typescript-eslint/redundant-type-constituents
      const exhaustive: never = node;
      return exhaustive;
  }
}

export function compileExpression(
  source: string,
  registry: FunctionRegistry = builtins,
  memberRegistry: MemberFunctionRegistry = defaultMemberRegistry,
): CompiledExpression {
  const ast = parseExpression(source);
  return {
    ast,
    source,
    evaluate: (scope) => evaluateAst(ast, scope, registry, memberRegistry),
  };
}

export function evaluateExpression(
  source: string,
  scope: Record<string, unknown>,
  registry: FunctionRegistry = builtins,
  memberRegistry: MemberFunctionRegistry = defaultMemberRegistry,
): unknown {
  return compileExpression(source, registry, memberRegistry).evaluate(scope);
}

export function evaluateTypedExpression(
  source: string,
  scope: Record<string, unknown>,
  registry: FunctionRegistry = builtins,
  memberRegistry: MemberFunctionRegistry = defaultMemberRegistry,
): TypedValue {
  const value = evaluateExpression(source, scope, registry, memberRegistry);
  return { value, type: getValueType(value) };
}
