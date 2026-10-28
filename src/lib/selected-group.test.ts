import { describe, expect, it } from "vitest";

import { deleteGroup } from "@/lib/groups";
import { selectedGroup } from "@/lib/selected-group";
import { addGroup } from "@/test/helpers";

describe("selectedGroup", () => {
  it("finds the group named in the address", async () => {
    const tennis = await addGroup("Теннис");

    const group = await selectedGroup(Promise.resolve({ group: String(tennis.id) }));

    expect(group).toMatchObject({ id: tennis.id, name: "Теннис" });
  });

  it("gives nothing when the group is not in the address", async () => {
    expect(await selectedGroup(Promise.resolve({}))).toBeNull();
  });

  it("gives nothing for a group that was deleted", async () => {
    const tennis = await addGroup("Теннис");
    await deleteGroup(tennis.id);

    expect(await selectedGroup(Promise.resolve({ group: String(tennis.id) }))).toBeNull();
  });

  it("gives nothing for a malformed value", async () => {
    expect(await selectedGroup(Promise.resolve({ group: "abc" }))).toBeNull();
  });
});
