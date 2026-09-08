import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCartStore, CartLine as StoreCartLine } from '../../utils/cartStore';
import CheckoutModal from './CheckoutModal';
import AuthModal from '../layout/AuthModal';
import { useAuthStore } from '../../utils/authStore';
interface Props {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  lines: any[]; // Ignored, using store
  onInc: (key: string) => void; // Ignored
  onDec: (key: string) => void; // Ignored
  onRemove?: (key: string) => void; // Ignored
  onClear: () => void; // Ignored
  onPlaceOrder: () => void;
}
const inr = (n: number): string => `₹${Number(n || 0).toLocaleString('en-IN')}`;
interface SupplierGroup {
  supplier: string;
  supplierId: string;
  lines: StoreCartLine[];
  subtotal: number;
}
const CartBar: React.FC<Props> = ({
  open,
  onOpen,
  onClose,
  onPlaceOrder,
}) => {
  const { token } = useAuthStore();
  const { lines, inc, dec, remove, clear } = useCartStore();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = lines.reduce((n, l) => {
    const isSub = (l as any).isSubscription;
    const price = isSub && l.listing.subscriptionPrice > 0 ? l.listing.subscriptionPrice : l.listing.price;
    return n + price * l.qty;
  }, 0);
  const deposits = lines.reduce(
    (n, l) => n + (l.listing.depositRequired ? l.listing.depositAmount * l.qty : 0),
    0
  );
  const total = subtotal + deposits;
  const isEmpty = lines.length === 0;
  const groups = useMemo<SupplierGroup[]>(() => {
    const order: string[] = [];
    const map: Record<string, StoreCartLine[]> = {};
    lines.forEach(l => {
      const key = (l.listing as any).supplierId || l.listing.supplier;
      if (!map[key]) {
        map[key] = [];
        order.push(key);
      }
      map[key].push(l);
    });
    return order.map(key => ({
      supplier: map[key][0]?.listing?.supplier || key,
      supplierId: key,
      lines: map[key],
      subtotal: map[key].reduce((n, l) => {
        const isSub = (l as any).isSubscription;
        const price = isSub && l.listing.subscriptionPrice > 0 ? l.listing.subscriptionPrice : l.listing.price;
        return n + price * l.qty;
      }, 0),
    }));
  }, [lines]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  const handleProceedToCheckout = () => {
    if (!token) {
      setPendingCheckout(true);
      setAuthOpen(true);
    } else {
      setCheckoutOpen(true);
    }
  };
  const handleAuthClose = () => {
    setAuthOpen(false);
    if (pendingCheckout && useAuthStore.getState().token) {
      setCheckoutOpen(true);
    }
    setPendingCheckout(false);
  };
  const closeCheckout = () => setCheckoutOpen(false);
  const doneCheckout = () => {
    setCheckoutOpen(false);
    onClose();
    clear();
  };
  return createPortal(
    <>
      {/* floating bar */}
      {!open && !checkoutOpen && itemCount > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[45] px-4 md:bottom-6">
          <button
            type="button"
            onClick={onOpen}
            className="pointer-events-auto mx-auto flex w-full max-w-xl items-center justify-between rounded-2xl bg-slate-900 px-5 py-3.5 text-white shadow-2xl transition hover:bg-slate-800"
          >
            <span className="flex items-center gap-2 text-sm font-bold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-extrabold">
                {itemCount}
              </span>
              {inr(total)}
              <span className="hidden text-xs font-normal text-slate-300 sm:inline">
                {groups.length > 1 && `${groups.length} suppliers · `}
                {deposits > 0 && `incl. ${inr(deposits)} deposit`}
              </span>
            </span>
            <span className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold">
              View Cart 🛒
            </span>
          </button>
        </div>
      )}
      {/* cart sheet */}
      {open && (
        <div className="fixed inset-0 z-[80]">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="animate-fade-in absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl bg-white shadow-2xl sm:inset-x-auto sm:right-0 sm:top-0 sm:h-full sm:w-[440px] sm:max-h-none sm:rounded-none sm:rounded-l-3xl">
            {/* header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Your Cart</h3>
                <p className="text-[11px] text-slate-400">
                  {itemCount} item{itemCount === 1 ? '' : 's'} from {groups.length}{' '}
                  supplier{groups.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!isEmpty && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to remove all items from your cart?')) {
                        clear();
                      }
                    }}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-rose-500 transition hover:bg-rose-50 hover:border-rose-200"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    Empty Cart
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close cart"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>
            {/* lines grouped by supplier */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {isEmpty ? (
                <div className="py-16 text-center">
                  <p className="text-4xl">🛒</p>
                  <p className="mt-3 text-sm font-bold text-slate-700">Your cart is empty</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Add some water to get started!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groups.map(g => (
                    <div
                      key={g.supplierId}
                      className="overflow-hidden rounded-2xl border border-slate-200"
                    >
                      <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2">
                        <p className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-extrabold text-white">
                            {g.supplier.charAt(0)}
                          </span>
                          {g.supplier}
                        </p>
                        <span className="text-[10px] font-bold text-slate-500">
                          {g.lines.length} item{g.lines.length === 1 ? '' : 's'} ·{' '}
                          {inr(g.subtotal)}
                        </span>
                      </div>
                      <div className="space-y-2.5 p-3">
                        {g.lines.map(({ listing: l, qty, isSubscription, frequency, lineKey }) => (
                          <div key={lineKey} className="flex items-center gap-3">
                            {l.images[0] ? (
                              <img
                                src={l.images[0]}
                                alt={l.variantName}
                                className="h-12 w-12 flex-shrink-0 rounded-xl object-cover"
                              />
                            ) : (
                              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl">
                                {l.categoryIcon}
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-slate-900">
                                {l.variantName || l.productName}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {isSubscription ? (
                                  <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">
                                    🔁 {frequency} Subscription
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                                    One-time
                                  </span>
                                )}
                                {l.depositRequired && (
                                  <span className="text-[11px] text-amber-600">
                                    +{inr(l.depositAmount)} deposit
                                  </span>
                                )}
                                {l.temperature === 'Cold' && <span className="text-[11px] text-sky-600">❄️ Cold</span>}
                              </div>
                              <p className="text-sm font-extrabold text-slate-900">
                                {inr((isSubscription && l.subscriptionPrice > 0 ? l.subscriptionPrice : l.price) * qty)}
                              </p>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-1 rounded-xl border border-slate-200 px-1 py-0.5">
                              <button
                                type="button"
                                onClick={() => dec(lineKey)}
                                aria-label="Decrease"
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-extrabold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                −
                              </button>
                              <span className="w-6 text-center text-xs font-extrabold text-slate-900">
                                {qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => inc(lineKey)}
                                aria-label="Increase"
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-extrabold text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-600"
                              >
                                ＋
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => remove(lineKey)}
                              aria-label="Remove item"
                              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {groups.length > 1 && (
                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-[11px] font-semibold text-amber-700">
                      ℹ️ Items from different suppliers ship separately — you'll see
                      per-supplier delivery charges at checkout.
                    </p>
                  )}
                </div>
              )}
            </div>
            {/* totals + checkout */}
            {!isEmpty && (
              <div className="flex-shrink-0 space-y-2 border-t border-slate-100 bg-white px-5 py-4">
                <p className="flex justify-between text-sm text-slate-600">
                  <span>Items subtotal</span>
                  <span className="font-semibold text-slate-900">{inr(subtotal)}</span>
                </p>
                {deposits > 0 && (
                  <p className="flex justify-between text-sm text-amber-600">
                    <span>Refundable deposits</span>
                    <span className="font-semibold">{inr(deposits)}</span>
                  </p>
                )}
                <p className="flex justify-between text-[11px] text-slate-400">
                  <span>Delivery charges calculated per supplier at checkout</span>
                </p>
                <p className="flex justify-between border-t border-dashed border-slate-200 pt-2 text-base font-extrabold text-slate-900">
                  <span>Total</span>
                  <span>{inr(total)}</span>
                </p>
                <button
                  type="button"
                  onClick={handleProceedToCheckout}
                  className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 py-3.5 text-sm font-extrabold text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-sky-600"
                >
                  Proceed to Checkout · {inr(total)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* auth modal */}
      {authOpen && (
        <AuthModal open={authOpen} onClose={handleAuthClose} />
      )}
      {/* multi-step checkout */}
      {checkoutOpen && !isEmpty && (
        <CheckoutModal
          lines={lines}
          onClose={closeCheckout}
          onDone={doneCheckout}
          onPlaced={onPlaceOrder}
        />
      )}
    </>,
    document.body
  );
};
export default CartBar;
