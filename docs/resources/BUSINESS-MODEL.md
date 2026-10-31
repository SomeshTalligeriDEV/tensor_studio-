# TensorStudio business model

## Customer and value

Primary customers are subnet teams, developers building interfaces around subnet services, researchers testing evaluation designs and organizations exploring Bittensor. The purchasing reason is less setup work, reproducible evaluations and better operational visibility.

These are business hypotheses to validate through customer conversations and paid pilots. No revenue, customer adoption or token return is claimed.

## Products worth validating

| Offering | Who pays | Charging basis | What must be delivered |
| --- | --- | --- | --- |
| Team workspace | Subnet teams | Subscription per team or active seat | Shared projects, access controls, history and collaboration |
| Managed runners | Teams without infrastructure staff | Compute time plus storage | Per-tenant isolation, persistent disks, quotas and recovery |
| Evaluation service | Researchers and subnet operators | Private evaluation runs or contracted suite | Dataset governance, reproducible reports and validated metrics |
| Observability | Operators | Monitored services or retained data | Alerts, durable indexing and clearly sourced chain/process metrics |
| Integration services | Enterprises and subnet founders | Fixed-scope implementation and support | Domain-specific integrations and documented handover |

Managed multi-tenant infrastructure, billing, durable indexing and collaboration require additional engineering; the owner-protected demo is not those products.

## Unit economics

Measure contribution margin per paying workspace:

```text
subscription + metered usage revenue
− model/subnet inference cost
− runner CPU/RAM/storage cost
− RPC/indexing/bandwidth cost
− payment fees and variable support
= contribution margin
```

Do not select a price before measuring real workloads. Cap usage, show billable units and let customers supply their own inference credentials where appropriate. Avoid pricing that encourages unlimited inference or indefinite runner processes without quotas.

## A practical route to revenue

1. Interview subnet teams about setup time, evaluation pain and debugging needs.
2. Offer a narrowly scoped paid pilot around one real team's workflow.
3. Measure activation, repeated use, time to first useful result and support effort.
4. Introduce a paid team plan only after collaboration/access-control features exist.
5. Add managed compute once isolation, persistence, monitoring and cost controls are verified.

## Relationship to Bittensor economics

TensorStudio can support teams working on Bittensor without depending on token emissions for its own software revenue. A separately registered subnet could have its own network economics, but ownership, eligibility, emissions, expenses and market conditions must be evaluated independently. Running a miner or generating weights does not guarantee income.

Revenue from subscriptions/services and protocol emissions are different accounting categories. No earnings projection is a financial promise.
