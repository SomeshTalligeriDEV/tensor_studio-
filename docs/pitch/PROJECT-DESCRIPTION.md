# TensorStudio — project description

**Bittensor makes specialized intelligence possible. TensorStudio makes it easier to start building it.**

For a new builder, the challenge extends beyond writing code. They must understand the network, identify useful work, define how quality will be measured, build an interface, run processes and interpret chain activity. Each step introduces another tool and another opportunity to lose context.

TensorStudio brings this development loop into one browser workspace: a practical path from a broad idea to an experiment whose code, evaluation and behavior can be inspected.

Our demonstration follows a concrete example: routing customer-support messages into **billing** or **technical**. A builder can:

1. **Clarify the problem.** Use the guided playground to discuss intended users, define the task and identify practical next steps.
2. **Build something tangible.** Generate editable application code, inspect its files and interact with a working browser preview.
3. **Define quality.** Supply labelled examples and inspect a structured question-answering or classification recipe, including ground truth and scoring choices.
4. **Challenge the evaluation.** Assemble reviewed project templates and inspect how an offline harness treats correct, incorrect, late and empty fixture responses.
5. **Run and investigate.** Launch a generated miner, inspect process logs and use an authenticated console. In the recorded demonstration, the miner receives a signed development request and returns an actual model classification.
6. **Observe the network with TensorScan.** Explore Bittensor blocks, decoded calls, events, accounts and subnet participants through a read-only explorer, available inside Studio and as a standalone application.

**TensorScan closes an important visibility gap: process output tells you what your software did; chain observations tell you what the network recorded.** Builders can inspect public network activity alongside development results without treating a running miner as proof of registration, accepted weights or rewards. Its recent browser index and historical views depend on the connected RPC and available retention.

The journey also starts before development. **Bittensor Quest** teaches core concepts through a pixel adventure, quizzes and local coding exercises, giving newcomers a practical way to understand the roles they will encounter in Studio. Learning progress remains browser-local.

For the operational side, **TensorNode** is a separate companion project exploring compute planning through deployment drafts, persisted events and billing records. Its demonstrated workflow uses zero-spend drafts; successful paid GPU execution is not claimed. Quest and TensorNode have clearly documented deployment and integration boundaries.

The architecture combines a React/Remix workbench, browser execution previews, an authenticated FastAPI runner, signed miner communication and independent Subtensor RPC observations. Server credentials remain server-side, and execution tools require protected owner access.

Bittensor provides the setting for specialized work, evaluation and network incentives. TensorStudio helps builders turn those concepts into concrete development decisions. Offline fixture evaluation, actual model inference and chain participation remain explicitly distinguished.

**The contribution is a clearer path from curiosity to contribution:** helping founders, researchers and developers learn the network, build a prototype, test an evaluation and investigate real behavior — while keeping the central question visible: *what useful work should this network perform, and how will we know it performs that work well?*

---

[Live workspace](https://tensorstudio-workbench.vercel.app) · [TensorScan](https://tensorscan.vercel.app/scan?network=test) · [Public pitch deck](https://tensorstudio-pitch-deck.vercel.app) · [Five-minute developer journey](https://youtu.be/Ap9ZqK-umcA) · [Bittensor Quest](https://bittensor-quest-learn.someshtalligeri12.chatgpt.site/#game) · [TensorNode source](https://github.com/SomeshTalligeriDEV/tensornode)
