# Bittensor integration

TensorStudio connects development tools to Bittensor's chain and task/participant model. The chain, process runtime and model endpoint have separate responsibilities.

## Browser reads

The browser uses Polkadot.js with a WebSocket provider to subscribe to best/finalized headers and decode runtime storage, calls and events. Explorer snapshots retain a bounded recent index in the browser. Public testnet and mainnet browsing are read-only. Historical availability depends on RPC retention; an archive index is a separate infrastructure concern.

The dashboard reads subnet metadata and neuron snapshots, including available validator permits, incentives and alpha values. Alpha stake/emission and TAO values have separate labels. Snapshot emission is not inferred cumulative earnings.

## Python execution

The runner pins Bittensor 11.3.0. Generated miner and development-validator templates use the SDK's signed HTTP authentication. Authentication, allowlists and model inference are separate checks. The miner requests an answer from a configured model; supplied evaluation data is not used as a response lookup table.

Generated development validators require a separately configured suitable chain and discoverable miners. Starting a process does not register an identity, publish an endpoint, submit accepted weights or establish rewards. Network guards remain in place for development funding and transaction paths.

## Inference

The web assistant and generated miner use explicitly configured model endpoints. Compatible subnet inference APIs can be configured through those interfaces. This flexibility is not evidence that the hosted assistant is currently served by a registered TensorStudio subnet. To establish that claim, document its netuid, serving endpoint, authentication and a verified live request.

## Trust boundaries

Hosted owner tools use protected web access and scoped short-lived runner sessions. Server credentials stay out of browser assets. The owner runner executes trusted code; it is not a public multi-tenant sandbox. Personal wallet material remains encrypted in browser-local storage.

## Primary references

- [Network concepts](https://www.bittensor.com/docs/concepts/network)
- [SDK quickstart](https://www.bittensor.com/docs/quickstart)
- [Signed HTTP requests](https://www.bittensor.com/docs/guides/signed-requests)
- [Transaction policy and planning](https://www.bittensor.com/docs/concepts/transactions)
- [Client snapshots](https://www.bittensor.com/docs/concepts/client)
- [Polkadot.js API](https://polkadot.js.org/docs/api/)
