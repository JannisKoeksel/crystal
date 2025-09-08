import { BinaryOperationNode } from "./BinaryOperationNode";
import { OperationNode } from "./OperationNode";
import { WhereNode } from "./WhereNode";
import { HavingNode } from "./HavingNode";

export { WhereNode, BinaryOperationNode, OperationNode, HavingNode };

export type NodeOrCallback<Node extends OperationNode> = (() => Node) | Node;

export const getNode = <N extends OperationNode>(
  nodeSource: NodeOrCallback<N>,
): N => {
  const maybeNode = nodeSource as OperationNode;

  if (maybeNode.isOperationNode) {
    // nodeSource is an OperationNode instance
    return maybeNode as N;
  }

  // otherwise, nodeSource is a factory function
  return (nodeSource as () => N)();
};
