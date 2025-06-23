import "graphile-config";
import "graphile-build-pg";

import type { PgResource } from "@dataplan/pg";

declare global {
  namespace GraphileConfig {
    interface Plugins {
      PgV4BehaviorPlugin: true;
    }

    interface GatherHelpers {
      pgV4SmartTags: Record<string, never>;
    }
  }
}

const v4ComputedAttributeChecks = (s: PgResource): boolean => {
  const firstArg = s.parameters![0];

  // Has to be in same schema
  if (
    firstArg.codec.extensions?.pg?.schemaName !== s.extensions?.pg?.schemaName
  ) {
    return false;
  }

  // Has to start with the name prefix
  if (
    !s.extensions?.pg?.name?.startsWith(
      firstArg.codec.extensions?.pg?.name + "_",
    )
  ) {
    return false;
  }

  return true;
};

export const PgV4BehaviorPlugin: GraphileConfig.Plugin = {
  name: "PgV4BehaviorPlugin",
  description:
    "For compatibility with PostGraphile v4 schemas, this plugin updates the default behaviors of certain things.",
  version: "0.0.0",

  schema: {
    entityBehavior: {
      pgResource: {
        inferred(behavior, resource) {
          if (!resource.parameters) {
            return behavior;
          }
          const newBehavior = [behavior];
          const s = resource;
          // Apply default behavior
          const firstParameter = s.parameters[0];
          if (s.isMutation && s.parameters) {
            newBehavior.push("-queryField", "mutationField", "-typeField");
          } else if (
            s.parameters &&
            s.parameters?.[0]?.codec?.attributes &&
            !s.isMutation &&
            v4ComputedAttributeChecks(s)
          ) {
            newBehavior.push("-queryField", "-mutationField", "typeField");
          } else if (
            !s.isMutation &&
            s.parameters &&
            // Don't default to this being a queryField if it looks like a computed attribute function
            (!firstParameter?.codec?.attributes ||
              firstParameter?.codec?.extensions?.isTableLike === false)
          ) {
            newBehavior.push("queryField", "-mutationField", "-typeField");
          } else {
            newBehavior.push("-queryField", "-mutationField", "-typeField");
          }

          return newBehavior;
        },
      },
      pgCodecAttribute: {
        inferred: {
          provides: ["default"],
          before: ["inferred", "override"],
          after: ["PgAttributesPlugin"],
          callback(behavior, [codec, _attributeName]) {
            if (codec.isSimple === false) {
              // Restore orderBy/filterBy non-simple attributes
              return [behavior, "attribute:orderBy", "attribute:filterBy"];
            }
            return behavior;
          },
        },
      },
    },
  },
};
