import { OperationNode } from './OperationNode';

export class HavingNode extends OperationNode {
  readonly kind = 'HavingNode';
  readonly having: OperationNode;

  private constructor(having: OperationNode) {
    super();
    this.having = having;
  }

  /**
   * Create a HavingNode wrapping any OperationNode 
   * (e.g. a binary expression, a raw SQL fragment, etc.).
   */
  static create(having: OperationNode): HavingNode {
    return new HavingNode(having);
  }

  /**
   * Return a new HavingNode with the given predicate,
   * leaving the original instance untouched.
   */
  clone(): HavingNode {
    return new HavingNode(this.having);
  }

  /**
   * Type guard for runtime detection.
   */
  static is(node: OperationNode): node is HavingNode {
    return node.kind === 'HavingNode';
  }
}