"use client";

import { useEffect, useRef, useState } from "react";
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
const PROCESSED_PAYPAL_ORDERS_KEY = "processedPayPalOrders";
const PAYPAL_STATUS_CHECK_INTERVAL = 2500;
const PAYPAL_STATUS_FETCH_TIMEOUT = 10000;

function getProcessedPayPalOrders() {
  try {
    return JSON.parse(
      sessionStorage.getItem(PROCESSED_PAYPAL_ORDERS_KEY) || "[]"
    );
  } catch {
    return [];
  }
}

function markPayPalOrderProcessed(paypalOrderId) {
  const orders = getProcessedPayPalOrders();

  if (!orders.includes(paypalOrderId)) {
    sessionStorage.setItem(
      PROCESSED_PAYPAL_ORDERS_KEY,
      JSON.stringify([...orders, paypalOrderId].slice(-20))
    );
  }
}

async function fetchJsonWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PAYPAL_STATUS_FETCH_TIMEOUT
  );

  try {
    const response = await fetch(url, {
      ...options,
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json();

    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

export default function SupportPage() {
  const { data: session, status, update } = useSession();
  const hasSupporter = session?.user?.supporter === true;
  const [mapCount, setMapCount] = useState(0);
  const [iconCount, setIconCount] = useState(0);
  const [accountLimits, setAccountLimits] = useState(FREE_ACCOUNT_LIMITS);
  const [paymentModalPlan, setPaymentModalPlan] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentResultModal, setPaymentResultModal] = useState(null);
  const [pendingPayPalOrderId, setPendingPayPalOrderId] = useState("");
  const paymentStatusCheckRef = useRef(false);

  async function refreshUsageAndSession() {
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

      if (mapsResponse.ok) {
        setMapCount((mapsData.maps || []).length);
      }

      if (assetsResponse.ok) {
        setIconCount((assetsData.assets || []).length);
      }

      if (limitsResponse.ok && limitsData.limits) {
        setAccountLimits(limitsData.limits);
      }

      await update?.();
    } catch (error) {
      console.error("Erro ao atualizar dados da compra.", error);
    }
  }

  async function waitForPaymentConfirmationLegacy(paypalOrderId) {
    const maxAttempts = 24;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const response = await fetch(
        `/api/payments?paypalOrderId=${encodeURIComponent(paypalOrderId)}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (response.ok && data.payment?.status === "paid") {
        setPaymentStatus("Pagamento confirmado com sucesso.");
        setPaymentResultModal({
          status: "success",
          title: "Pagamento concluído",
          message:
            "Seu pagamento foi confirmado e o benefício foi aplicado à sua conta.",
        });
        await refreshUsageAndSession();
        return true;
      }

      if (response.ok && ["denied", "failed", "refunded"].includes(data.payment?.status)) {
        const message = "O PayPal não confirmou este pagamento.";
        setPaymentStatus(message);
        setPaymentResultModal({
          status: "error",
          title: "Falha no pagamento",
          message,
        });
        return true;
      }
    }

    setPaymentStatus(
      "Pagamento em processamento. Atualize a página em alguns instantes para conferir o status."
    );
    setPaymentResultModal({
      status: "processing",
      title: "Pagamento em processamento",
      message:
        "O PayPal ainda está confirmando a compra. Você pode fechar esta janela e conferir o histórico em alguns instantes.",
    });
    return false;
  }

  async function checkPaymentConfirmation(paypalOrderId) {
    if (!paypalOrderId || paymentStatusCheckRef.current) return false;

    paymentStatusCheckRef.current = true;

    try {
      const { response, data } = await fetchJsonWithTimeout(
        `/api/payments?paypalOrderId=${encodeURIComponent(
          paypalOrderId
        )}&t=${Date.now()}`
      );

      if (response.ok && data.payment?.status === "paid") {
        setPaymentStatus("Pagamento confirmado com sucesso.");
        setPaymentResultModal({
          status: "success",
          title: "Pagamento concluÃ­do",
          message:
            "Seu pagamento foi confirmado e o benefÃ­cio foi aplicado Ã  sua conta.",
        });
        setPendingPayPalOrderId("");
        await refreshUsageAndSession();
        return true;
      }

      if (
        response.ok &&
        ["denied", "failed", "refunded"].includes(data.payment?.status)
      ) {
        const message = "O PayPal nÃ£o confirmou este pagamento.";
        setPaymentStatus(message);
        setPaymentResultModal({
          status: "error",
          title: "Falha no pagamento",
          message,
        });
        setPendingPayPalOrderId("");
        return true;
      }
    } catch (error) {
      console.error("Erro ao consultar status do pagamento.", error);
    } finally {
      paymentStatusCheckRef.current = false;
    }

    return false;
  }

  async function waitForPaymentConfirmation(paypalOrderId) {
    const maxAttempts = 40;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, PAYPAL_STATUS_CHECK_INTERVAL)
      );

      const finished = await checkPaymentConfirmation(paypalOrderId);

      if (finished) return true;
    }

    setPaymentStatus(
      "Pagamento em processamento. Atualize a pÃ¡gina em alguns instantes para conferir o status."
    );
    setPaymentResultModal({
      status: "processing",
      title: "Pagamento em processamento",
      message:
        "O PayPal ainda estÃ¡ confirmando a compra. VocÃª pode fechar esta janela e conferir o histÃ³rico em alguns instantes.",
    });
    return false;
  }

  useEffect(() => {
    if (
      !pendingPayPalOrderId ||
      !["loading", "processing"].includes(paymentResultModal?.status)
    ) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      checkPaymentConfirmation(pendingPayPalOrderId);
    }, PAYPAL_STATUS_CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [pendingPayPalOrderId, paymentResultModal?.status]);

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

    if (paypalStatus) {
      window.history.replaceState({}, "", "/support");
    }

    if (paypalStatus === "cancelled") {
      setPaymentStatus("Pagamento cancelado.");
      setPaymentResultModal({
        status: "error",
        title: "Pagamento cancelado",
        message: "O pagamento foi cancelado antes da confirmação.",
      });
      return;
    }

    if (paypalStatus !== "return" || !paypalOrderId) return;

    if (getProcessedPayPalOrders().includes(paypalOrderId)) {
      return;
    }

    markPayPalOrderProcessed(paypalOrderId);
    setPendingPayPalOrderId(paypalOrderId);

    let active = true;

    async function capturePayment() {
      setPaymentLoading(true);
      setPaymentStatus("Confirmando pagamento no PayPal...");
      setPaymentResultModal({
        status: "loading",
        title: "Processando pagamento",
        message: "Aguarde enquanto confirmamos seu pagamento com o PayPal.",
      });

      try {
        const { response, data } = await fetchJsonWithTimeout(
          "/api/payments/paypal/capture",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paypalOrderId }),
          }
        );

        if (!response.ok) {
          throw new Error(data.error || "Erro ao confirmar pagamento.");
        }

        if (!active) return;

        if (data.status === "processing") {
          const message =
            data.message ||
            "Pagamento em processamento. O PayPal ainda esta confirmando a compra.";
          setPaymentStatus(message);
          setPaymentResultModal({
            status: "loading",
            title: "Processando pagamento",
            message: "Aguarde enquanto confirmamos seu pagamento com o PayPal.",
          });

          await waitForPaymentConfirmation(paypalOrderId);
        } else {
          setPaymentStatus("Pagamento confirmado com sucesso.");
          setPaymentResultModal({
            status: "success",
            title: "Pagamento concluído",
            message: "Seu pagamento foi confirmado e o benefício foi aplicado à sua conta.",
          });
          setPendingPayPalOrderId("");
          await refreshUsageAndSession();
        }
      } catch (error) {
        if (!active) return;
        const message = error.message || "Erro ao confirmar pagamento.";
        setPaymentStatus(message);
        setPaymentResultModal({
          status: "error",
          title: "Falha no pagamento",
          message,
        });
        setPendingPayPalOrderId("");
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
              className="supportPaymentCloseButton"
              onClick={() => setPaymentModalPlan(null)}
              disabled={paymentLoading}
              aria-label="Fechar"
            >
              {"\u00D7"}
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

      {paymentResultModal && (
        <div className="modalOverlay supporterFeatureOverlay">
          <div className="modal supporterFeatureModal supportPaymentModal supportPaymentResultModal">
            {paymentResultModal.status !== "loading" && (
              <button
                className="supportPaymentCloseButton"
                onClick={() => setPaymentResultModal(null)}
                aria-label="Fechar"
              >
                {"\u00D7"}
              </button>
            )}

            <div
              className={[
                "supportPaymentResultIcon",
                paymentResultModal.status,
              ].join(" ")}
              aria-hidden="true"
            />
            <h2>{paymentResultModal.title}</h2>
            <p>{paymentResultModal.message}</p>
          </div>
        </div>
      )}

      <SiteFooter />
    </main>
  );
}



