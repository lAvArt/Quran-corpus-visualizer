# Confidence Model

This document governs any future claim layer beyond direct linguistic annotation.

## Purpose

When representing interpretive or spatial claims, each claim must be linked to evidence and confidence.

Graph pattern:

- `Ayah -> Claim -> Source -> Confidence`

## Claim Record Shape

- `claimId`: stable string ID
- `ayahId`: canonical ayah reference
- `claimType`: controlled vocabulary (event, place, timeline, thematic)
- `statement`: concise claim text
- `sourceRefs`: source IDs
- `confidence`: numeric score (0.0-1.0)
- `confidenceBand`: low | medium | high
- `notes`: optional rationale text

## Confidence Bands

- `high` (>= 0.80): multiple strong sources, low ambiguity
- `medium` (0.50-0.79): partial agreement or moderate ambiguity
- `low` (< 0.50): tentative or contested interpretation

## UI Rules

- Claims are optional overlays, never default display.
- Every claim must expose source links and confidence band.
- Users can filter by confidence threshold.
- Low-confidence claims must be visually distinct.

## Governance Rules

- No claim enters default datasets without source citations.
- Conflicting claims may co-exist with explicit source separation.
- Confidence scoring logic must be documented and reviewable.
