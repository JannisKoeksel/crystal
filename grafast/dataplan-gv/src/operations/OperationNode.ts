export abstract class OperationNode {
  isOperationNode = true;
  abstract kind: string;
  abstract clone(...args: any): OperationNode;
}
