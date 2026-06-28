import { describe, expect, it, vi } from "vitest";
import { CommunityProfileService } from "../community/CommunityProfileService";

function createWindow(fetchImpl: Window["fetch"]) {
  return {
    fetch: fetchImpl,
    setTimeout(callback: () => void) {
      queueMicrotask(callback);
      return 1;
    }
  } as unknown as Window;
}

describe("CommunityProfileService", () => {
  it("queues and normalizes Vortex user profiles", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const id = Number(String(url).split("/").pop());
      return new Response(JSON.stringify({
        id,
        username: `User${id}`,
        bio: "hello",
        created_at: "2026-06-01T12:00:00Z",
        followers_count: 12,
        following_count: 3,
        is_moderator: id === 2
      }), { status: 200 });
    });
    const service = new CommunityProfileService(createWindow(fetchImpl as unknown as Window["fetch"]));
    const seen: number[] = [];
    service.onVortexUserProfile((profile) => seen.push(profile.id));

    const first = await service.requestVortexUser(1);
    const second = await service.requestVortexUser(2);

    expect(first).toMatchObject({ id: 1, username: "User1", bio: "hello", followers: 12, following: 3 });
    expect(second).toMatchObject({ id: 2, isModerator: true });
    expect(seen).toEqual([1, 2]);
    expect(service.snapshot()).toMatchObject({ cachedVortexUsers: 2, queuedVortexUsers: 0 });
  });

  it("retries transient Vortex user profile failures", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 522 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 9, username: "Recovered" }), { status: 200 }));
    const service = new CommunityProfileService(createWindow(fetchImpl as unknown as Window["fetch"]));

    await expect(service.requestVortexUser(9)).resolves.toMatchObject({ id: 9, username: "Recovered" });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("negative-caches missing Vortex user profiles so joins/chat do not spam 404s", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    const service = new CommunityProfileService(createWindow(fetchImpl as unknown as Window["fetch"]));

    await expect(service.requestVortexUser(22055)).resolves.toBeNull();
    await expect(service.requestVortexUser(22055)).resolves.toBeNull();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(service.snapshot()).toMatchObject({ cachedMissingVortexUsers: 1, queuedVortexUsers: 0 });
  });

  it("backs off immediately on Vortex user profile rate limits", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 429 }));
    const service = new CommunityProfileService(createWindow(fetchImpl as unknown as Window["fetch"]));

    await expect(service.requestVortexUser(13001)).resolves.toBeNull();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(service.snapshot()).toMatchObject({ queuedVortexUsers: 0 });
  });
});
