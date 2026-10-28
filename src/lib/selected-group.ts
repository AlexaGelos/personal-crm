import "server-only";

import { cache } from "react";

import { findGroup } from "@/lib/groups";
import { parseGroupId } from "@/lib/validation";

// The group chosen in the address of the home page (?group=), or null for "Все": the address
// has none, the value is malformed, or the group was deleted. The group row, the block and the
// list of the home page all need it; "cache" makes the three share one query per request
export const selectedGroup = cache(
  async (searchParams: Promise<{ [key: string]: string | string[] | undefined }>) => {
    const id = parseGroupId((await searchParams).group);
    if (id === null) return null;

    return (await findGroup(id)) ?? null;
  },
);
