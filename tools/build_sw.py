#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# 改版後要做什麼：改完跑一次 py -3 tools/build_sw.py 2026fukuoka；忘了跑，連網的手機仍會更新文字內容，只有換掉同檔名的圖片才一定要跑。

import os
import sys
import hashlib
import re

def get_target_path(repo_root, target_dir):
    if os.path.isabs(target_dir):
        return os.path.normpath(target_dir)
    rel_cwd = os.path.abspath(target_dir)
    if os.path.exists(rel_cwd):
        return rel_cwd
    return os.path.normpath(os.path.join(repo_root, target_dir))

def collect_files(target_path):
    files = []
    # 1. './' corresponds to index.html on disk
    if os.path.exists(os.path.join(target_path, 'index.html')):
        files.append('./')

    # 2. Text assets at target root
    for fname in sorted(os.listdir(target_path)):
        full = os.path.join(target_path, fname)
        if os.path.isfile(full):
            if fname in ('index.html', 'sw.js', 'autumn.css', 'onetake.html'):
                continue
            if fname.endswith(('.css', '.js', '.webmanifest', '.html')):
                files.append(fname)

    # 3. icons/
    icons_dir = os.path.join(target_path, 'icons')
    if os.path.exists(icons_dir):
        for fname in sorted(os.listdir(icons_dir)):
            if fname.endswith(('.png', '.ico', '.svg', '.webp')):
                files.append(f'icons/{fname}')

    # 4. img/
    img_dir = os.path.join(target_path, 'img')
    if os.path.exists(img_dir):
        for fname in sorted(os.listdir(img_dir)):
            if fname.endswith(('.jpg', '.jpeg', '.png', '.webp', '.svg')):
                files.append(f'img/{fname}')

    # 5. film cover image (film/poster-wide.jpg)
    film_poster = os.path.join(target_path, 'film', 'poster-wide.jpg')
    if os.path.exists(film_poster):
        files.append('film/poster-wide.jpg')

    # Sort deterministically with './' first
    rest = sorted([f for f in files if f != './'])
    return ['./'] + rest

def compute_hash(target_path, files):
    hasher = hashlib.sha256()
    for rel_path in files:
        disk_name = 'index.html' if rel_path == './' else rel_path
        disk_path = os.path.join(target_path, os.path.normpath(disk_name))
        hasher.update(rel_path.encode('utf-8'))
        hasher.update(b'\0')
        with open(disk_path, 'rb') as f:
            hasher.update(f.read())
        hasher.update(b'\0')
    return hasher.hexdigest()[:12]

def main():
    check_mode = '--check' in sys.argv
    args = [a for a in sys.argv[1:] if a != '--check']

    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)

    target_dir = args[0] if args else '2026fukuoka'
    target_path = get_target_path(repo_root, target_dir)

    if not os.path.isdir(target_path):
        print(f"Error: target directory '{target_path}' not found.", file=sys.stderr)
        sys.exit(1)

    sw_path = os.path.join(target_path, 'sw.js')
    if not os.path.exists(sw_path):
        print(f"Error: '{sw_path}' not found.", file=sys.stderr)
        sys.exit(1)

    files = collect_files(target_path)
    calc_hash = compute_hash(target_path, files)

    with open(sw_path, 'r', encoding='utf-8') as f:
        content = f.read()

    prefix_match = re.search(r"const\s+PREFIX\s*=\s*'([^']+)';", content)
    prefix = prefix_match.group(1) if prefix_match else f"mytrips-{os.path.basename(target_path)}-"

    cache_match = re.search(r"const\s+CACHE\s*=\s*PREFIX\s*\+\s*'([^']+)';", content)
    current_hash = cache_match.group(1) if cache_match else None

    # Parse current FILES in sw.js
    files_match = re.search(r"const\s+FILES\s*=\s*\[([\s\S]*?)\];", content)
    current_files = []
    if files_match:
        current_files = [m.group(1) for m in re.finditer(r"'([^']+)'", files_match.group(1))]

    if check_mode:
        mismatches = []
        if current_hash != calc_hash:
            mismatches.append(f"CACHE hash mismatch: current '{current_hash}' != calculated '{calc_hash}'")
        if current_files != files:
            mismatches.append(f"FILES mismatch: current ({len(current_files)}) != calculated ({len(files)})")

        if mismatches:
            for m in mismatches:
                print(f"[CHECK FAILED] {m}", file=sys.stderr)
            sys.exit(1)
        else:
            print(f"[OK] Service worker cache version '{calc_hash}' is up to date ({len(files)} files).")
            sys.exit(0)

    # Update sw.js
    files_formatted = ",\n".join(f"  '{f}'" for f in files)
    new_content = re.sub(
        r"(const\s+CACHE\s*=\s*PREFIX\s*\+\s*')[^']+(';)",
        rf"\g<1>{calc_hash}\g<2>",
        content
    )
    new_content = re.sub(
        r"(const\s+FILES\s*=\s*\[)[\s\S]*?(\];)",
        rf"\g<1>\n{files_formatted}\n\g<2>",
        new_content
    )

    with open(sw_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(new_content)

    print(f"[UPDATED] {sw_path}")
    print(f"  CACHE: {prefix}{calc_hash}")
    print(f"  FILES: {len(files)} entries")

if __name__ == '__main__':
    main()
