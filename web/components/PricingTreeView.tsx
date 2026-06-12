import type { PricingTree } from "@/lib/types";
import { billingLabel } from "@/lib/format";

const TIER_ACCENTS = ["bg-sky", "bg-lime", "bg-marigold", "bg-bubble", "bg-grape", "bg-coral"];

export default function PricingTreeView({ tree }: { tree: PricingTree }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-paper-2 text-sm">💳 {billingLabel(tree.billingModel)}</span>
        {tree.currency && <span className="chip bg-paper-2 text-sm">💱 {tree.currency}</span>}
        <span className="chip bg-paper-2 text-sm">🪜 {tree.tiers.length} tiers</span>
        {tree.addOns.length > 0 && (
          <span className="chip bg-paper-2 text-sm">🧩 {tree.addOns.length} add-ons</span>
        )}
      </div>

      {tree.tiers.length > 0 && (
        <section>
          <h3 className="font-display font-extrabold text-2xl mb-4">The tiers 🪜</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tree.tiers.map((tier, i) => (
              <div
                key={`${tier.name}-${i}`}
                className={`card p-5 flex flex-col gap-3 ${
                  tier.highlighted ? "card-lg ring-0" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={`inline-block ink-border rounded-lg px-2 py-0.5 font-display font-extrabold ${
                      TIER_ACCENTS[i % TIER_ACCENTS.length]
                    }`}
                  >
                    {tier.name}
                  </div>
                  {tier.highlighted && <span className="text-xl animate-wobble">⭐</span>}
                </div>
                <div>
                  <div className="font-display font-extrabold text-2xl">{tier.price}</div>
                  {tier.period && (
                    <div className="text-sm text-ink-soft font-medium">{tier.period}</div>
                  )}
                </div>

                {tier.limits.length > 0 && (
                  <ul className="flex flex-col gap-1 text-sm">
                    {tier.limits.slice(0, 6).map((limit, j) => (
                      <li key={j} className="flex justify-between gap-2 border-b border-dashed border-ink/20 pb-1">
                        <span className="text-ink-soft">{limit.label}</span>
                        <span className="font-semibold text-right">{limit.value}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {tier.features.length > 0 && (
                  <ul className="flex flex-col gap-1 text-sm mt-1">
                    {tier.features.slice(0, 7).map((feat, j) => (
                      <li key={j} className="flex gap-1.5">
                        <span className="text-lime">✦</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {tree.addOns.length > 0 && (
        <section>
          <h3 className="font-display font-extrabold text-2xl mb-4">Add-ons & extras 🧩</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {tree.addOns.map((addon, i) => (
              <div key={i} className="card p-4 flex items-start gap-3">
                <span className="text-xl">📦</span>
                <div>
                  <div className="font-display font-bold">
                    {addon.name}
                    {addon.price && <span className="text-coral"> · {addon.price}</span>}
                  </div>
                  {addon.description && (
                    <div className="text-sm text-ink-soft">{addon.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tree.hiddenCostSignals.length > 0 && (
        <section>
          <h3 className="font-display font-extrabold text-2xl mb-4">Watch out for 🕵️</h3>
          <ul className="flex flex-col gap-2">
            {tree.hiddenCostSignals.map((signal, i) => (
              <li
                key={i}
                className="card p-3 bg-coral/10 flex items-start gap-2 font-medium text-[0.95rem]"
              >
                <span className="text-lg">⚠️</span>
                {signal}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
