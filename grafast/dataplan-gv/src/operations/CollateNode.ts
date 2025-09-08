import { OperationNode } from './OperationNode'
import { IdentifierNode } from './IdentifierNode'

/**
 * AST node for an explicit COLLATE clause.
 *
 * Props:
 *  - collation: IdentifierNode representing the collation name
 * Kind: "CollateNode"  [oai_citation:0‡kysely-org.github.io](https://kysely-org.github.io/kysely-apidoc/interfaces/CollateNode.html)
 */
export class CollateNode extends OperationNode {
  readonly kind = 'CollateNode'
  readonly collation: IdentifierNode

  private constructor(collation: IdentifierNode) {
    super()
    this.collation = collation
  }

  /** @see {@link https://kysely-org.github.io/kysely-apidoc/interfaces/CollateNode.html} */
  static create(collation: IdentifierNode): CollateNode {
    return new CollateNode(collation)
  }

  clone(collation: IdentifierNode): CollateNode {
    return new CollateNode(collation)
  }

  static is(node: OperationNode): node is CollateNode {
    return node.kind === 'CollateNode'
  }
}