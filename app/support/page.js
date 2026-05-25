"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import { FREE_ACCOUNT_LIMITS } from "@/lib/accountLimits";
import "../page.css";

const PAYMENT_PLANS = {
  supporter_lifetime: {
    title: "Supporter",
    price: "R$19,99",
  },
  map_slots_5: {
    title: "Map slots",
    price: "R$4,99",
  },
  custom_icon_slots_10: {
    title: "Custom icon slots",
    price: "R$2,99",
  },
};

export default function SupportPage() {
  const { data: session, status, update } = useSession();
  const hasSupporter = session?.user?.supporter === true;
  const [mapCount, setMapCount] = useState(0);
  const [iconCount, setIconCount] = useState(0);
  const [accountLimits, setAccountLimits] = useState(FREE_ACCOUNT_LIMITS);
  const [paymentModalPlan, setPaymentModalPlan] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadUsage() {
      try {
        const [mapsResponse, assetsResponse, limitsResponse] = await Promise.all([
          fetch("/api/maps"),
          fetch("/api/assets"),
          fetch("/api/account/limits"),
        ]);

        const [mapsData, assetsData, limitsData] = await Promise.all([
          mapsResponse.json(),
          assetsResponse.json(),
          limitsResponse.json(),
        ]);

        if (!active) return;

        if (mapsResponse.ok) {
          setMapCount((mapsData.maps || []).length);
        }

        if (assetsResponse.ok) {
          setIconCount((assetsData.assets || []).length);
        }

        if (limitsResponse.ok && limitsData.limits) {
          setAccountLimits(limitsData.limits);
        }
      } catch (error) {
        console.error("Erro ao carregar limites da conta.", error);
      }
    }

    loadUsage();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paypalStatus = params.get("paypalStatus");
    const paypalOrderId = params.get("token");

    if (paypalStatus === "cancelled") {
      setPaymentStatus("Pagamento cancelado.");
      window.history.replaceState({}, "", "/support");
      return;
    }

    if (paypalStatus !== "return" || !paypalOrderId) return;

    let active = true;

    async function capturePayment() {
      setPaymentLoading(true);
      setPaymentStatus("Confirmando pagamento no PayPal...");

      try {
        const response = await fetch("/api/payments/paypal/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paypalOrderId }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Erro ao confirmar pagamento.");
        }

        if (!active) return;

        setPaymentStatus("Pagamento confirmado com sucesso.");
        await update?.();
        window.history.replaceState({}, "", "/support");
      } catch (error) {
        if (!active) return;
        setPaymentStatus(error.message || "Erro ao confirmar pagamento.");
      } finally {
        if (active) {
          setPaymentLoading(false);
        }
      }
    }

    capturePayment();

    return () => {
      active = false;
    };
  }, [update]);

  function openPaymentModal(planId) {
    if (status !== "authenticated") {
      signIn();
      return;
    }

    setPaymentStatus("");
    setPaymentModalPlan(planId);
  }

  async function startPayPalPayment() {
    if (!paymentModalPlan) return;

    setPaymentLoading(true);
    setPaymentStatus("Criando pedido no PayPal...");

    try {
      const response = await fetch("/api/payments/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: paymentModalPlan }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar pedido.");
      }

      window.location.href = data.approvalUrl;
    } catch (error) {
      setPaymentStatus(error.message || "Erro ao abrir PayPal.");
      setPaymentLoading(false);
    }
  }

  return (
    <main className="dashboardPage siteMain">
      <SiteHeader />

      <section className="dashboardCard sitePageCard supportPageCard">
        <div className="supportHeader">
          <h1>Support</h1>
          <p>
            Upgrade your interactive map workspace with lifetime supporter
            benefits or extra creation slots.
          </p>
        </div>

        <article
          className={
            hasSupporter
              ? "supportPurchaseCard supporterCard purchased"
              : "supportPurchaseCard supporterCard"
          }
        >
          <div className="supporterCardContent">
            <div>
              <span className="supportBadge">One-time lifetime purchase</span>
              <h2>Supporter</h2>
              <p>
                A permanent supporter status for creators who want more room,
                more customization and a highlighted presence in the library.
              </p>
            </div>

            <ul>
              <li>Custom color options for your profile/map presence.</li>
              <li>Add more than one collaborator to your maps.</li>
              <li>Higher maximum map and custom icon limits.</li>
              <li>Highlighted map card and username styling in Library.</li>
              <li>Future supporter-only quality of life perks.</li>
            </ul>
          </div>

          <div className="supportPurchaseAside">
            <strong>R$19,99</strong>
            <span>Lifetime</span>
            <button
              disabled={hasSupporter}
              onClick={() => openPaymentModal("supporter_lifetime")}
            >
              {hasSupporter ? "Purchased" : "Buy Supporter"}
            </button>
          </div>
        </article>

        <div className="supportPlanGrid">
          <article className="supportPurchaseCard supportSlotCard">
            <div>
              <span className="supportBadge">Map capacity</span>
              <div className="supportCardTitleRow">
                <h2>Map slots</h2>
                <span
                  className={
                    mapCount >= accountLimits.maps
                      ? "quotaBadge quotaBadgeLimitReached"
                      : "quotaBadge"
                  }
                >
                  Mapas: {mapCount}/{accountLimits.maps}
                </span>
              </div>
              <p>Increase the maximum number of maps your account can create.</p>
            </div>

            <ul>
              <li>Permanent extra map slots.</li>
              <li>Useful for multiple games, regions or projects.</li>
              <li>Stacks with future account upgrades.</li>
            </ul>

            <div className="supportCardFooter">
              <strong>R$4,99</strong>
              <span>+5 map slots</span>
              <button onClick={() => openPaymentModal("map_slots_5")}>
                Buy slots
              </button>
            </div>
          </article>

          <article className="supportPurchaseCard supportSlotCard">
            <div>
              <span className="supportBadge">Icon capacity</span>
              <div className="supportCardTitleRow">
                <h2>Custom icon slots</h2>
                <span
                  className={
                    iconCount >= accountLimits.customIcons
                      ? "quotaBadge quotaBadgeLimitReached"
                      : "quotaBadge"
                  }
                >
                  Ícones: {iconCount}/{accountLimits.customIcons}
                </span>
              </div>
              <p>
                Increase how many custom pin icons you can upload and reuse.
              </p>
            </div>

            <ul>
              <li>Permanent extra custom icon slots.</li>
              <li>Better for large games with many marker types.</li>
              <li>Works across groups where icons are linked.</li>
            </ul>

            <div className="supportCardFooter">
              <strong>R$2,99</strong>
              <span>+10 icon slots</span>
              <button onClick={() => openPaymentModal("custom_icon_slots_10")}>
                Buy slots
              </button>
            </div>
          </article>
        </div>

        {paymentStatus && (
          <p className="supportPaymentStatus">{paymentStatus}</p>
        )}
      </section>

      {paymentModalPlan && (
        <div
          className="modalOverlay supporterFeatureOverlay"
          onMouseDown={() => {
            if (!paymentLoading) setPaymentModalPlan(null);
          }}
        >
          <div
            className="modal supporterFeatureModal supportPaymentModal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modalCloseButton"
              onClick={() => setPaymentModalPlan(null)}
              disabled={paymentLoading}
              aria-label="Fechar"
            >
              ×
            </button>
            <h2>Payment method</h2>
            <p>
              Select how you want to pay for{" "}
              <strong>{PAYMENT_PLANS[paymentModalPlan]?.title}</strong>.
            </p>

            <button
              className="paypalPaymentButton"
              onClick={startPayPalPayment}
              disabled={paymentLoading}
            >
              {paymentLoading ? "Opening PayPal..." : "Pay with PayPal"}
            </button>

            {paymentStatus && (
              <p className="supportPaymentStatus">{paymentStatus}</p>
            )}
          </div>
        </div>
      )}

      <SiteFooter />
    </main>
  );
}
