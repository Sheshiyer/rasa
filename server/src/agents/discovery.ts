import type {
  CandidateDish,
  PreferenceProfile,
  SourceAdapter,
} from "@rasa/shared";

export interface DiscoveryAgentDeps {
  adapter: SourceAdapter;
}

/**
 * Discovery / Supply Agent. Thin profile-level orchestration over the SourceAdapter
 * (the v2 moat boundary): resolves the delivery address, runs the adapter's hard
 * filters (deliverability + diet + allergens + dedupe), then applies the soft
 * `dislikes` filter. All source access goes through the adapter — never Swiggy directly.
 */
export function createDiscoveryAgent(deps: DiscoveryAgentDeps) {
  async function resolveAddressId(profile: PreferenceProfile): Promise<string> {
    if (profile.delivery_address_id) return profile.delivery_address_id;
    const addresses = await deps.adapter.listDeliveryAddresses();
    const first = addresses[0];
    if (!first) throw new Error("no delivery address on file for this user");
    return first.id;
  }

  function dropDislikes(
    dishes: CandidateDish[],
    dislikes: string[],
  ): CandidateDish[] {
    if (dislikes.length === 0) return dishes;
    const lower = dislikes.map((d) => d.toLowerCase());
    return dishes.filter((d) => {
      const hay = `${d.dish_name} ${d.description ?? ""}`.toLowerCase();
      return !lower.some((x) => hay.includes(x));
    });
  }

  async function discoverSlot(
    profile: PreferenceProfile,
    slot: string,
  ): Promise<CandidateDish[]> {
    const addressId = await resolveAddressId(profile);
    const candidates = await deps.adapter.discover({
      profile,
      addressId,
      slot,
    });
    return dropDislikes(candidates, profile.dislikes);
  }

  async function discoverForProfile(
    profile: PreferenceProfile,
  ): Promise<Record<string, CandidateDish[]>> {
    const bySlot: Record<string, CandidateDish[]> = {};
    for (const s of profile.slots)
      bySlot[s.name] = await discoverSlot(profile, s.name);
    return bySlot;
  }

  return { discoverSlot, discoverForProfile };
}
