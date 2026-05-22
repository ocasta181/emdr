# ADR 0005: Light Stimulation Field

## Status

Accepted

## Context

ADR 0004 selected a blank black stimulation field with a light ball because several EMDR analogue studies used a white dot on a black screen. That was too strong a product conclusion. Those studies establish a commonly studied setup, but they do not compare black-background/light-target stimulation against white-background/dark-target stimulation.

The relevant reviewed evidence is:

- van Veen et al., "Speed matters: relationship between speed of eye movements and modification of aversive autobiographical memories": https://www.frontiersin.org/journals/psychiatry/articles/10.3389/fpsyt.2015.00045/full
- Mertens et al., "Verbal suggestions fail to modulate expectations about the effectiveness of a laboratory model of EMDR therapy": https://www.sciencedirect.com/science/article/pii/S0005791621000380
- Goliskina et al., "The Effect of Stimulus Contrast and Spatial Position on Saccadic Eye Movement Parameters": https://www.mdpi.com/2411-5150/7/4/68
- Kaiser Permanente visual bilateral-stimulation implementation, as observed by the product owner: light background, dark moving ball, and full-screen end-to-end traversal.

The EMDR studies support using a high-contrast moving target and a blank low-distraction field, but they do not establish a superior background polarity or ball color. General saccadic-eye-movement research likewise supports avoiding low-contrast targets, but it does not establish that black-background/light-target or light-background/dark-target polarity is clinically superior for EMDR bilateral stimulation.

Kaiser Permanente is not being treated as outcome evidence. It is being used as a healthcare-product precedent for a conservative visual default: blank light field, dark high-contrast target, and full-screen end-to-end movement.

## Decision

Use a blank light stimulation field during active visual bilateral stimulation.

Use a dark, high-contrast ball by default.

Keep the ball traveling end-to-end across the available fullscreen viewport, while keeping the ball center inside the visible bounds.

Do not constrain traversal width unless future evidence or explicit product direction supports doing so.

Keep room artwork, decorative motion, and non-control visual content hidden during an active stimulation set.

## Consequences

- The active set remains visually simple and low-distraction.
- The app aligns with the Kaiser Permanente implementation pattern supplied as product precedent.
- The app does not claim that light-background/dark-ball polarity is clinically superior.
- Future changes to background polarity, target color, or traversal width must distinguish clinical evidence from product precedent.
