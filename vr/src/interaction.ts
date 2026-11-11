/**
 * Component declarations (system-free, so the IWSDK editor can import them).
 * `Clickable` marks entities whose ray/pinch presses and hovers are routed to a handler
 * by ClickSystem (src/clicks.ts). `WordTile` marks a Build a Sentence tile.
 */
import { createComponent, Types } from '@iwsdk/core';

export const Clickable = createComponent('Clickable', {
  enabled: { type: Types.Boolean, default: true },
});

export const WordTile = createComponent('WordTile', {
  /** Index into the current sentence's token list. */
  token: { type: Types.Int16, default: 0 },
  /** Slot index the tile sits in, or -1 when it is on the desk tray. */
  slot: { type: Types.Int16, default: -1 },
});
