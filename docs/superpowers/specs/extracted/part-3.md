---
slug: what-ai-cant-see
n: 3
viz-folder: complementarity-view
---

# What AI Can't See

**Dek:** Stop asking what AI cannot do. Start asking what AI cannot see.

**Reading time:** 10 min (computed: word_count = 2400)

**Suggested embed insertion:** after paragraph that begins "The streetlight cannot illuminate the broken leg."

---

## Prose (before embed)

*Part 3 of the series: We Are Choosing By Not Choosing*

The earlier articles in this series established two principles. First, friction reduction always wins. People reach for whatever removes the obstacle in front of them, right now, regardless of downstream effects. Second, "uniquely human" is unstable ground. Every capability boundary we draw eventually gets crossed.

If capability claims keep failing, what ground is stable?

Here is a better question: Stop asking what AI cannot do. Start asking what AI cannot see.

Capability claims predict what AI will eventually accomplish. They are bets on technological progress, and history suggests you will lose them. Access claims describe what information reaches the system at all. Access is structural. It does not improve with better models. And it determines where human judgment stays essential.

## The Streetlight Effect

There is an old joke about a man searching for his keys under a streetlight. A passerby asks where he dropped them. "Over there," the man says, pointing into the darkness. "But the light is better here."

The joke is ancient. Versions appear in Sufi folklore about Mulla Nasreddin. But it became a formal methodological concept through philosopher Abraham Kaplan in 1964. In *The Conduct of Inquiry*, Kaplan described how researchers "formulate problems in a way which requires for their solution just those techniques in which he himself is especially skilled." He called this a systematic bias toward the accessible rather than the relevant.[^1]

AI systems exhibit this bias acutely. They search where the data is because that is the only place they can search. The light is not just better there. It is the only light that exists.

A 2024 study made this concrete. Economists studying data-driven exploration found a paradox: access to data on past successes can narrow exploration and suppress breakthroughs. In laboratory experiments, revealing the value of medium-value projects reduced breakthrough likelihood by 56 percent. In genetic research, diseases with early promising evidence were 16 percentage points less likely to yield breakthroughs than diseases where early efforts had failed.[^2]

The explanation is precisely the streetlight dynamic. Attention concentrates on what is already illuminated. The darkness goes unsearched.

For AI systems in consequential decisions, this has immediate implications. The model optimizes for what is in the database. What is not in the database does not exist. The system is doing exactly what it was built to do: finding patterns in the available data. But the available data is the pool of light. The keys may be out in the dark.

## What Lies in the Dark

Ken Holstein is Assistant Professor of Human-Computer Interaction at Carnegie Mellon University, where he directs the CoALA Lab. His research focuses on understanding where human and artificial intelligence diverge, and on designing systems that elevate human expertise rather than diminish it.

Holstein and his collaborators have developed a formal framework for thinking about the gap between what AI systems can access and what human decision-makers perceive. They call the concept "model unobservables": information structurally unavailable to the AI but available to the human.[^3] This is not about current limitations that better models will fix. This is about what never enters the system in the first place.

The child welfare research illustrates how this works in practice. In Allegheny County, Pennsylvania, case workers use an algorithmic tool to help assess risk. The model draws on administrative records. It knows age, number of children, prior system engagement, criminal history. "It's just very coarse-grained information," Holstein explains.[^4]

The model might know that a grandfather was incarcerated thirty years ago. That looks risky in the data. But the model does not know what the current allegation involves. It does not know why someone called. It does not know whether the concern is a scraped knee or something grave.

This is the dark zone outside the streetlight. The model cannot see it because the information was never entered into any database. The human case worker, who reads the intake call and speaks with the family, sees both zones. The worker stands in the light and can also see into the dark.

Research confirms that this dual vision matters. A 2022 study found that when child welfare workers exercised judgment beyond algorithmic recommendations, they reduced racial disparity in screen-in rates from 20 percent to 9 percent.[^5] The workers accessed contextual information the algorithm could not touch. Their judgment was not overhead. It was the corrective.

The classic formulation of this problem comes from Paul Meehl's 1954 work on clinical versus statistical prediction. A formula might accurately predict whether someone will attend the movies on a given Friday. But if you know the person broke their leg that morning, you beat the formula instantly. The broken leg is the unobservable: situational information that never made it into the dataset.[^6]

The streetlight cannot illuminate the broken leg. Only the human, present in the situation, can see it.

---

## Prose (after embed)

## Mapping the Light and the Dark

The asymmetry between human and machine access runs in multiple directions. Mapping it reveals something more complex than a simple split between observable and unobservable.

Consider four zones, defined by two questions. Does AI have access to this information? Is the human consciously aware of it?

**Where light overlaps with awareness:** AI and human both see. This includes the model's training data, documented case history, structured inputs. Here AI has the advantage of scale and speed. It can process patterns across thousands of cases. Delegation is appropriate, with verification.

**Where light exceeds awareness:** AI sees patterns the human cannot consciously track. Statistical regularities across vast datasets, processing at speeds beyond cognition. The risk here is over-trust. If you cannot see what the model sees, you cannot verify whether it found something real or something spurious.

**Where awareness exceeds light:** The human knows what the model cannot access. This is the critical gap. Contextual knowledge, tacit understanding, situational judgment. This zone is where human involvement is not optional. It is the only access point to information the system cannot perceive.

**Where neither sees:** The unknown. Emergent risks that neither human nor machine can anticipate. Second-order effects visible only after deployment. This is where catastrophic failures originate.

The healthcare algorithm that Obermeyer and colleagues analyzed in *Science* operated in this fourth zone without anyone realizing it. The system optimized for healthcare costs rather than healthcare needs, using cost as a proxy for health. Because Black patients systematically have lower costs at equivalent health levels (due to unequal access to care), the algorithm falsely concluded Black patients were healthier. Correcting the bias would have increased Black patient enrollment from 17.7 percent to 46.5 percent. The bias was invisible until researchers specifically looked for it.[^7]

The streetlight illuminated costs. Health remained in the dark. The system optimized brilliantly for the wrong thing.

## Why Some Things Stay Dark

Some information resists entering the light not because of technical limitations but because of its nature.

Kathleen Brandenburg is Co-Founder and Co-CEO of IA Collaborative, a design consultancy, and a Lecturer at Harvard Graduate School of Design. Her firm takes immersive research seriously. "If I'm going to be designing for diabetes care, can I inject myself with a placebo insulin every day?" she asks. "We in fact have had designers on our team do exactly that, where they're wearing a patch for like over a month to really understand it."[^8]

This is not thorough research. This is access to a different category of information. "When you really get as close to the user experience as possible, you start to really understand it differently. You start to really feel it. You see things, you observe things. We find that what people do is often more significant than what they say."

The philosopher Michael Polanyi articulated this in 1966. "We can know more than we can tell," he wrote in *The Tacit Dimension*. His example was face recognition. We identify faces among thousands but cannot state the rules by which we do so. Making tacit knowledge explicit often destroys it. The cyclist who thinks consciously about balance falls off.[^9]

The sociologist Harry Collins extended this into a taxonomy. He distinguishes three kinds of tacit knowledge: relational (tacit due to social circumstances, explicable in principle), somatic (embodied in body and brain, potentially replicable), and collective (embedded in society, requiring socialization to acquire). Collective tacit knowledge, Collins argues, is the irreducible core. Riding a bicycle in traffic requires reading social cues, understanding unspoken conventions, knowing which rules to bend. "We know of no way to describe it or make machines that possess it."[^10]

This kind of knowledge lives permanently in the dark. No amount of data collection will bring it under the streetlight. It exists in the doing, in the being-there, in the embodied presence. Brandenburg's designers injecting placebo insulin are not gathering data points. They are gaining access to something that resists capture.

Every layer of abstraction loses information. The lived experience becomes the interview transcript. The transcript becomes the coded theme. The theme becomes the training data. The AI operates on that final abstraction, the most removed from the original richness.

Some keys are not just outside the light. They are made of material the light cannot illuminate.

## Three Questions for Any Deployment

Understanding what AI cannot see is not a limitation to work around. It is a design specification.

Every system has boundaries. Understanding where AI's boundaries lie is not criticism. It is engineering. You would not call someone anti-car for noting that cars cannot fly. The observable/unobservable distinction is structural reality. Good design accounts for it.

For any AI deployment, ask three questions:

**First:** What information is under the streetlight? What data did the model train on? What inputs does it receive? This is the zone of legitimate AI advantage.

**Second:** What decision-relevant information lies in the dark? What contextual, tacit, or situational knowledge shapes good judgment in this domain but never enters the data pipeline? Where this zone is significant, human involvement is essential.

**Third:** What might neither human nor machine currently see? What emergent risks or second-order effects could surprise everyone? Where this zone is large, humility and monitoring matter more than confidence.

The child welfare workers who reduced racial disparity were not slowing down an automated process. They were providing access to the dark zone. They could see what the allegation actually involved. They could read the situation. They brought information the algorithm could not perceive, and that information improved outcomes.

Their judgment was the feature, not the overhead.

## Stable Ground

Capability boundaries shift every few months. Every claim about what AI "cannot do" becomes a countdown to embarrassment. But information access boundaries are structural. They are determined by what enters the data pipeline, not by model architecture or training scale.

This gives leaders something to work with. Instead of asking "Will AI eventually master this?" (a question that history answers with "probably"), ask: "What information relevant to this decision never makes it into the system?"

That question is answerable now. And the answer determines where human judgment remains essential. Not as a placeholder until AI improves. As the only access point to information the system was never designed to see.

The organizations that thrive will not be those that automate fastest or adopt most aggressively. They will be those that understand where the light falls, what lies in the darkness, and why both zones matter for decisions that affect lives.

The man searching under the streetlight is optimizing for convenience. He looks where looking is easy. But his keys are not there.

They never were.

---

## Footnotes

[^1]: Kaplan, A. (1964). *The conduct of inquiry: Methodology for behavioral science*. Chandler Publishing.

[^2]: Hoelzemann, J., Manso, G., Nagaraj, A., & Tranchero, M. (2024). The streetlight effect in data-driven exploration. *NBER Working Paper No. 32401*.

[^3]: Holstein, K., et al. (2023). Toward supporting perceptual complementarity in human-AI collaboration via reflection on unobservables. *Proceedings of the ACM on Human-Computer Interaction, 7*(CSCW1), Article 106. Also: Rastogi, C., Liu, L., Holstein, K., & Heidari, H. (2023). A taxonomy of human and ML strengths in decision-making to investigate human-ML complementarity. *Proceedings of the AAAI Conference on Human Computation and Crowdsourcing (HCOMP 2023)*.

[^4]: Holstein, personal interview, October 2025.

[^5]: Cheng, H-F., et al. (2022). How child welfare workers reduce racial disparities in algorithmic decisions. *CHI 2022*. https://doi.org/10.1145/3491102.3501831

[^6]: Meehl, P. E. (1954). *Clinical versus statistical prediction: A theoretical analysis and a review of the evidence*. University of Minnesota Press.

[^7]: Obermeyer, Z., Powers, B., Vogeli, C., & Mullainathan, S. (2019). Dissecting racial bias in an algorithm used to manage the health of populations. *Science, 366*(6464), 447–453.

[^8]: Brandenburg, personal interview, October 2025.

[^9]: Polanyi, M. (1966). *The tacit dimension*. Routledge & Kegan Paul.

[^10]: Collins, H. (2010). *Tacit and explicit knowledge*. University of Chicago Press.

---

## Flagged ambiguities

- Page 4–5 split: The sentence "Consider four zones, defined by two questions. Does AI have access to this information? Is the human consciously aware of it?" precedes the four-zone descriptions, but the PDF page break may have originally included a diagram or table between this sentence and the zone descriptions ("Where light overlaps with awareness:" etc.). If a visual was present in the original document it is not captured here.
- The PDF states "Word Count: ~2,400" on the final page (page 9), but this appears to be an authoring note rather than article body text — excluded from prose accordingly.
