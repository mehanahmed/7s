# Minimalist Google Gemini-Style License Activation UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/license` to match the minimalist Google Gemini aesthetic from the user's reference image, featuring the rainbow question-sparkle badge, clean typography, white rounded card input with inline action, and matching minimalist activated state.

**Architecture:** Update `src/app/license/page.tsx` with a modern client component utilizing Tailwind CSS for the `#f0f4f9` canvas, custom SVG gradient badge, borderless multi-line key entry inside a rounded card, and graceful error/success transitions, fully wired to existing Server Actions.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide React, existing `license-service.ts`.

---

## Global Constraints
- Canvas background must strictly match `#f0f4f9`.
- Typography and copy must strictly reproduce the screenshot:
  - Subtitle: `activation required`
  - Heading: `Enter the activation license key`
  - Placeholder: `enter the activation key`
- Must preserve all existing cryptographic verification logic in `actions.ts` and `license-service.ts`.
- Zero broken imports or TypeScript compile errors.
- Fully responsive across mobile (touch) and desktop viewports.

---

## Tasks

### Task 1: Build the Custom Google Gemini-Style SVG Badges
- [ ] Define the SVG components with crisp viewBox and scalable vectors.
- [ ] Verify render against uploaded screenshot.

### Task 2: Redesign the Unactivated Entry Flow in `src/app/license/page.tsx`
- [ ] Replace dark slate background with `#f0f4f9`.
- [ ] Add subtitle `activation required` and title `Enter the activation license key`.
- [ ] Implement the white `rounded-3xl` card containing:
  - Borderless auto-resizing textarea with placeholder `enter the activation key`.
  - Inline submit button at the bottom-right corner of the card (subtle circle with arrow/key icon, disabled state, and loading spinner).
  - Keyboard shortcut: `Enter` to submit, `Shift+Enter` for newline.
- [ ] Add clean floating error banner for invalid license key attempts.
- [ ] Add detected host indicator at the bottom.

### Task 3: Redesign the Activated State in `src/app/license/page.tsx`
- [ ] For activated domains (or after successful activation), render matching Gemini-style white card with:
  - Rainbow-accented success badge.
  - License details (Host, Client, Expiration).
  - "Continue to Dashboard" primary button.
  - "Log In" secondary button.

### Task 4: Verify End-to-End & Mobile Responsiveness
- [ ] Test TypeScript compilation (`tsc --noEmit`).
- [ ] Test with current active license and temporary invalid key input.
- [ ] Capture screenshot via browser or render preview.
