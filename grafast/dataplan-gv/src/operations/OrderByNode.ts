import { OperationNode } from './OperationNode'
import { OrderByItemNode } from './OrderByItemNode'

/**
 * AST node for an ORDER BY clause.
 * 
 * items: the list of OrderByItemNode instances.
 * kind: "OrderByNode"  [oai_citation:0‡kysely-org.github.io](https://kysely-org.github.io/kysely-apidoc/interfaces/OrderByNode.html)
 */
export class OrderByNode extends OperationNode {
  readonly kind = 'OrderByNode'
  readonly items: readonly OrderByItemNode[]

  private constructor(items: readonly OrderByItemNode[]) {
    super()
    this.items = items
  }

  /**
   * Create an OrderByNode.
   * @param items  readonly array of OrderByItemNode
   */
  static create(items: readonly OrderByItemNode[]): OrderByNode {
    return new OrderByNode(items)
  }

  /**
   * Immutable update: return a new node with replaced items.
   */
  clone(items: readonly OrderByItemNode[]): OrderByNode {
    return new OrderByNode(items)
  }

  /**
   * Type guard: true if node.kind === "OrderByNode"
   */
  static is(node: OperationNode): node is OrderByNode {
    return node.kind === 'OrderByNode'
  }
}