import { OperationNode } from './OperationNode';

export class WhereNode extends OperationNode {
  readonly kind = 'WhereNode';
  readonly where: OperationNode;

  private constructor(where: OperationNode) {
    super();
    this.where = where;
  }

  /**
   * Create a WhereNode wrapping any OperationNode 
   * (e.g. a binary expression, a raw SQL fragment, etc.).
   */
  static create(where: OperationNode): WhereNode {
    return new WhereNode(where);
  }

  /**
   * Return a new WhereNode with the given predicate,
   * leaving the original instance untouched.
   */
  clone(): WhereNode {
    return new WhereNode(this.where);
  }

  /**
   * Type guard for runtime detection.
   */
  static is(node: OperationNode): node is WhereNode {
    return node.kind === 'WhereNode';
  }
}