#!/usr/bin/env python3
"""
Apply Romanian translations to messages.ro.xlf.

Translations are authored natively (not machine-translated from EN) and follow
docs/content/content-playbook.md: no dashes as punctuation, no AI tells, real
Romanian idiom rather than calques.

Placeholders: a source may contain <x .../> tags (the amber-keyword <span>).
Write %1, %2 ... in the translation where the Nth <x/> tag of the source goes;
this script substitutes the exact tag markup so the target stays valid XLF.

Usage: python3 scripts/apply-ro.py <translations.json>
  where the JSON is { "<trans-unit id>": "<romanian with %1 markers>" }
"""
import json
import re
import sys

XLF = 'projects/website/src/locale/messages.ro.xlf'


def main() -> int:
    tr = json.load(open(sys.argv[1], encoding='utf-8'))
    xml = open(XLF, encoding='utf-8').read()

    applied, missing, skipped = 0, [], []

    def repl(m: re.Match) -> str:
        nonlocal applied
        head, body = m.group(1), m.group(2)
        uid = re.search(r'id="([^"]+)"', head).group(1)
        if uid not in tr:
            return m.group(0)

        src_m = re.search(r'<source>(.*?)</source>', body, re.S)
        if not src_m:
            skipped.append(uid)
            return m.group(0)
        source = src_m.group(1)

        # Pull the <x .../> tags out of the source, in order. Non-greedy up to
        # the closing "/>" because equiv-text attributes themselves contain
        # ">" (e.g. equiv-text="&lt;span class=&quot;text-brand&quot;>").
        tags = re.findall(r'<x\b.*?/>', source, re.S)
        text = tr[uid]
        for i, tag in enumerate(tags, start=1):
            text = text.replace(f'%{i}', tag)

        # Every placeholder must be accounted for or Angular fails the build.
        if re.search(r'%\d', text) or text.count('<x ') != len(tags):
            skipped.append(uid)
            return m.group(0)

        new_target = f'<target state="translated">{text}</target>'
        if re.search(r'<target[^>]*>.*?</target>', body, re.S):
            body = re.sub(r'<target[^>]*>.*?</target>', lambda _: new_target, body, count=1, flags=re.S)
        else:
            body = body.replace('</source>', f'</source>\n        {new_target}', 1)
        applied += 1
        return f'{head}{body}</trans-unit>'

    xml = re.sub(r'(<trans-unit\b[^>]*>)(.*?)</trans-unit>', repl, xml, flags=re.S)

    ids = set(re.findall(r'<trans-unit id="([^"]+)"', open(XLF, encoding='utf-8').read()))
    missing = [k for k in tr if k not in ids]

    open(XLF, 'w', encoding='utf-8').write(xml)
    print(f'applied   : {applied}/{len(tr)}')
    if skipped:
        print(f'SKIPPED (placeholder mismatch): {skipped}')
    if missing:
        print(f'NOT IN XLF: {missing}')
    return 1 if (skipped or missing) else 0


if __name__ == '__main__':
    sys.exit(main())
