import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useI18n } from "../../i18n/I18nContext";
import {
  fetchMarketplace,
  reportMarketplaceMember,
  type MarketplaceFilters,
  type MarketplaceMember,
  type MarketplacePublication,
  type MarketplaceReportReason,
} from "../../services/marketplaceService";
import { useCraft } from "../../store/CraftContext";
import type { Blueprint } from "../../types";
import type { CraftRequestDraft } from "../organizations";

export type MarketplaceTab = "browse" | "listings" | "safety" | "moderation";
export type OfferType = "blueprints" | "resources" | "contributors";

function readRoute() {
  const params = new URLSearchParams(window.location.search);
  const tabValue = params.get("tab");
  return {
    tab: (["browse", "listings", "safety", "moderation"].includes(
      tabValue ?? "",
    )
      ? tabValue
      : "browse") as MarketplaceTab,
    type: (params.get("type") === "contributors"
      ? "contributors"
      : params.get("type") === "resources" ||
          (!params.has("type") && params.has("resource"))
        ? "resources"
        : "blueprints") as OfferType,
    assetId: (params.get("blueprint") ?? params.get("resource") ?? "").slice(
      0,
      200,
    ),
    ownerHandle: (params.get("owner") ?? "").slice(0, 60),
  };
}

export function useMarketplaceController() {
  const auth = useAuth();
  const { activeDataset, setActiveBlueprint } = useCraft();
  const { t } = useI18n();
  const scope = activeDataset.channel;
  const [route, setRoute] = useState(readRoute);
  const [members, setMembers] = useState<MarketplaceMember[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<{
    blueprint: Blueprint;
    member: MarketplaceMember;
  } | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [reportHandle, setReportHandle] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const identity = `${auth.account?.accountId ?? ""}:${scope}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const requestId = useRef(0);
  const actionInFlight = useRef(false);
  const verified = Boolean(
    auth.account?.rsi?.handle &&
      auth.account.rsi.verifiedAt &&
      !auth.account.rsi.verificationRequired,
  );
  const canBrowse = Boolean(
    verified && auth.account && (auth.account.datasetScope ?? "live") === scope,
  );
  const blueprintById = useMemo(
    () => new Map(activeDataset.blueprints.map((item) => [item.id, item])),
    [activeDataset.blueprints],
  );
  const resourceById = useMemo(
    () => new Map(activeDataset.resources.map((item) => [item.id, item])),
    [activeDataset.resources],
  );

  useEffect(() => {
    const onPop = () => {
      if (window.location.pathname === "/marketplace") setRoute(readRoute());
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      requestId.current += 1;
      identityRef.current = "";
    };
  }, []);

  const navigate = useCallback(
    (next: Partial<typeof route>) => {
      const value = { ...route, ...next };
      const params = new URLSearchParams();
      if (value.tab !== "browse") params.set("tab", value.tab);
      params.set("type", value.type);
      if (value.assetId)
        params.set(
          value.type === "blueprints" ? "blueprint" : "resource",
          value.assetId,
        );
      if (value.ownerHandle) params.set("owner", value.ownerHandle);
      window.history.pushState(
        window.history.state,
        "",
        `/marketplace?${params}`,
      );
      setRoute(value);
    },
    [route],
  );

  const filters = useMemo<MarketplaceFilters>(
    () => ({
      limit: 20,
      ownerHandle: route.ownerHandle || undefined,
      ...(route.assetId
        ? route.type === "blueprints"
          ? { blueprintId: route.assetId }
          : { resourceId: route.assetId }
        : {}),
    }),
    [route.ownerHandle, route.assetId, route.type],
  );

  const load = useCallback(
    async (nextCursor?: string) => {
      const id = ++requestId.current;
      if (!canBrowse) {
        setMembers([]);
        setCursor(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);
      if (!nextCursor) {
        setMembers([]);
        setCursor(null);
      }
      try {
        const result = await fetchMarketplace(scope, {
          ...filters,
          cursor: nextCursor,
        });
        if (id !== requestId.current) return;
        if (result.datasetScope !== scope)
          throw new Error(
            "The marketplace returned a different dataset scope.",
          );
        setMembers((current) =>
          nextCursor
            ? [
                ...current,
                ...result.members.filter(
                  (member) =>
                    !current.some(
                      (existing) =>
                        existing.handle.toLowerCase() ===
                        member.handle.toLowerCase(),
                    ),
                ),
              ]
            : result.members,
        );
        setCursor(result.nextCursor);
      } catch (error) {
        if (id === requestId.current)
          setLoadError(
            error instanceof Error
              ? error.message
              : t(
                  "Unable to load the marketplace.",
                  "Impossible de charger la marketplace.",
                  "Marktplatz konnte nicht geladen werden.",
                ),
          );
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [canBrowse, scope, filters, t],
  );

  useEffect(() => {
    void load();
    return () => {
      requestId.current += 1;
    };
  }, [load, identity]);
  useEffect(() => {
    setRequest(null);
    setRequestError(null);
    setReportHandle(null);
    setReportError(null);
    setActionError(null);
    setNotice(null);
    setBusy(false);
    actionInFlight.current = false;
  }, [identity]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    if (actionInFlight.current) return false;
    const key = identity;
    actionInFlight.current = true;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await action();
      if (identityRef.current !== key) return false;
      setNotice(success);
      return true;
    } catch (error) {
      if (identityRef.current === key)
        setActionError(
          error instanceof Error
            ? error.message
            : t(
                "The action failed. Try again.",
                "L’action a échoué. Réessaie.",
                "Aktion fehlgeschlagen. Versuche es erneut.",
              ),
        );
      return false;
    } finally {
      if (identityRef.current === key) {
        actionInFlight.current = false;
        setBusy(false);
      }
    }
  };

  const save = async (publication: MarketplacePublication) => {
    const ok = await run(
      () => auth.updateMarketplace(publication),
      publication.enabled
        ? t(
            "Your selection is now published.",
            "Ta sélection est maintenant publiée.",
            "Deine Auswahl ist jetzt veröffentlicht.",
          )
        : t(
            "Your listings are private.",
            "Tes annonces sont privées.",
            "Deine Angebote sind privat.",
          ),
    );
    if (ok) void load();
    return ok;
  };
  const block = async (handle: string, blocked: boolean) => {
    const ok = await run(
      () => auth.blockMarketplaceMember(handle, blocked),
      blocked
        ? t("Player blocked.", "Joueur bloqué.", "Spieler blockiert.")
        : t("Player unblocked.", "Joueur débloqué.", "Spieler entsperrt."),
    );
    if (ok) {
      setMembers((current) =>
        current.filter(
          (member) => member.handle.toLowerCase() !== handle.toLowerCase(),
        ),
      );
      void load();
    }
    return ok;
  };
  const sendRequest = async (draft: CraftRequestDraft) => {
    if (!request) return;
    setRequestError(null);
    const key = identity;
    let failure: string | null = null;
    const ok = await run(
      async () => {
        try {
          await auth.requestMarketplaceCraft({
            blueprintId: request.blueprint.id,
            blueprintName: request.blueprint.name,
            ownerHandle: request.member.handle,
            ...draft,
          });
        } catch (error) {
          failure =
            error instanceof Error
              ? error.message
              : t(
                  "Request failed.",
                  "La demande a échoué.",
                  "Anfrage fehlgeschlagen.",
                );
          throw error;
        }
      },
      t(
        "Craft request sent. Follow it in Account → Craft requests.",
        "Demande envoyée. Retrouve son suivi dans Account → Demandes de craft.",
        "Craft-Anfrage gesendet. Verfolge sie unter Konto → Craft-Anfragen.",
      ),
    );
    if (identityRef.current === key) {
      if (ok) setRequest(null);
      else setRequestError(failure);
    }
  };
  const sendReport = async (reason: MarketplaceReportReason) => {
    if (!reportHandle) return;
    setReportError(null);
    const key = identity;
    let failure: string | null = null;
    const ok = await run(
      async () => {
        try {
          await reportMarketplaceMember(scope, reportHandle, reason);
        } catch (error) {
          failure =
            error instanceof Error
              ? error.message
              : t(
                  "Report failed.",
                  "Le signalement a échoué.",
                  "Meldung fehlgeschlagen.",
                );
          throw error;
        }
      },
      t(
        "Report sent to app moderators.",
        "Signalement transmis aux modérateurs de l’app.",
        "Meldung an die App-Moderatoren gesendet.",
      ),
    );
    if (identityRef.current === key) {
      if (ok) setReportHandle(null);
      else setReportError(failure);
    }
  };

  return {
    auth,
    activeDataset,
    scope,
    identity,
    verified,
    canBrowse,
    route,
    navigate,
    members,
    cursor,
    loading,
    loadError,
    actionError,
    notice,
    busy,
    load,
    save,
    block,
    blueprintById,
    resourceById,
    setActiveBlueprint,
    request,
    setRequest,
    requestError,
    setRequestError,
    sendRequest,
    reportHandle,
    setReportHandle,
    reportError,
    setReportError,
    sendReport,
  };
}

export type MarketplaceController = ReturnType<typeof useMarketplaceController>;
