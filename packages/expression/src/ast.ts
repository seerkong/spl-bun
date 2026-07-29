export type LiteralValue = number | bigint | string | boolean | null;

export type ExpressionNode =
  | { type: "literal"; value: LiteralValue }
  | { type: "identifier"; name: string }
  | { type: "unary"; op: UnaryOperator; operand: ExpressionNode }
  | { type: "binary"; op: BinaryOperator; left: ExpressionNode; right: ExpressionNode }
  | { type: "call"; callee: string; args: ExpressionNode[]; option?: string; argGroups?: ExpressionNode[][] }
  | { type: "member"; object: ExpressionNode; property: string }
  | { type: "member_call"; object: ExpressionNode; method: string; args: ExpressionNode[]; option?: string; argGroups?: ExpressionNode[][]; aliases?: (string | null)[]; orders?: (ExpressionNode | null)[] }
  | { type: "list"; items: ExpressionNode[] }
  | { type: "record"; entries: { key: string; value: ExpressionNode }[] };

export type UnaryOperator = "negate" | "not" | "plus";

export type BinaryOperator =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "mod"
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "and"
  | "or"
  | "assign"
  | "add_assign"
  | "subtract_assign"
  | "multiply_assign"
  | "divide_assign"
  | "mod_assign"
  | "union"
  | "intersect"
  | "diff"
  | "conj"
  | "comma";

export type MemberOperator = {
  type: "member";
  object: ExpressionNode;
  property: string;
};

export interface CompiledExpression {
  ast: ExpressionNode;
  source: string;
  evaluate(scope: Record<string, unknown>): unknown;
}
