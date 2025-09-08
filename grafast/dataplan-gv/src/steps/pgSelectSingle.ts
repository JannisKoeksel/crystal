import type { EdgeCapableStep, Step, UnbatchedExecutionExtra } from "grafast";
import { exportAs, UnbatchedStep } from "grafast";
import type { SQL, SQLable } from "pg-sql2";
import sql, { $$toSQL } from "pg-sql2";

import type { PgCodecAttribute } from "../codecs.js";
import { TYPES } from "../codecs.js";
import type { PgResource } from "../datasource.js";
import type {
  GetPgResourceAttributes,
  GetPgResourceCodec,
  GetPgResourceRelations,
  PgCodec,
  PgCodecRelation,
  PgQueryRootStep,
  PgRegistry,
  PgSQLCallbackOrDirect,
  PgTypedStep,
} from "../interfaces.js";
import { makeScopedSQL } from "../utils.js";
import {
  pgClassExpression,
  PgClassExpressionStep,
} from "./pgClassExpression.js";
import { PgCursorStep } from "./pgCursor.js";
import type { PgSelectMode } from "./pgSelect.js";
import { PgSelectStep } from "./pgSelect.js";
// import debugFactory from "debug";

// const debugPlan = debugFactory("@dataplan/pg:PgSelectSingleStep:plan");
// const debugExecute = debugFactory("@dataplan/pg:PgSelectSingleStep:execute");
// const debugPlanVerbose = debugPlan.extend("verbose");
// const debugExecuteVerbose = debugExecute.extend("verbose");

export interface PgSelectSinglePlanOptions {
  fromRelation?: [PgSelectSingleStep<PgResource>, string];
}

const EMPTY_TUPLE = Object.freeze([]) as never[];

// Types that only take a few bytes so adding them to the selection would be
// cheap to do.
const CHEAP_ATTRIBUTE_TYPES = new Set([
  TYPES.int2,
  TYPES.int,
  TYPES.bigint,
  TYPES.float,
  TYPES.float4,
  TYPES.uuid,
  TYPES.boolean,
  TYPES.date,
  TYPES.timestamp,
  TYPES.timestamptz,
]);

/**
 * Represents the single result of a unique PgSelectStep. This might be
 * retrieved explicitly by PgSelectStep.single(), or implicitly (via Grafast)
 * by PgSelectStep.item(). Since this is the result of a fetch it does not make
 * sense to support changing `.where` or similar; however we now add methods
 * such as `.get` and `.cursor` which can receive specific properties by
 * telling the PgSelectStep to select the relevant expressions.
 */
export class PgSelectSingleStep<
    TResource extends PgResource<any, any, any, any, any> = PgResource,
  >
  extends UnbatchedStep<
    | unknown[]
    | null /* What we return will be a tuple based on the values selected */
  >
  implements
    PgTypedStep<
      TResource extends PgResource<any, infer UCodec, any, any, any>
        ? UCodec
        : never
    >,
    EdgeCapableStep<any>,
    SQLable
{
  static $$export = {
    moduleName: "@dataplan/pg",
    exportName: "PgSelectSingleStep",
  };
  isSyncAndSafe = true;

  public readonly pgCodec: GetPgResourceCodec<TResource>;
  public readonly itemStepId: number;
  public readonly mode: PgSelectMode;
  private classStepId: number;
  private nullCheckId: number | null = null;
  public readonly resource: TResource;
  private _coalesceToEmptyObject = false;
  private fromRelation: { refId: number | null; relationName: string } | null =
    null;

  constructor(
    $class: PgSelectStep<TResource>,
    $item: Step<unknown[]>,
    options: PgSelectSinglePlanOptions = Object.create(null),
  ) {
    super();
    this.itemStepId = this.addDependency($item);
    this.resource = $class.resource;
    this.pgCodec = this.resource.codec as GetPgResourceCodec<TResource>;
    this.mode = $class.mode;
    this.classStepId = $class.id;
    this.peerKey = this.resource.name;
    if (options.fromRelation) {
      const [$pgSelectSingle, relationName] = options.fromRelation;
      this.fromRelation = {
        refId: this.addRef(
          $pgSelectSingle,
          "Indirect reference allowed due to relational field potentially pulling from a parent relation",
        ),
        relationName,
      };
    }
  }

  public coalesceToEmptyObject(): void {
    this._coalesceToEmptyObject = true;
  }

  public toStringMeta(): string {
    return this.resource.name;
  }

  public getClassStep(): PgSelectStep<TResource> {
    if (this.isOptimized) {
      throw new Error(`Cannot ${this}.getClassStep() after we're optimized.`);
    }
    const plan = this.getStep(this.classStepId);
    if (!(plan instanceof PgSelectStep)) {
      throw new Error(
        `Expected ${this.classStepId} (${plan}) to be a PgSelectStep`,
      );
    }
    return plan;
  }

  /** @internal */
  public getItemStep(): Step<unknown[]> {
    const plan = this.getDep(this.itemStepId);
    return plan;
  }

  /**
   * Do not rely on this, we're going to refactor it to work a different way at some point.
   *
   * @internal
   */
  getSelfNamed(): PgClassExpressionStep<
    GetPgResourceCodec<TResource>,
    TResource
  > {
    if (this.mode === "aggregate") {
      throw new Error("Invalid call to getSelfNamed on aggregate plan");
    }
    // Hack because I don't want to duplicate the code.
    return this.get("" as any) as any;
  }

  /**
   * Returns a plan representing a named attribute (e.g. column) from the class
   * (e.g. table).
   */
  public get<TAttr extends keyof GetPgResourceAttributes<TResource>>(
    attr: TAttr,
  ): PgClassExpressionStep<
    GetPgResourceAttributes<TResource>[TAttr] extends PgCodecAttribute<
      infer UCodec,
      any
    >
      ? UCodec
      : never,
    TResource
  > {
    return this.cacheStep("get", attr, () => this._getInternal(attr));
  }

  private _getInternal<TAttr extends keyof GetPgResourceAttributes<TResource>>(
    attr: TAttr,
  ): PgClassExpressionStep<
    GetPgResourceAttributes<TResource>[TAttr] extends PgCodecAttribute<
      infer UCodec,
      any
    >
      ? UCodec
      : never,
    TResource
  > {
    if (this.mode === "aggregate") {
      throw new Error("Invalid call to .get() on aggregate plan");
    }
    if (!this.resource.codec.attributes && attr !== "") {
      throw new Error(
        `Cannot call ${this}.get() when the resource codec (${this.resource.codec.name}) has no attributes to get.`,
      );
    }
    const classPlan = this.getClassStep();
    const resourceAttribute: PgCodecAttribute | undefined =
      this.resource.codec.attributes?.[attr as string];
    if (!resourceAttribute && attr !== "") {
      throw new Error(
        `${this.resource} does not define an attribute named '${String(attr)}'`,
      );
    }

    if (resourceAttribute?.via) {
      const { relation, attribute } = this.resource.resolveVia(
        resourceAttribute.via,
        attr as string,
      );
      return this.singleRelation(relation as any).get(attribute) as any;
    }

    if (resourceAttribute?.identicalVia) {
      const { relation, attribute } = this.resource.resolveVia(
        resourceAttribute.identicalVia,
        attr as string,
      );

      const $existingPlan = this.existingSingleRelation(relation as any);
      if ($existingPlan) {
        // Relation exists already; load it from there for efficiency
        return $existingPlan.get(attribute) as any;
      } else {
        // Load it from ourself instead
      }
    }

    if (this.fromRelation) {
      const { refId, relationName } = this.fromRelation;
      const $fromPlan = this.getRef(refId);
      if ($fromPlan instanceof PgSelectSingleStep) {
        const matchingAttribute = (
          Object.entries($fromPlan.resource.codec.attributes!) as Array<
            [string, PgCodecAttribute]
          >
        ).find(([name, col]) => {
          if (col.identicalVia) {
            const { relation, attribute } = $fromPlan.resource.resolveVia(
              col.identicalVia,
              name,
            );
            if (attribute === attr && relation === relationName) {
              return true;
            }
          }
          return false;
        });
        if (matchingAttribute) {
          return $fromPlan.get(matchingAttribute[0]) as any;
        }
      }
    }

    /*
     * Only cast to `::text` during select; we want to use it uncasted in
     * conditions/etc. The reasons we cast to ::text include:
     *
     * - to make return values consistent whether they're direct or in nested
     *   arrays
     * - to make sure that that various PostgreSQL clients we support do not
     *   mangle the data in unexpected ways - we take responsibility for
     *   decoding these string values.
     */

    const sqlExpr = pgClassExpression<any, TResource>(
      this,
      attr === ""
        ? this.resource.codec
        : this.resource.codec.attributes![attr as string].codec,
      resourceAttribute?.notNull,
    );
    const colPlan = resourceAttribute
      ? resourceAttribute.expression
        ? sqlExpr`${sql.parens(resourceAttribute.expression(classPlan.alias))}`
        : sqlExpr`${classPlan.alias}.${sql.identifier(String(attr))}`
      : sqlExpr`${classPlan.alias}.v`; /* single attribute */

    if (
      this.nonNullAttribute == null &&
      typeof attr === "string" &&
      attr.length > 0 &&
      resourceAttribute &&
      !resourceAttribute.expression &&
      resourceAttribute.notNull
    ) {
      // We know the row is null iff this attribute is null
      this.nonNullAttribute = { attribute: resourceAttribute, attr };
    }

    return colPlan as any;
  }

  public getMeta(key: string) {
    return this.getClassStep().getMeta(key);
  }

  /**
   * Returns a plan representing the result of an expression.
   */
  public select<TExpressionCodec extends PgCodec>(
    fragment: PgSQLCallbackOrDirect<SQL>,
    codec: TExpressionCodec,
    guaranteedNotNull?: boolean,
  ): PgClassExpressionStep<TExpressionCodec, TResource> {
    const sqlExpr = pgClassExpression<TExpressionCodec, TResource>(
      this,
      codec,
      guaranteedNotNull,
    );
    return sqlExpr`${this.scopedSQL(fragment)}`;
  }

  /**
   * Advanced method; rather than returning a plan it returns an index.
   * Generally useful for PgClassExpressionStep.
   *
   * @internal
   */
  public selectAndReturnIndex(fragment: PgSQLCallbackOrDirect<SQL>): number {
    return this.getClassStep().selectAndReturnIndex(this.scopedSQL(fragment));
  }

  public scopedSQL = makeScopedSQL(this);

  public getPgRoot(): PgQueryRootStep {
    return this.getClassStep();
  }

  /** @deprecated Use .getPgRoot().placeholder() */
  public placeholder($step: PgTypedStep<any>): SQL;
  /** @deprecated Use .getPgRoot().placeholder() */
  public placeholder($step: Step, codec: PgCodec): SQL;
  public placeholder(
    $step: Step | PgTypedStep<any>,
    overrideCodec?: PgCodec,
  ): SQL {
    return overrideCodec
      ? this.getClassStep().placeholder($step, overrideCodec)
      : this.getClassStep().placeholder($step as PgTypedStep<any>);
  }

  public deferredSQL($step: Step<SQL>): SQL {
    return this.getClassStep().deferredSQL($step);
  }

  private existingSingleRelation<
    TRelationName extends keyof GetPgResourceRelations<TResource>,
  >(
    relationIdentifier: TRelationName,
  ): PgSelectSingleStep<
    GetPgResourceRelations<TResource>[TRelationName]["remoteResource"]
  > | null {
    if (this.fromRelation) {
      const { refId, relationName } = this.fromRelation;
      const $fromPlan = this.getRef(refId);
      if ($fromPlan instanceof PgSelectSingleStep) {
        // check to see if we already came via this relationship
        const reciprocal = this.resource.getReciprocal(
          $fromPlan.resource.codec,
          relationName,
        );
        if (reciprocal) {
          const reciprocalRelationName = reciprocal[0];
          if (reciprocalRelationName === relationIdentifier) {
            const reciprocalRelation = reciprocal[1];
            if (reciprocalRelation.isUnique) {
              return $fromPlan as PgSelectSingleStep<any>;
            }
          }
        }
      }
    }
    return null;
  }

  public singleRelation<
    TRelationName extends keyof GetPgResourceRelations<TResource>,
  >(
    relationIdentifier: TRelationName,
  ): PgSelectSingleStep<
    GetPgResourceRelations<TResource>[TRelationName]["remoteResource"]
  > {
    const $existingPlan = this.existingSingleRelation(relationIdentifier);
    if ($existingPlan) {
      return $existingPlan;
    }
    const relation = this.resource.getRelation(
      relationIdentifier,
    ) as PgCodecRelation;
    if (!relation || !relation.isUnique) {
      throw new Error(
        `${String(relationIdentifier)} is not a unique relation on ${
          this.resource
        }`,
      );
    }
    const { remoteResource, remoteAttributes, localAttributes } = relation;

    const options: PgSelectSinglePlanOptions = {
      fromRelation: [
        this as PgSelectSingleStep<any>,
        relationIdentifier as string,
      ],
    };
    return remoteResource.get(
      remoteAttributes.reduce((memo, remoteAttribute, attributeIndex) => {
        memo[remoteAttribute] = this.get(localAttributes[attributeIndex]);
        return memo;
      }, Object.create(null)),
      options,
    ) as PgSelectSingleStep<any>;
  }

  public manyRelation<
    TRelationName extends keyof GetPgResourceRelations<TResource>,
  >(
    relationIdentifier: TRelationName,
  ): PgSelectStep<
    GetPgResourceRelations<TResource>[TRelationName]["remoteResource"]
  > {
    const relation = this.resource.getRelation(
      relationIdentifier,
    ) as PgCodecRelation;
    if (!relation) {
      throw new Error(
        `${String(relationIdentifier)} is not a relation on ${this.resource}`,
      );
    }
    const { remoteResource, remoteAttributes, localAttributes } = relation;

    return (remoteResource as PgResource).find(
      remoteAttributes.reduce((memo, remoteAttribute, attributeIndex) => {
        memo[remoteAttribute] = this.get(localAttributes[attributeIndex]);
        return memo;
      }, Object.create(null)),
    ) as any;
  }

  public record(): PgClassExpressionStep<
    GetPgResourceCodec<TResource>,
    TResource
  > {
    return pgClassExpression<GetPgResourceCodec<TResource>, TResource>(
      this,
      this.resource.codec as GetPgResourceCodec<TResource>,
      undefined,
    )`${this.getClassStep().alias}`;
  }

  public toRecord(): Step {
    return this.record();
  }

  /**
   * When selecting a connection we need to be able to get the cursor. The
   * cursor is built from the values of the `ORDER BY` clause so that we can
   * find nodes before/after it.
   */
  public cursor(): PgCursorStep<this> {
    const cursorPlan = new PgCursorStep<this>(
      this,
      this.getClassStep().getCursorDetails(),
    );
    return cursorPlan;
  }

  /**
   * For compatibility with EdgeCapableStep.
   */
  public node(): this {
    return this;
  }

  deduplicate(
    peers: PgSelectSingleStep<any>[],
  ): PgSelectSingleStep<TResource>[] {
    // We've been careful to not store anything locally so we shouldn't
    // need to move anything across to the peer.
    return peers.filter((peer) => {
      if (peer.resource !== this.resource) {
        return false;
      }
      if (peer.getClassStep() !== this.getClassStep()) {
        return false;
      }
      if (peer.getItemStep() !== this.getItemStep()) {
        return false;
      }
      return true;
    });
  }

  private nonNullAttribute: {
    attribute: PgCodecAttribute;
    attr: string;
  } | null = null;
  private nullCheckAttributeIndex: number | null = null;
  optimize() {
    const attributes = this.resource.codec.attributes;
    if (attributes && this.getClassStep().mode !== "aggregate") {
      // We need to see if this row is null. The cheapest way is to select a
      // non-null column, but failing that we invoke the codec's
      // nonNullExpression (indirectly).
      const getSuitableAttribute = () => {
        // We want to find a _cheap_ not-null attribute to select to prove that
        // the row is not null. Critically this must be an attribute that we can
        // always select (i.e. is not prevented by any column-level select
        // privileges).
        for (const attr of Object.keys(attributes)) {
          const attribute = attributes[attr];
          if (
            attribute.notNull &&
            CHEAP_ATTRIBUTE_TYPES.has(attribute.codec) &&
            !attribute.restrictedAccess
          ) {
            return {
              attribute,
              attr,
            };
          }
        }
        return null;
      };
      const nonNullAttribute = this.nonNullAttribute ?? getSuitableAttribute();
      if (nonNullAttribute != null) {
        const {
          attribute: { codec },
          attr,
        } = nonNullAttribute;
        const expression = sql`${this}.${sql.identifier(attr)}`;
        this.nullCheckAttributeIndex = this.getClassStep().selectAndReturnIndex(
          codec.castFromPg
            ? codec.castFromPg(expression)
            : sql`${sql.parens(expression)}::text`,
        );
      } else {
        this.nullCheckId = this.getClassStep().getNullCheckIndex();
      }
    }
    return this;
  }

  unbatchedExecute(
    _extra: UnbatchedExecutionExtra,
    result: string[] | null,
  ): unknown[] | null {
    if (result == null) {
      return this._coalesceToEmptyObject ? EMPTY_TUPLE : null;
    } else if (this.nullCheckAttributeIndex != null) {
      const nullIfAttributeNull = result[this.nullCheckAttributeIndex];
      if (nullIfAttributeNull == null) {
        return this._coalesceToEmptyObject ? EMPTY_TUPLE : null;
      }
    } else if (this.nullCheckId != null) {
      const nullIfExpressionNotTrue = result[this.nullCheckId];
      if (
        nullIfExpressionNotTrue == null ||
        TYPES.boolean.fromPg(nullIfExpressionNotTrue) != true
      ) {
        return this._coalesceToEmptyObject ? EMPTY_TUPLE : null;
      }
    }
    return result;
  }

  [$$toSQL]() {
    return this.getClassStep().alias;
  }
}

/**
 * Given a plan that represents a single record (via
 * PgSelectSingleStep.record()) this turns it back into a PgSelectSingleStep
 */
export function pgSelectFromRecord<
  TResource extends PgResource<
    any,
    PgCodec<any, any, any, any, any, any, any>,
    any,
    any,
    PgRegistry
  >,
>(
  resource: TResource,
  $record:
    | PgClassExpressionStep<GetPgResourceCodec<TResource>, TResource>
    | Step<{
        [Attr in keyof TResource["codec"]["attributes"]]: Step;
      }>,
): PgSelectStep<TResource> {
  const $select = new PgSelectStep<TResource>({
    resource: resource,
    identifiers: [],
    from: {
      callback: ($select) =>
        sql`(select (${$select.placeholder($record, resource.codec)}).*)`,
    },
    joinAsLateral: true,
  });
  if ($record instanceof PgClassExpressionStep) {
    const $parent = $record.getParentStep();
    if ($parent instanceof PgSelectSingleStep) {
      $select.hints.isPgSelectFromRecordOf = {
        parentId: $parent.getClassStep().id,
        expression: $record.expression,
      };
    }
  }
  return $select;
}

/**
 * Given a plan that represents a single record (via
 * PgSelectSingleStep.record()) this turns it back into a PgSelectSingleStep
 */
export function pgSelectSingleFromRecord<
  TResource extends PgResource<any, any, any, any>,
>(
  resource: TResource,
  $record:
    | PgClassExpressionStep<GetPgResourceCodec<TResource>, TResource>
    | Step,
): PgSelectSingleStep<TResource> {
  // OPTIMIZE: we should be able to optimise this so that `plan.record()` returns the original record again.
  return pgSelectFromRecord(
    resource,
    $record,
  ).single() as PgSelectSingleStep<TResource>;
}

exportAs("@dataplan/pg", pgSelectFromRecord, "pgSelectFromRecord");
exportAs("@dataplan/pg", pgSelectSingleFromRecord, "pgSelectSingleFromRecord");
