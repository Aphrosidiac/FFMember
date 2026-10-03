#!/usr/bin/env python3
"""diff.py — numeric visual diff between two screenshot folders (reference vs ours).

    python3 diff.py docs/reference/2026-09-24/shots docs/qa/shots [--suffix 1440]
            [--mask x,y,w,h ...] [--side] [--crop]

For every PNG in the reference folder (optionally only names ending -<suffix>.png) with a
same-named file in ours, prints:
  mean  — mean absolute difference, 0-255, on a 2px sample grid
  >24   — share of pixels differing by more than 24 (what a person notices)
and writes a 4x-amplified heat image to <ours>/diff/<name>, plus a side-by-side
(reference | ours) in <ours>/side/<name> with --side. Ends with the average and the worst.

Reading the numbers (from six clones):
  <= 1     identical bar anti-aliasing and brand copy
  1 - 3    small real differences — usually brand-copy reflow; look at the heat image
  > 3      something is actually different: a missing section, a wrong state, a mistimed
           animation — or the instrument (see below)

Before calling a spike a defect, open the side-by-side:
  - a lazy-loading reference photographs placeholder plates, not images;
  - a timed element (rotating logo, clock, video frame) differs every run — --mask it;
  - two captures run at once stretch animation clocks; recapture one at a time;
  - AVG 0.00 on the first try means the harness compared a folder with itself.

Full-page shots of different heights are compared over the shared height with --crop,
and the height difference is reported — it is a finding in its own right.
"""
import argparse
import os
import sys

try:
    from PIL import Image, ImageChops, ImageDraw
except ImportError:
    sys.exit("needs Pillow: python3 -m pip install Pillow")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ref")
    ap.add_argument("ours")
    ap.add_argument("--suffix", default="", help="only compare names ending -<suffix>.png")
    ap.add_argument("--mask", action="append", default=[], metavar="x,y,w,h",
                    help="rectangle excluded from both images (repeatable)")
    ap.add_argument("--side", action="store_true", help="also write side-by-side images")
    ap.add_argument("--crop", action="store_true", help="compare different-height images over the shared height")
    ap.add_argument("--threshold", type=int, default=24)
    args = ap.parse_args()

    if os.path.abspath(args.ref) == os.path.abspath(args.ours):
        sys.exit("ref and ours are the same folder — that is the 0.00 lie")

    masks = [tuple(int(v) for v in m.split(",")) for m in args.mask]
    end = f"-{args.suffix}.png" if args.suffix else ".png"
    names = sorted(f for f in os.listdir(args.ref) if f.endswith(end) and not f.startswith("diff-"))
    os.makedirs(os.path.join(args.ours, "diff"), exist_ok=True)
    if args.side:
        os.makedirs(os.path.join(args.ours, "side"), exist_ok=True)

    rows, missing = [], 0
    for n in names:
        a, b = os.path.join(args.ref, n), os.path.join(args.ours, n)
        if not os.path.exists(b):
            print(f"{n:40s} MISSING in ours")
            missing += 1
            continue
        A = Image.open(a).convert("RGB")
        B = Image.open(b).convert("RGB")
        note = ""
        if A.size != B.size:
            if args.crop and A.width == B.width:
                h = min(A.height, B.height)
                note = f"  height {A.height} vs {B.height}"
                A, B = A.crop((0, 0, A.width, h)), B.crop((0, 0, B.width, h))
            else:
                print(f"{n:40s} size {A.size} vs {B.size}" + ("" if args.crop else "  (--crop to compare shared height)"))
                continue
        for (x, y, w, h) in masks:
            for im in (A, B):
                ImageDraw.Draw(im).rectangle((x, y, x + w, y + h), fill=(0, 0, 0))
        d = ImageChops.difference(A, B).convert("L")
        small = d.resize((max(1, d.width // 2), max(1, d.height // 2)))
        hist = small.histogram()
        cnt = sum(hist)
        mean = sum(i * c for i, c in enumerate(hist)) / cnt
        big = sum(hist[args.threshold + 1:]) / cnt * 100
        d.point(lambda v: min(255, v * 4)).save(os.path.join(args.ours, "diff", n))
        if args.side:
            s = 0.5
            a2 = A.resize((int(A.width * s), int(A.height * s)))
            b2 = B.resize((int(B.width * s), int(B.height * s)))
            out = Image.new("RGB", (a2.width + b2.width + 8, max(a2.height, b2.height)), (255, 0, 0))
            out.paste(a2, (0, 0))
            out.paste(b2, (a2.width + 8, 0))
            out.save(os.path.join(args.ours, "side", n))
        rows.append((n, mean, big))
        print(f"{n:40s} mean {mean:6.2f}  >{args.threshold}: {big:5.2f}%{note}")

    if rows:
        avg = sum(r[1] for r in rows) / len(rows)
        worst = max(rows, key=lambda r: r[1])
        print(f"\n{len(rows)} compared, {missing} missing — AVG mean {avg:.2f}, worst {worst[0]} ({worst[1]:.2f})")
        if avg == 0:
            print("AVG is exactly 0 — suspect the harness before believing it.")
    else:
        print("nothing compared — check --suffix and that both folders were captured with the same names")
        sys.exit(1)


if __name__ == "__main__":
    main()
