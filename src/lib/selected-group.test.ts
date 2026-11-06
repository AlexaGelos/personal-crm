import { describe, expect, it } from "vitest";

import { deleteGroup } from "@/lib/groups";
import { selectedGroup } from "@/lib/selected-group";
import { addGroup, addUser, TEST_USER_ID } from "@/test/helpers";

describe("selectedGroup", () => {
  it("finds the group named in the address", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");

    const group = await selectedGroup(TEST_USER_ID, Promise.resolve({ group: String(tennis.id) }));

    expect(group).toMatchObject({ id: tennis.id, name: "Теннис" });
  });

  it("gives nothing when the group is not in the address", async () => {
    expect(await selectedGroup(TEST_USER_ID, Promise.resolve({}))).toBeNull();
  });

  it("gives nothing for a group that was deleted", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    await deleteGroup(TEST_USER_ID, tennis.id);

    expect(
      await selectedGroup(TEST_USER_ID, Promise.resolve({ group: String(tennis.id) })),
    ).toBeNull();
  });

  it("gives nothing for a malformed value", async () => {
    expect(await selectedGroup(TEST_USER_ID, Promise.resolve({ group: "abc" }))).toBeNull();
  });

  it("gives nothing for a group of another user", async () => {
    const other = await addUser("other@example.com");
    const theirs = await addGroup(other.id, "Теннис");

    expect(
      await selectedGroup(TEST_USER_ID, Promise.resolve({ group: String(theirs.id) })),
    ).toBeNull();
  });
});
