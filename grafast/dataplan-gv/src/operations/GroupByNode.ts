import { OperationNode } from './OperationNode'
import { GroupByItemNode } from './GroupByItemNode'

/**
 * AST node for an Group BY clause.
 * 
 * items: the list of GroupByItemNode instances.
 * kind: "GroupByNode"  [oai_citation:0‡kysely-org.github.io](https://kysely-org.github.io/kysely-apidoc/interfaces/GroupByNode.html)
 */
export class GroupByNode extends OperationNode {
  readonly kind = 'GroupByNode'
  readonly items: readonly GroupByItemNode[]

  private constructor(items: readonly GroupByItemNode[]) {
    super()
    this.items = items
  }

  /**
   * Create an GroupByNode.
   * @param items  readonly array of GroupByItemNode
   */
  static create(items: readonly GroupByItemNode[]): GroupByNode {
    return new GroupByNode(items)
  }

  /**
   * Immutable update: return a new node with replaced items.
   */
  clone(items: readonly GroupByItemNode[]): GroupByNode {
    return new GroupByNode(items)
  }

  /**
   * Type guard: true if node.kind === "GroupByNode"
   */
  static is(node: OperationNode): node is GroupByNode {
    return node.kind === 'GroupByNode'
  }
}