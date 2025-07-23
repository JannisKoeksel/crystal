import { $$deepDepSkip } from "../constants.js";
import type {
  ExecutionDetails,
  GrafastResultsList,
  UnbatchedExecutionExtra,
} from "../interfaces.js";
import type { Step } from "../step.js";
import { UnbatchedStep } from "../step.js";
import type { StepRepresentingList } from "./connection.js";
import { itemsOrStep } from "./connection.js";
import { ListStep } from "./list.js";

export class FirstStep<TData> extends UnbatchedStep<TData> {
  static $$export = {
    moduleName: "grafast",
    exportName: "FirstStep",
  };
  isSyncAndSafe = true;
  allowMultipleOptimizations = true;

  constructor(parentPlan: StepRepresentingList<TData>) {
    super();
    this.addStrongDependency(itemsOrStep(parentPlan));
  }

  [$$deepDepSkip](): Step {
    return this.getDepOptions(0).step;
  }

  execute({
    indexMap,
    values: [values0],
  }: ExecutionDetails<[ReadonlyArray<TData>]>): GrafastResultsList<TData> {
    return indexMap((i) => values0.at(i)?.[0]);
  }

  unbatchedExecute(_extra: UnbatchedExecutionExtra, list: any[]) {
    return list?.[0];
  }

  deduplicate(peers: FirstStep<TData>[]): FirstStep<TData>[] {
    return peers;
  }

  optimize() {
    const parent = this.getDep(0);
    // The first of a list plan is just the first dependency of the list plan.
    if (parent instanceof ListStep) {
      return parent.first();
    }
    return this;
  }
}

/**
 * A plan that resolves to the first entry in the list returned by the given
 * plan.
 */
export function first<TData>(
  plan: StepRepresentingList<TData>,
): FirstStep<TData> {
  return plan.operationPlan.cacheStep(
    plan,
    "GrafastInternal:first()",
    "",
    () => new FirstStep(plan),
  );
}
