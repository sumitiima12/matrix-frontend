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

/* The catalogue now lives in domain/brokers.js, which also records WHY a broker is
   or is not available. Execution still defaults to `paper`: connecting a broker
   turns on its live DATA feed (hooks/useBroker), not real-money orders. Those need
   BROKER_TRADING_ENABLED=true on the server, deliberately. */
export { BROKERS as SUPPORTED_BROKERS } from "../../domain/brokers";

let active = null;

/** The broker currently in use. Defaults to paper trading. */
export function getBroker(id = "paper") {
  if (active && active.id === id) return active.adapter;
  const make = REGISTRY[id];
  if (!make) throw new Error(`Broker "${id}" is not connected yet — no adapter registered.`);
  active = { id, adapter: make() };
  return active.adapter;
}
