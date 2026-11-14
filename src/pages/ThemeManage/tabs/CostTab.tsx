import { useMemo } from "react";
import { CircleDollarSign } from "lucide-react";
import { InstancePanel } from "@/components/instance/InstancePanel";
import { COST_RATE_PRESETS } from "@/utils/cost";
import { DEFAULT_THEME_SETTINGS } from "@/utils/themeSettings";
import { PremiumList } from "../components/PremiumList";
import type { NodeInfo } from "@/types/cfsm";
import type { ThemeDraft } from "../types";
import type { calculateCostSummary } from "@/utils/cost";

type PremiumDetail = ReturnType<typeof calculateCostSummary>["details"][number];

export function CostTab({
  draft,
  patch,
  draftCostRateApiUrlInvalid,
  premiumSearch,
  setPremiumSearch,
  filteredPremiumClients,
  premiumDetailByUuid,
  rateLoading,
  acquiredAtMax,
  patchPremiumPaid,
  patchPremiumAcquiredAt,
}: {
  draft: ThemeDraft;
  patch: <K extends keyof ThemeDraft>(key: K, value: ThemeDraft[K]) => void;
  draftCostRateApiUrlInvalid: boolean;
  premiumSearch: string;
  setPremiumSearch: (val: string) => void;
  filteredPremiumClients: NodeInfo[];
  premiumDetailByUuid: Map<string, PremiumDetail>;
  rateLoading: boolean;
  acquiredAtMax: string;
  patchPremiumPaid: (uuid: string, val: string) => void;
  patchPremiumAcquiredAt: (uuid: string, val: string) => void;
}) {
  const premiumConfiguredCount = useMemo(
    () => Object.keys(draft.costPremiums).length,
    [draft.costPremiums],
  );

  return (
    <>
      <InstancePanel
        id="set-cost"
        kicker="资产"
        title="财务设置"
        description="管理外币自动换算汇率，并可排除免流或不计费机器。"
        aside={<CircleDollarSign size={16} />}
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="surface-inset flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="setting-subhead-title">汇率接口</span>
                <span className="setting-hint">留空使用默认</span>
              </div>

              <div className="cost-rate-presets">
                {COST_RATE_PRESETS.map((preset) => {
                  const isDefault = preset.id === "frankfurter";
                  const active =
                    (draft.costRateApiUrl.trim() === "" && isDefault) ||
                    draft.costRateApiUrl.trim() === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      data-active={active ? "true" : "false"}
                      aria-pressed={active}
                      onClick={() => {
                        patch("costRateApiUrl", isDefault ? "" : preset.url);
                      }}
                    >
                      <span>{preset.name}</span>
                    </button>
                  );
                })}
              </div>

              <input
                value={draft.costRateApiUrl}
                onChange={(event) => patch("costRateApiUrl", event.target.value)}
                placeholder={DEFAULT_THEME_SETTINGS.costRateApiUrl}
                aria-invalid={draftCostRateApiUrlInvalid}
                className="surface-inset w-full px-3 py-2 text-[13px] outline-none"
              />
              <span className="setting-hint text-pretty">
                {draftCostRateApiUrlInvalid
                  ? "请输入 http(s) 链接，保存后将回退默认接口"
                  : "点击上方预设一键切换，亦可直接输入自定义链接。"}
              </span>
            </div>

            <div className="surface-inset flex flex-col gap-2 px-4 py-3">
              <span className="setting-subhead-title">排除机器</span>
              <textarea
                rows={3}
                value={draft.costIgnoredText}
                onChange={(event) => patch("costIgnoredText", event.target.value)}
                placeholder="测试机&#10;node-uuid"
                className="surface-inset min-h-24 w-full resize-y p-2.5 text-[13px] outline-none font-mono"
              />
              <span className="setting-hint">填入的机器不计入资产总值与续费成本。</span>
            </div>
          </div>
        </div>
      </InstancePanel>

      <InstancePanel
        id="set-premiums"
        kicker="溢价"
        title="买入溢价"
        description="记录二手收机或溢价花费，系统自动平摊计算实际成本。"
        aside={<CircleDollarSign size={16} />}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <input
              value={premiumSearch}
              onChange={(event) => setPremiumSearch(event.target.value)}
              placeholder="搜索服务器…"
              className="surface-inset px-3 py-1.5 text-[13px] outline-none max-w-xs"
            />
            <span className="setting-hint">已记录 {premiumConfiguredCount} 台溢价</span>
          </div>

          <PremiumList
            clients={filteredPremiumClients}
            costPremiums={draft.costPremiums}
            detailByUuid={premiumDetailByUuid}
            rateLoading={rateLoading}
            acquiredAtMax={acquiredAtMax}
            onPatchPaid={patchPremiumPaid}
            onPatchAcquiredAt={patchPremiumAcquiredAt}
          />
        </div>
      </InstancePanel>
    </>
  );
}

