import { OperationNode } from './OperationNode'
import { IdentifierNode } from './IdentifierNode'

/**
 * AST node for an alias expression, e.g. `expr AS alias`.
 *
 * Props:
 *  - node: the expression being aliased
 *  - alias: IdentifierNode representing the alias name
 * Kind: "AliasNode"
 */
export class AliasNode extends OperationNode {
  readonly kind = 'AliasNode'
  readonly node: OperationNode
  readonly alias: IdentifierNode

  private constructor(opts: {
    node: OperationNode
    alias: IdentifierNode
  }) {
    super()
    this.node = opts.node
    this.alias = opts.alias
  }

  /**
   * Create an AliasNode.
   *
   * @param node    OperationNode to alias
   * @param alias   IdentifierNode for the alias name
   */
  static create(
    node: OperationNode,
    alias: IdentifierNode
  ): AliasNode {
    return new AliasNode({ node, alias })
  }

  /**
   * Immutable update: return a new node with one or both fields changed.
   */
  clone(opts: {
    node?: OperationNode
    alias?: IdentifierNode
  }): AliasNode {
    return new AliasNode({
      node:  opts.node  ?? this.node,
      alias: opts.alias ?? this.alias,
    })
  }

  /**
   * Type guard: true if node.kind === "AliasNode"
   */
  static is(node: OperationNode): node is AliasNode {
    return node.kind === 'AliasNode'
  }
}