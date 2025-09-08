import { OperationNode } from './OperationNode'

/**
 * One entry in a GROUP BY clause.
 *
 * Props:
 *  - grouping: the expression to group by (column ref, function call, raw, etc.)
 * Kind: "GroupByItemNode"
 */
export class GroupByItemNode extends OperationNode {
  readonly kind = 'GroupByItemNode'
  readonly grouping: OperationNode

  private constructor(grouping: OperationNode) {
    super()
    this.grouping = grouping
  }

  /**
   * Create a GroupByItemNode.
   *
   * @param grouping  Any OperationNode representing the grouping expression
   */
  static create(grouping: OperationNode): GroupByItemNode {
    return new GroupByItemNode(grouping)
  }

  /**
   * Immutable update: return a new node with a different grouping expression.
   */
  clone(grouping: OperationNode): GroupByItemNode {
    return new GroupByItemNode(grouping)
  }

  /**
   * Type guard: true if this node’s kind === "GroupByItemNode"
   */
  static is(node: OperationNode): node is GroupByItemNode {
    return node.kind === 'GroupByItemNode'
  }
}
