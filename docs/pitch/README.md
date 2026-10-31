# TensorStudio — three-minute pitch

[Watch the narrated pitch](../media/TensorStudio-pitch-3min.mp4) · [Full product demo](../media/TensorStudio-demo-5min.mp4) · [Project brief PDF](../resources/TensorStudio-Project-Brief.pdf)

A 180-second product pitch: problem, workflow, evaluation, architecture, Bittensor integration and business opportunity. The film uses actual product footage plus the architecture diagram. It does not claim a registered TensorStudio subnet serves the assistant.

## 00:00–00:30 · Useful intelligence needs a starting point

A useful Bittensor subnet starts with a simple question: what work should this network reward? The difficult part is turning that answer into a system people can inspect. Today, a builder moves between documentation, editors, terminals, evaluation scripts and chain explorers. TensorStudio connects that journey in one browser workspace, so a team can spend more attention on the quality of its idea and less on connecting its tools.

## 00:30–01:00 · One connected development loop

Start with a conversation. Describe the problem, explore tradeoffs, and get practical next steps. Carry the idea into the Subnet builder, where editable files sit beside a working application preview. Here, we add tasks to a real generated interface and inspect its code. That same loop helps a subnet team develop the tools around its service: describe, build, try, understand, and improve.

## 01:00–01:30 · Make evaluation part of the design

Then make the subnet's task explicit. Supply labelled examples for question answering or classification. Subnet setup produces a structured recipe for the task, ground truth, scoring and proposed weights, then assembles reviewed project templates. The offline harness compares controlled answers and exposes the scoring behavior. Its timing is simulated, but its calculations are real. This helps teams challenge an evaluation design before trusting the incentives built around it.

## 01:30–02:00 · A clear architecture, with clear boundaries

The architecture keeps each responsibility clear. The browser contains the workspace, preview and encrypted wallet tools. The web application handles validated assistant requests and owner access. An authenticated Python runner assembles projects, evaluates fixtures, runs native processes and streams logs. A configurable model endpoint supplies inference. Separately, direct Subtensor reads supply network observations. Short lived runner sessions connect these components without placing server credentials in the browser.

## 02:00–02:30 · Built around Bittensor's actual roles

Bittensor gives this workflow its purpose: specialized tasks, miners that perform the work, validators that assess contributions, and a chain that coordinates participation. TensorStudio maps those roles into inspectable development tools. Generated processes use signed HTTP requests, while TensorScan shows live blocks, events and subnet data. A running process is distinct from a registered subnet; chain participation, accepted weights and rewards need their own validation.

## 02:30–03:00 · A product teams can build a business around

Our opportunity is developer productivity: team workspaces, managed runners, private evaluations and operational visibility. These are proposed paid products, with pricing grounded in actual compute and support costs. The current demonstration uses an ephemeral free runner; production teams need durable, isolated infrastructure. TensorStudio's vision is simple: make useful intelligence easier to build, evaluate and understand. Explore the workspace, inspect the demo, and bring your next Bittensor idea to life.

## Presenter notes

Open with the useful-work question. Keep the classifier example concrete: an input message, a reviewed label, an inspectable score. Explain that the system separates inference, processes and chain reads. End with the product opportunity, not an earnings promise.

The source narration and timings are in [pitch.json](pitch.json). Captions are in [TensorStudio-pitch.srt](TensorStudio-pitch.srt).
