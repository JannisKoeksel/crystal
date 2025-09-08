import { OperationNode } from './OperationNode'

/**
 * Represents a binary comparison or arithmetic operation in the AST,
 * e.g. `"age" > 18`, `salary + bonus`, or `col1 = col2`.
 */
export class BinaryOperationNode extends OperationNode {
  readonly kind = 'BinaryOperationNode'

  /** Left operand of the binary operation. */
  readonly left: OperationNode

  /** Operator token, e.g. '=', '>', '<=', '+', '-', etc. */
  readonly operator: OperationNode

  /** Right operand of the binary operation. */
  readonly right: OperationNode

  private constructor(
    left: OperationNode,
    operator: OperationNode,
    right: OperationNode
  ) {
    super()
    this.left = left
    this.operator = operator
    this.right = right
  }

  /**
   * Create a BinaryOperationNode.
   *
   * @param left   Any OperationNode representing the left expression
   * @param operator   A SQL operator token
   * @param right  Any OperationNode representing the right expression
   */
  static create(
    left: OperationNode,
    operator: OperationNode,
    right: OperationNode
  ): BinaryOperationNode {
    return new BinaryOperationNode(left, operator, right)
  }

  /**
   * Immutable update: returns a new node with the given parts replaced.
   */
  clone(opts: {
    left?: OperationNode
    operator?: OperationNode
    right?: OperationNode
  }): BinaryOperationNode {
    return new BinaryOperationNode(
      opts.left ?? this.left,
      opts.operator ?? this.operator,
      opts.right ?? this.right
    )
  }

  /**
   * Type guard for runtime detection.
   */
  static is(node: OperationNode): node is BinaryOperationNode {
    return node.kind === 'BinaryOperationNode'
  }
}