import { BrokerAdapter, ORDER_STATUS } from "./BrokerAdapter";

/**
 * MockBroker — the paper-trading broker. This is what Matrix ships with today.
 *
 * It fills at the REAL last-traded price passed in with the order. It does not
 * simulate slippage, partial fills, or a fake order book — inventing those would
 * make backtest and paper results look more precise than they are.
 *
 * It rejects an order with no live price, so a position can never be opened at a
 * made-up level.
 */
export class MockBroker extends BrokerAdapter {
  constructor() {
    super("Matrix Paper");
    this.orders = [];
  }

  isConnected() {
    return true;   // paper trading is always available
  }

  async placeOrder({ symbol, side, qty, price, market, orderType = "MARKET" }) {
    if (price == null || !Number.isFinite(price) || price <= 0) {
      return {
        orderId: null,
        status: ORDER_STATUS.REJECTED,
        reason: "No live price for this instrument — refusing to fill at an invented price.",
        broker: this.name,
      };
    }
    if (!qty || qty <= 0) {
      return { orderId: null, status: ORDER_STATUS.REJECTED, reason: "Quantity must be positive.", broker: this.name };
    }

    const order = {
      orderId: `paper-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: ORDER_STATUS.FILLED,
      avgPrice: price,           // fills at the real LTP
      filledQty: qty,
      symbol, side, market, orderType,
      at: Date.now(),
      broker: this.name,
    };
    this.orders.push(order);
    return order;
  }

  async cancelOrder(orderId) {
    return { orderId, status: ORDER_STATUS.CANCELLED };
  }

  async getPositions() {
    return [];   // Matrix owns paper positions locally
  }

  async getFunds() {
    return { cash: null };   // wallets are managed by the app in paper mode
  }
}
