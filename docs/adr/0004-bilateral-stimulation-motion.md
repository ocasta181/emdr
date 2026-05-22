# ADR 0004: Bilateral Stimulation Motion Defaults

## Status

Accepted

## Context

The app renders visual bilateral stimulation as a moving dot. The default motion should follow the best available implementation guidance without implying that the app independently provides clinical EMDR therapy.

Reviewed sources:

- van Veen et al., "Speed matters: relationship between speed of eye movements and modification of aversive autobiographical memories": https://www.frontiersin.org/journals/psychiatry/articles/10.3389/fpsyt.2015.00045/pdf
- van den Hout et al., "EMDR and mindfulness: Eye movements and attentional breathing tax working memory and reduce vividness and emotionality of aversive ideation": https://www.emdr.org.il/wp-content/uploads/2021/01/EMDR_and_mindfulness_Eye_movements_and_a.pdf
- Lee and Cuijpers, "A meta-analysis of the contribution of eye movements in processing emotional memories": https://thegreenwill.org/wp-content/uploads/2023/11/Journal-Lee-Cuijpers-EM-meta-analysis-of-the-contribution-of-eye-movements-in-processing-emotional-memories-Lee-Cuypers-2013.pdf
- ISSTD EMDR Therapy Basic Training Manual, "Speed, Distance, and Motion of Eye Movements": https://cfas.isst-d.org/sites/default/files/media/2023-08/01%20EMDR%20Therapy%20Basic%20Training%20Manual%202023-2024%20%28FINAL%2008.29.2023%29.pdf
- Piepenbrock et al., "Smaller pupil size and better proofreading performance with positive than with negative polarity displays": https://www.psychologie.hhu.de/fileadmin/redaktion/Oeffentliche_Medien/Fakultaeten/Mathematisch-Naturwissenschaftliche_Fakultaet/Psychologie/AAP/Publikationen/in_press/Piepenbrock-in_press-Smaller_pupil_size_and_better.pdf
- Shieh and Lin, "Effects of polarity and luminance contrast on visual performance and VDT display quality": https://www.sciencedirect.com/science/article/abs/pii/S0169814199000402

The sources support horizontal, rhythmic eye movements across the visual field, with speed set fast enough to tax working memory while remaining tolerable. van Veen et al. found stronger analogue-memory effects for faster eye movements at 1.2 Hz than slower eye movements at 0.8 Hz. van den Hout et al. used a sinusoidal horizontal dot movement that slowed near the edges to reduce eye strain and resemble therapist hand motion. The training manual recommends fast but comfortable, straight-across, steady movement.

van Veen et al. used a white dot on a black screen in both eye-movement conditions. This is useful precedent for visual bilateral stimulation, but it is not evidence that a black background is clinically superior to a white background. General display-polarity research often favors dark content on a light background for reading and fine-detail visual performance, likely because higher display luminance reduces pupil size and sharpens detail. That evidence does not directly transfer to this app's task, where the user tracks a large moving target while recalling material rather than reading or proofreading.

The sources do not establish that constant linear velocity is superior to sinusoidal movement. They also do not establish a universal speed, background polarity, or dot color for every user or clinical scenario.

## Decision

Use sinusoidal horizontal motion as the default visual bilateral stimulation pattern.

Use 1.2 Hz as the default speed, interpreted as 1.2 complete left-right-left cycles per second.

Render the stimulation path across the full available viewport while keeping the dot center inside the visible bounds.

During an active stimulation set, render a blank black stimulation field behind the dot and hide room artwork, decorative motion, and non-control visual content.

Prefer a light, high-contrast dot on the black stimulation field. Keep dot color configurable.

Keep speed configurable so the user can reduce or increase the working-memory load for comfort and tolerance.

## Consequences

- The default avoids endpoint pauses while preserving a smooth reversal at the edges.
- The default prioritizes a researched faster speed without hard-coding it as clinically correct for every user.
- The renderer should derive travel distance from the actual viewport dimensions, including fullscreen dimensions.
- The active stimulation view reduces visual distractions and overall screen luminance, while preserving display contrast for eye tracking.
- A future light-background mode would be a usability option, not a research-backed clinical improvement unless stronger evidence is reviewed.
- Future changes to stimulation modality, speed ranges, motion curves, or claims about clinical optimization need a new ADR or an update to this ADR.
