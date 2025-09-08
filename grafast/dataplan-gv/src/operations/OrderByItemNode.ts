import { OperationNode } from './OperationNode'
import { CollateNode } from './CollateNode'

/**
 * One entry in an ORDER BY clause.
 *
 * Props:
 *  - orderBy: OperationNode to sort by
 *  - direction?: OperationNode (e.g. ASC, DESC)
 *  - nulls?: "first" | "last"
 *  - collation?: CollateNode for explicit COLLATE
 * Kind: "OrderByItemNode"  [oai_citation:1‡kysely-org.github.io](https://kysely-org.github.io/kysely-apidoc/interfaces/OrderByItemNode.html)
 */

export class OrderByItemNode extends OperationNode {
    readonly kind = 'OrderByItemNode'
    readonly collation?: CollateNode
    readonly direction?: OperationNode
    readonly nulls?: 'first' | 'last'
    readonly orderBy: OperationNode
  
    private constructor(opts: {
      orderBy: OperationNode
      direction?: OperationNode
      nulls?: 'first' | 'last'
      collation?: CollateNode
    }) {
      super()
      this.orderBy  = opts.orderBy
      this.direction = opts.direction
      this.nulls     = opts.nulls
      this.collation = opts.collation
    }
  
    /** @see {@link https://kysely-org.github.io/kysely-apidoc/interfaces/OrderByItemNode.html} */
    static create(opts: {
      orderBy: OperationNode
      direction?: OperationNode
      nulls?: 'first' | 'last'
      collation?: CollateNode
    }): OrderByItemNode {
      return new OrderByItemNode(opts)
    }
  
    clone(opts: {
      orderBy?: OperationNode
      direction?: OperationNode
      nulls?: 'first' | 'last'
      collation?: CollateNode
    }): OrderByItemNode {
      return new OrderByItemNode({
        orderBy:  opts.orderBy  ?? this.orderBy,
        direction: opts.direction ?? this.direction,
        nulls:     opts.nulls     ?? this.nulls,
        collation: opts.collation ?? this.collation,
      })
    }
  
    static is(node: OperationNode): node is OrderByItemNode {
      return node.kind === 'OrderByItemNode'
    }
  }