# -*- coding: utf-8 -*-
"""打包交付包 —— 让三个交付容器与 src/ + doc/ 完全对齐。

背景：提交包 / submission-bundle / campus-lost-found-submission.zip 是手工打的，
      代码和文档一改就过期。此脚本把"同步源码 + 同步报告 + 重打 zip"变成一条命令。

用法（在本目录下）：
    python 打包交付包.py            # 执行打包
    python 打包交付包.py --check    # 只校验不写入

同步规则：
    源码  src/<x>  →  提交包/源码/<x>、submission-bundle/source_code/<x>
    文档  doc/<n>  →  见 DOC_MAP 映射表
    压缩  提交包/源码.zip、campus-lost-found-submission.zip 全量重建

排除（不进交付包）：node_modules、dist、.vite、__pycache__、.venv、venv、env、target、.git
                   *.db、*.pyc、*.log
"""
import os
import shutil
import sys
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
CHECK_ONLY = "--check" in sys.argv

# ---------------- 排除规则 ----------------
EXCL_DIRS = {
    "node_modules", "dist", ".vite", "__pycache__", ".git",
    ".idea", ".vscode", ".venv", "venv", "env", "target",
}
EXCL_EXTS = {".db", ".db-wal", ".db-shm", ".pyc", ".log"}


def _ignore(dirpath, names):
    skipped = []
    for n in names:
        full = os.path.join(dirpath, n)
        if os.path.isdir(full) and n in EXCL_DIRS:
            skipped.append(n)
        elif os.path.isfile(full) and os.path.splitext(n)[1].lower() in EXCL_EXTS:
            skipped.append(n)
    return skipped


# ---------------- 文档映射：doc/<n> → 各容器内的名字 ----------------
# (源文件, 目标路径列表)
DOC_MAP = [
    ("doc/01-软件需求规格说明书.md",
     ["提交包/课程设计报告/01-需求说明书.md",
      "submission-bundle/course_design_report/requirements_spec.md"]),
    ("doc/02-软件设计规格说明书.md",
     ["提交包/课程设计报告/02-设计说明书.md",
      "submission-bundle/course_design_report/design_spec.md"]),
    ("doc/03-总体设计报告.md",
     ["提交包/课程设计报告/03-总体设计报告.md",
      "submission-bundle/course_design_report/overall_design_report.md"]),
    ("doc/06-情况记录表.md",
     ["提交包/课程设计报告/04-情况记录表.md",
      "submission-bundle/course_design_report/process_record.md"]),
    ("doc/04-测试报告.md",
     ["提交包/补充材料/软件测试报告.md",
      "submission-bundle/supplementary/test_report.md"]),
    ("doc/07-产品宣传彩页.pdf",
     ["提交包/补充材料/产品宣传彩页.pdf",
      "submission-bundle/supplementary/promo_flyer.pdf"]),
    ("doc/25-答辩PPT-第2组.pptx",
     ["提交包/PPT/答辩PPT-第2组.pptx",
      "submission-bundle/defense_ppt.pptx"]),
]

# 答辩与演示支撑：doc/ 同名文件 → 提交包/补充材料/答辩与演示支撑/
SUPPORT_DOCS = [
    "08-实践工作自评报告-模板.md", "10-术语表-v1.md", "11-全组约定与编号总则-v1.md",
    "12-接口契约-v1.md", "13-需求-设计对照表.md", "14-接口-代码检查表.md",
    "15-老师指导书-提交要求核对与整改清单.md", "20-演示脚本.md", "21-答辩题库.md",
    "22-PPT大纲.md", "23-PPT故事线.md", "24-答辩讲稿框架.md",
]

# ---------------- 源码同步目标 ----------------
CODE_TARGETS = ["提交包/源码", "submission-bundle/source_code"]

# ---------------- 压缩包 ----------------
ZIPS = [
    # (zip 路径, 源目录, 包内前缀)
    ("提交包/源码.zip", "提交包/源码", "源码"),
    ("campus-lost-found-submission.zip", "submission-bundle", ""),
]


def human(n):
    for unit in ("B", "KB", "MB"):
        if n < 1024:
            return f"{n:.0f}{unit}" if unit == "B" else f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}GB"


def main():
    os.chdir(ROOT)
    problems = []

    if not os.path.isdir("src") or not os.path.isdir("doc"):
        sys.exit("找不到 src/ 或 doc/，请在项目根目录运行")

    print("=" * 78)
    print("一、同步源码  src/ → 提交包/源码、submission-bundle/source_code")
    print("=" * 78)
    for tgt in CODE_TARGETS:
        if CHECK_ONLY:
            print(f"  [跳过] {tgt}")
            continue
        shutil.copytree("src", tgt, dirs_exist_ok=True, ignore=_ignore)
        n = sum(len(f) for _, _, f in os.walk(tgt))
        print(f"  ✅ {tgt}  → {n} 个文件")

    print()
    print("=" * 78)
    print("二、同步报告文档  doc/ → 两个容器的对应位")
    print("=" * 78)
    for src, targets in DOC_MAP:
        if not os.path.isfile(src):
            problems.append(f"源文件缺失：{src}")
            print(f"  ❌ 源文件缺失：{src}")
            continue
        for tgt in targets:
            if CHECK_ONLY:
                print(f"  [跳过] {tgt}")
                continue
            os.makedirs(os.path.dirname(tgt) or ".", exist_ok=True)
            shutil.copy2(src, tgt)
            print(f"  ✅ {tgt:<58} ← {src}")

    print()
    print("=" * 78)
    print("三、同步答辩与演示支撑文档")
    print("=" * 78)
    support_dir = "提交包/补充材料/答辩与演示支撑"
    for name in SUPPORT_DOCS:
        src = os.path.join("doc", name)
        if not os.path.isfile(src):
            problems.append(f"支撑文档缺失：{src}")
            print(f"  ❌ 缺失：{src}")
            continue
        if not CHECK_ONLY:
            os.makedirs(support_dir, exist_ok=True)
            shutil.copy2(src, os.path.join(support_dir, name))
        print(f"  ✅ {name}")

    print()
    print("=" * 78)
    print("四、重建压缩包")
    print("=" * 78)
    for zip_path, base, prefix in ZIPS:
        if CHECK_ONLY:
            print(f"  [跳过] {zip_path}")
            continue
        if os.path.exists(zip_path):
            os.remove(zip_path)
        count = 0
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
            for dp, dns, fns in os.walk(base):
                dns[:] = [d for d in dns if d not in EXCL_DIRS]
                for fn in sorted(fns):
                    if os.path.splitext(fn)[1].lower() in EXCL_EXTS:
                        continue
                    full = os.path.join(dp, fn)
                    rel = os.path.relpath(full, base).replace("\\", "/")
                    arc = f"{prefix}/{rel}" if prefix else rel
                    z.write(full, arc)
                    count += 1
        print(f"  ✅ {zip_path:<40} {count} 个文件  {human(os.path.getsize(zip_path))}")

    print()
    print("=" * 78)
    print("五、校验（关键文件是否已是最新）")
    print("=" * 78)
    checks = [
        ("设计说明书（包内应为 576 行 v2.0）",
         ["提交包/课程设计报告/02-设计说明书.md",
          "submission-bundle/course_design_report/design_spec.md"]),
        ("认领页（包内应为 271 行，含 contact?.trim）",
         ["提交包/源码/lost-found-web/src/views/student/claim-apply/index.vue",
          "submission-bundle/source_code/lost-found-web/src/views/student/claim-apply/index.vue"]),
    ]
    for label, paths in checks:
        print(f"  {label}")
        for p in paths:
            if not os.path.isfile(p):
                print(f"    ❌ 不存在 {p}")
                problems.append(f"校验失败：{p} 不存在")
                continue
            with open(p, encoding="utf-8", errors="replace") as f:
                text = f.read()
            lines = len(text.splitlines())
            extra = ""
            if "claim?.trim" in label or "认领页" in label:
                extra = "  含最新修复" if "contact?.trim()" in text else "  ⚠️ 不含最新修复"
            elif "设计说明书" in label:
                extra = "  v2.0 ✅" if "v2.0" in text else "  ⚠️ 非 v2.0"
            print(f"    {lines:>4} 行  {p}{extra}")

    # zip 内抽查
    qa = [
        ("campus-lost-found-submission.zip",
         "source_code/lost-found-web/src/views/student/claim-apply/index.vue", "contact?.trim()"),
        ("提交包/源码.zip",
         "源码/lost-found-web/src/views/student/claim-apply/index.vue", "contact?.trim()"),
    ]
    print("\n  压缩包内抽查：")
    for zp, member, needle in qa:
        if not os.path.isfile(zp):
            continue
        try:
            with zipfile.ZipFile(zp) as z:
                text = z.read(member).decode("utf-8", "replace")
            ok = needle in text
            print(f"    {'✅' if ok else '❌'} {zp} :: {len(text.splitlines())} 行 "
                  f"{'含最新修复' if ok else '仍是旧版'}")
            if not ok:
                problems.append(f"{zp} 内文件仍为旧版")
        except KeyError:
            problems.append(f"{zp} 内找不到 {member}")
            print(f"    ❌ {zp} 内找不到 {member}")

    print()
    print("=" * 78)
    if problems:
        print(f"完成，但有 {len(problems)} 个问题：")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print("✅ 全部完成，三个交付容器与 src/ + doc/ 已对齐")
    print("=" * 78)


if __name__ == "__main__":
    main()
