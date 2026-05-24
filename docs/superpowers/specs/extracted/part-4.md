---
slug: designing-around-gaps
n: 4
viz-folder: friction-spectrum
---

# Designing Around the Gaps

**Dek:** What do you actually do with the knowledge that friction reduction always wins, problem definition precedes solution, and AI operates under structural limits?

**Reading time:** 8 min (computed: word_count = 1843)

**Suggested embed insertion:** after paragraph that begins "Picture a spectrum with four levels, each defined by"

---

## Prose (before embed)

*Part 4 of the series: We Are Choosing By Not Choosing*

The earlier articles in this series established three principles. Friction reduction always wins: people reach for whatever removes the obstacle in front of them. Problem definition precedes solution: the ladder has rungs, and skipping them produces failures. AI operates under structural limits: some information never reaches the system.

Each principle identifies a challenge. Together they raise a practical question: what do you actually do with that knowledge?

## Deployment as Design

Organizations treat AI deployment like installing software. They launch pilots, give ten people access, and wait to see what happens. When the pilot stumbles, they conclude the technology failed. But the technology rarely fails. The deployment does.

Kelly Franznick, Chief Innovation Officer at Blink UX, sees this pattern across his client base of large technology companies and startups. "People are deploying AI like it's an IT deployment when it's really a design process," he observes. "They launch a pilot, they give ten people access to it and they sit back and say, well, that crashed and burned, right? Instead of launching it, observing it, learning and iterating on it, which I think is the key to successful deployments" (Franznick, personal interview, October 2025).

The distinction runs deeper than process. IT deployment assumes the system works as specified and users will adapt. Design assumes continuous observation, learning, and iteration. One treats friction as a bug to eliminate. The other treats friction as information about where the system needs refinement.

If deployment is design, then the question shifts. Not "how do we remove obstacles?" but "which obstacles are we removing, and what were they protecting?"

## The Seamlessness Trap

The default pressure in technology development runs toward seamlessness. Remove the friction. Make the AI invisible. Let it act autonomously so users never notice the handoff between human and machine. This feels like progress. Seamless experiences delight users. Frictionless interfaces win adoption. The metrics reward smooth.

But seamlessness hides something important: the boundary where human judgment ends and machine prediction begins. When that boundary disappears, so does the capacity to evaluate what the machine produces. Users lose track of when they are receiving AI-generated content. They forget to apply the skepticism that AI outputs require. They stop developing the expertise needed to recognize when the AI is wrong.

Liz Danzico, who leads design at Microsoft AI, describes the guidance her team received in the early days of building responsible AI products. "One of the responsible AI team's advice to all of us as we were designing these experiences was to make sure to put that friction in, so people were aware of the interaction with AI at each stage" (Danzico, personal interview, October 2025).

The advice came from studying what happens when users cannot distinguish AI contributions from human ones. They lose calibration. They over-trust. They stop checking.

"Right now I think one of the problems is that there are no seams," Danzico observed. The seams have been engineered away in pursuit of engagement metrics that reward low friction without measuring the judgment erosion that follows. The pressure runs entirely in one direction: smoother, faster, more invisible. Nobody asks what the seams were doing before they disappeared.

Research on automation bias confirms the danger. Parasuraman and Manzey's comprehensive review found that automation bias "cannot be prevented by training or instructions" (Parasuraman & Manzey, 2010). Telling people to be skeptical does not make them skeptical. The bias operates below conscious control. Only structural interventions work: changing what the system shows, when it shows it, and what actions it requires.

The seam is not the obstacle. The seam is the structural intervention.

## Beautiful Seams

Mark Weiser anticipated this problem three decades ago. The Xerox PARC researcher who coined "ubiquitous computing" spent years arguing that technology should disappear into the background, becoming invisible through integration. His 1991 Scientific American article shaped an entire field's aspirations toward seamless experience.

Yet by 1994, Weiser was warning against the very seamlessness his work seemed to promise. In an invited talk at the ACM symposium on user interface software, he advocated for what he called "seamful systems with beautiful seams" (Weiser, 1994).

The phrase sounds like a contradiction from someone who built his reputation on invisibility. But Weiser had recognized something the field was missing. Making everything seamless meant reducing every component to its lowest common denominator. Seamlessness sacrificed the richness of individual tools in pursuit of bland compatibility. As Matthew Chalmers later documented Weiser's insight: seamful design "weights the bigness and differentiating features of individual media and mechanisms, rather than trying to reduce everything down to a similar level of 'greyness'" (Chalmers, 2003).

The seams, properly designed, would reveal how technology works. They would show users where human and machine connect rather than hiding the junction. They would create moments of awareness that enable judgment.

Weiser died in 1999, before the current AI wave. But his insight applies with particular force to systems that generate content, make recommendations, and shape decisions. When the seam between human work and machine work becomes invisible, users lose the ability to evaluate either one. The beautiful seam is the one that appears precisely where evaluation matters and disappears where it adds nothing.

## Calibrating Friction to Stakes

The solution is not friction everywhere. Nobody wants clunky interfaces that interrupt every action with confirmation dialogs. The solution is calibrated friction: seams matched to stakes.

Picture a spectrum with four levels, each defined by what the situation requires.

---

## Prose (after embed)

At one end sits **seamless operation**. Low-consequence, routine tasks need no seams. When AI schedules a meeting or sorts emails into folders, autonomous operation makes sense. Errors carry minimal cost. The human gains nothing from reviewing each decision. The seam would add friction without adding value. This is appropriate automation.

Next comes **visible contribution**. Learning contexts need marked seams regardless of immediate stakes. When a junior analyst uses AI to draft a financial model, the AI's contribution should be clearly identified. Not because the model is necessarily high-stakes, but because the analyst needs to understand what the AI produced versus what they produced. They need to develop the judgment that will matter when stakes eventually rise. The seam here is pedagogical. It preserves the practice that builds expertise.

Further along sits **gated approval**. High-stakes decisions need seams that require action. When AI recommends a medical diagnosis or flags a transaction for fraud investigation, visibility is not enough. The human must actively approve before anything happens. The gate forces engagement. It prevents the automation complacency that research documents: when humans know they can intervene but are not required to, they drift toward inattention. The seam here is protective. It ensures human judgment actually enters the loop.

At the far end sits **human-only with AI inform**. Some domains require human ownership regardless of capability. Strategic decisions, personnel evaluations, creative direction: AI may provide relevant information, but the human decides without the option to simply accept a recommendation. The boundary is bright and non-negotiable. The seam here is constitutional. It defines what the organization will not delegate.

This spectrum echoes how organizations already calibrate controls in other contexts. Financial approvals require escalating signatures as amounts increase. Medical procedures require varying levels of supervision based on risk. Engineering changes follow review processes proportional to safety implications. AI deployment needs the same thoughtfulness applied to where humans engage and where machines act alone.

The failure mode is uniform low friction regardless of stakes. Organizations that default to seamlessness everywhere lose the ability to distinguish between appropriate automation and dangerous abdication. Every interaction feels the same, which means every interaction receives the same level of attention: minimal.

## Who Stands at the Gates

Placing a gate is not enough. The gate must be staffed by someone who can actually use it.

Part 3 of this series introduced Ken Holstein's concept of "unobservables": information structurally unavailable to AI systems regardless of model sophistication. The case worker knows what the allegation actually involves. The radiologist reads contextual cues in the image. The experienced trader recognizes patterns that resist formalization. These humans possess information the AI cannot access.

This insight determines who belongs at each gate. A radiologist reviewing AI-flagged images contributes expertise the system lacks. An administrator reviewing the same images contributes only a signature. The gate creates a decision point. The person at the gate determines whether judgment actually enters.

The question is not just where to place friction, but whose friction. The seam must connect to someone who can see what the AI cannot.

Holstein's research reveals a common failure pattern. Organizations claim frontline workers are "too non-technical to contribute" to AI design decisions. When his team examines these claims, they find the failure lies in scaffolding, not capability. "We'll kind of study those attempts and say, wait, of course they weren't able to contribute. But you weren't really empowering them to contribute in any way or to understand what you're talking about in the first place" (Holstein, personal interview, October 2025).

The workers have the information. They lack the structures that would bring that information to bear. The gate exists, but nobody built a path to it.

## The Design Problem

Kathleen Brandenburg of IA Collaborative emphasizes the systems thinking this requires. "We always in design think of the whole ecosystem. We are always thinking about the whole system" (Brandenburg, personal interview, October 2025). AI deployment invites narrow focus on the technology. Effective deployment requires the wider view.

The friction spectrum is not a checklist. It is a design problem. Where should seams appear? How visible should they be? Who needs to stand at each gate? What information do they need? How do you know if the system is working?

These questions require iteration. The first deployment will not get them right. That is precisely Franznick's point about treating deployment as design rather than installation. You launch, you observe, you learn, you adjust. The seams themselves become sources of information about where the system needs refinement.

An organization that watches its gates learns which ones matter and which create only delay. It discovers where human judgment consistently improves outcomes and where it merely slows them. It finds the workers who possess information the system needs and builds paths to incorporate their knowledge.

This is expensive. It requires attention that organizations prefer to allocate elsewhere. It slows down deployment in the short term.

But the alternative is the default path described in Part 1: AI adoption driven by friction reduction alone, without attention to what friction protected. Systems that seem to work until they fail in ways nobody anticipated. Expertise erosion invisible until critical judgment is needed and unavailable.

## The Seam as Information

Weiser's beautiful seams were never about adding friction for its own sake. They were about revealing the joints where different components connect, so that users could understand and improve the system.

This reframe matters for how organizations think about human-AI boundaries. The seam is not the obstacle to efficiency. The seam is the information that makes the system legible. It shows where human and machine meet. It creates the moments when judgment can enter. It generates the data about whether the system is actually working.

Organizations that engineer away all seams in pursuit of seamlessness lose this information. They cannot see where the handoffs occur. They cannot tell when human judgment is adding value and when it is adding delay. They cannot improve what they cannot observe.

The default path removes friction wherever possible because friction feels like waste. The design path asks what each friction point reveals. Some reveal nothing and should be eliminated. Others reveal the junction between human capability and machine capability. These are the seams worth keeping.

Part 5 examines the final question this raises: even with well-designed seams and properly staffed gates, how fast can an organization absorb change? Different organizational layers move at different speeds. Push faster than the slowest essential layer can adapt, and something breaks.

---

## Footnotes

[^1]: Chalmers, M. (2003). Seamful design and ubicomp infrastructure. *Proceedings of Ubicomp 2003 Workshop at the Crossroads: The Interaction of HCI and Systems Issues in Ubicomp*.

[^2]: Parasuraman, R., & Manzey, D. H. (2010). Complacency and bias in human use of automation: An attentional integration. *Human Factors, 52*(3), 381–410.

[^3]: Weiser, M. (1994). Creating the invisible interface (invited talk). *Proceedings of the 7th Annual ACM Symposium on User Interface Software and Technology (UIST '94)*.

---

## Acknowledgments

This article draws on interviews with Kathleen Brandenburg (IA Collaborative), Liz Danzico (Microsoft AI), Kelly Franznick (Blink UX), and Ken Holstein (Carnegie Mellon University).
