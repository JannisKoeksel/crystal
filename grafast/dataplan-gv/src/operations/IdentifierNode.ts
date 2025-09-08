import { OperationNode } from './OperationNode'

/**
 * AST node for a SQL identifier (e.g. table or column name).
 *
 * Properties:
 *  - name: the identifier text, without quotes
 * Kind: "IdentifierNode"  [oai_citation:0‡kysely-org.github.io](https://kysely-org.github.io/kysely-apidoc/interfaces/IdentifierNode.html?utm_source=chatgpt.com)
 */
export class IdentifierNode extends OperationNode {
  readonly kind = 'IdentifierNode'
  readonly name: string

  private constructor(name: string) {
    super()
    this.name = name
  }

  /**
   * Create an IdentifierNode.
   *
   * @param name  The identifier (unquoted)
   */
  static create(name: string): IdentifierNode {
    return new IdentifierNode(name)
  }

  /**
   * Immutable update: returns a new node with the given name.
   */
  clone(name: string): IdentifierNode {
    return new IdentifierNode(name)
  }

  /**
   * Type guard: true if node.kind === "IdentifierNode"
   */
  static is(node: OperationNode): node is IdentifierNode {
    return node.kind === 'IdentifierNode'
  }
}