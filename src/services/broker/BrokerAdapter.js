/**
 * services/broker/BrokerAdapter.js — the broker contract.
 *
 * Every broker (Zerodha, Upstox, Angel One, Dhan, FYERS, ICICI Breeze, and the
 * MockBroker used for paper trading) implements THIS interface and nothing else.
 * The rest of the application never learns which broker is connected — it only
 * ever holds a BrokerAdapter.
 *
 * Architecture (per spec, no shortcuts):
 *   Strategy Engine -> Risk Engine -> Broker Adapter -> Broker API
 *
 * A strategy may NEVER call a broker directly.
 *
 * SECURITY: adapters must never store broker credentials. Real adapters use
 * OAuth/token flows and hold a short-lived session token only.
 */

export const ORDER_STATUS = {
  FILLED: "FILLED",
  REJECTED: "REJECTED",
  PENDING: "PENDING",
  CANCELLED: "CANCELLED",
};

export class BrokerAdapter {
  /** @param {string} name  human-readable broker name */
  constructor(name) {
    this.name = name;
  }

  /** Is a session currently usable? */
  isConnected() {
    throw new Error(`${this.name}: isConnected() not implemented`);
  }

  /**
   * Place an order.
   * @param {{symbol, side, qty, price, market, orderType}} order
   * @returns {Promise<{orderId, status, avgPrice, filledQty, broker, reason?}>}
   */
  async placeOrder() {
    throw new Error(`${this.name}: placeOrder() not implemented`);
  }

  /** @returns {Promise<{orderId, status}>} */
  async cancelOrder() {
    throw new Error(`${this.name}: cancelOrder() not implemented`);
  }

  /** @returns {Promise<Array>} broker-side positions */
  async getPositions() {
    throw new Error(`${this.name}: getPositions() not implemented`);
  }

  /** @returns {Promise<{cash: number}>} */
  async getFunds() {
    throw new Error(`${this.name}: getFunds() not implemented`);
  }
}
