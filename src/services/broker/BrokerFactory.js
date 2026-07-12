import { MockBroker } from "./MockBroker";

/**
 * services/broker/BrokerFactory.js — hands out the active broker.
 *
 * The app asks the factory for "a broker" and gets a BrokerAdapter. It never
 * names a specific one, so connecting a real broker later is a registry entry
 * plus an adapter file — no change to the pipeline, the pages, or the hooks.
 */

const REGISTRY = {
  paper: () => new MockBroker(),

  // Planned adapters. Each implements BrokerAdapter and nothing more:
  //   zerodha:     () => new ZerodhaAdapter(),
  //   upstox:      () => new UpstoxAdapter(),
  //   angelone:    () => new AngelOneAdapter(),
  //   dhan:        () => new DhanAdapter(),
  //   fyers:       () => new FyersAdapter(),
  //   icicibreeze: () => new ICICIBreezeAdapter(),
};

/** Brokers that could be offered in Settings (only `paper` is live today). */
export const SUPPORTED_BROKERS = [
  { id: "paper", name: "Matrix Paper", live: true },
  { id: "zerodha", name: "Zerodha", live: false },
  { id: "upstox", name: "Upstox", live: false },
  { id: "angelone", name: "Angel One", live: false },
  { id: "dhan", name: "Dhan", live: false },
  { id: "fyers", name: "FYERS", live: false },
  { id: "icicibreeze", name: "ICICI Breeze", live: false },
];

let active = null;

/** The broker currently in use. Defaults to paper trading. */
export function getBroker(id = "paper") {
  if (active && active.id === id) return active.adapter;
  const make = REGISTRY[id];
  if (!make) throw new Error(`Broker "${id}" is not connected yet — no adapter registered.`);
  active = { id, adapter: make() };
  return active.adapter;
}
