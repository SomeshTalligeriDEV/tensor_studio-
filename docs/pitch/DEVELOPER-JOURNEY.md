# TensorStudio — the five-minute developer journey

[Watch the film](../media/TensorStudio-developer-journey-5min.mp4) · [Beginner guide PDF](../resources/TensorStudio-Beginner-Journey.pdf) · [Step-by-step guide](../resources/BEGINNER-JOURNEY.md) · [Source map](../resources/ECOSYSTEM.md)

## Chapters

| Time | What the viewer follows |
| --- | --- |
| 00:00 | A concrete problem, Bittensor's roles and why Studio helps |
| 00:50 | Quest: movement, lesson, passed quiz, four passed local tests and progress |
| 01:30 | A support-routing plan and a working human-review interface |
| 02:05 | Labelled data, reviewed project assembly and offline scoring |
| 02:45 | Miner logs, stop/start and a signed inference response |
| 03:15 | Public testnet events, subnet participants and wallet overview |
| 03:40 | TensorNode: draft, persistence, events, billing and cancellation |
| 04:25 | Related projects and their exact source references |
| 04:45 | Open Studio and follow the beginner guide |

## Presentation and evidence

The film uses fresh browser captures for Quest and Studio. Actual interactions run at normal speed; loading and setup waits are removed between selected shots. Original diagrams explain conceptual roles and the user journey. They are not shown as live application results.

The support-inbox preview is a working human-review interface. Its manual category buttons are distinct from model inference. The miner test is an actual signed local request that returned HTTP 200 and the category `technical`. The helper comes from [local-miner-probe.py](../resources/local-miner-probe.py) and was placed in the assembled demo project as `probe_support.py`; it is not automatically inserted by the assembler.

The offline harness computes actual fixture scores with simulated timing. Public testnet subnet views are not the demo's own registered subnet. No chain transaction or paid GPU rental was performed for this film.

TensorNode appears using excerpts from the user's existing [actual application recording](https://github.com/SomeshTalligeriDEV/tensornode/blob/main/media/application-demo/TensorNode-actual-application-demo.mp4), at its original speed. Its chapter is labelled as an existing recording of the zero-spend workflow. No successful paid GPU execution is claimed. See the [original demo guide](https://github.com/SomeshTalligeriDEV/tensornode/blob/main/media/application-demo/DEMO_GUIDE.md).

Quest and TensorNode are separate apps. Subnet Factory is a separate generation prototype; no live integration or registered Factory subnet serving Studio is asserted.

## Files

- Video: `docs/media/TensorStudio-developer-journey-5min.mp4`
- English captions: `docs/media/TensorStudio-developer-journey.srt`
- Narration and timing: [developer-journey.json](developer-journey.json)
- Rendering: `python3 scripts/render-journey.py`, using the owner's local source captures and voice assets.

The soundtrack uses the installed synthetic English voice. Final validation includes exact 300-second duration, 1080p30 encoding, complete audio/video decode, normalized narration, chapter metadata, caption presence and inspected frames. No API keys or operator credentials are included in presentation assets.
