"use strict";

// coverGenerator/utils.js
// Deterministic helpers used across the generator.
// - normalizeSeed: stable uint32 seed from number/string/fallback
// - createRng: small fast PRNG for reproducible randomness

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hashSeed(input) {
  const str = String(input);
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeSeed(seedInput, fallbackKey) {
  // Normalize to uint32.
  if (seedInput === 0) return 0;
  if (typeof seedInput === "number" && Number.isFinite(seedInput)) {
    return seedInput >>> 0;
  }
  if (typeof seedInput === "string" && seedInput.trim().length) {
    return hashSeed(seedInput.trim());
  }
  return hashSeed(fallbackKey || Date.now());
}

function createRng(seed) {
  // Mulberry32 PRNG.
  let state = seed >>> 0;
  return function rng() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngInt(min, max, rng) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomChoice(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

function resolveAvatarSizeV2Rule(options, scale) {
  const outerPadding = Math.round(70 * scale);
  const cardW = Math.round(options.width * 0.64);
  const cardX = options.width - outerPadding - cardW;
  const leftAreaW = Math.max(outerPadding, cardX - outerPadding);
  const preferredSize = Math.round(Math.min(leftAreaW * 0.62, options.height * 0.42));
  return clamp(preferredSize, Math.round(170 * scale), Math.round(340 * scale));
}

function resolveScaledAvatarSize(options, scale, ratio, minSize, maxSize) {
  const base = resolveAvatarSizeV2Rule(options, scale);
  return clamp(
    Math.round(base * ratio),
    Math.round(minSize * scale),
    Math.round(maxSize * scale)
  );
}

module.exports = {
  clamp,
  createRng,
  hashSeed,
  normalizeSeed,
  randomChoice,
  resolveScaledAvatarSize,
  resolveAvatarSizeV2Rule,
  rngInt
};
