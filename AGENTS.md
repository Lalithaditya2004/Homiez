# Agent Design Spec

## Overview

Design a mobile-first finance dashboard UI inspired by premium dark-mode ledger apps. The interface should feel calm, tactile, minimal, and slightly futuristic without looking flashy. Prioritize soft contrast, rounded geometry, restrained color use, and dense-but-readable information layout.

## Visual Style

- Use a nearly-black charcoal background, not pure black. Main surfaces should sit in a tight tonal range with subtle separation between page background, cards, and controls.
- Create depth with soft inner and outer shadows rather than strong borders. Components should feel gently embossed or inset, similar to neumorphism but more refined and realistic.
- Use large rounded corners throughout. Most cards should feel pill-like or capsule-inspired, with rounded bottoms tabs and segmented controls echoing the same geometry.
- Keep the interface monochromatic except for one success accent, a vivid orange-red used for performance numbers and progress bars. Any additional category colors should appear only in tiny chart legends.

## Color System

- Background: deep charcoal black.
- Surface: slightly lighter charcoal.
- Elevated surface: one step lighter than surface.
- Stroke: ultra-low-contrast gray/orange tint, only when needed.
- Primary text: off-white.
- Secondary text: medium gray.
- Tertiary text: dim gray.
- Accent positive: vibrant orange-red.
- Data accents: blue, yellow, pink, gray for allocation labels only.

Example palette:

- `bg`: `#201E1F`
- `surface`: `#2A2729`
- `surface-2`: `#353133`
- `stroke`: `rgba(255, 64, 0, 0.06)`
- `text`: `#F3F3F3`
- `text-muted`: `#A1A1A1`
- `text-faint`: `#6F6F6F`
- `orange-red`: `#FF4000`
- `blue`: `#2F7CF6`
- `yellow`: `#F4B400`
- `pink`: `#FF2D7A`
- `gray-dot`: `#BDBDBD`

## Tone

- Premium
- Quiet
- Technical
- Trustworthy
- Minimal
- Tactile
- Mobile-native

## Avoid

- Bright gradients
- Glassmorphism
- Overly colorful cards
- Hard borders
- White backgrounds
- Large illustrations
- Marketing-style hero copy
- Excessive chart clutter
- Generic SaaS dashboard spacing

## Typography

- Use a clean modern sans-serif such as Inter, SF Pro, Geist, or Satoshi.
- Emphasize hierarchy through size and weight, not color.
- Large balance numbers should be bold and prominent.
- Section labels should be medium weight.
- Supporting metadata should be smaller and muted.
- Avoid decorative fonts, wide tracking, or oversized headlines.

Suggested type scale:

- Greeting title: `32-36px`, semibold
- Account subtitle: `14-16px`, regular
- Portfolio value: `48-56px`, bold
- Primary button label: `16-18px`, medium
- Card heading: `14-16px`, medium
- Main card metric: `20-24px`, semibold
- Tiny chip text: `13-14px`, medium
- Tab bar label: `11-12px`, medium
