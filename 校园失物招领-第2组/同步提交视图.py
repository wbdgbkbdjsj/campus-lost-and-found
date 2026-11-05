# -*- coding: utf-8 -*-
"""
同步提交视图：把过程目录的成果复制进指导书要求的 src / model / doc 三目录。

依据：老师《软件工程课程设计指导书》三·作业一
  「在版本库中建立三个目录 src、model、doc，分别存储软件系统的源代码、UML 模型和软件文档」

组长裁决（方案 A，2026-11-05）：
  - 原中文过程目录**一律不动、不删、不改名**，继续作为组内工作留痕；
  - src / model / doc 是**唯一正式提交视图**，评审/头歌平台以此为准；
  - 改了原件后，重跑本脚本一次即可同步，避免复制品漂移。

用法：cd 校园失物招领-第2组 && python 同步提交视图.py
特性：幂等（可反复执行）、跳过构建产物与缓存、覆盖式复制、只写三目录内。
"""
import os
import shutil
import sys

sys.stdout.reconfigure(encoding='utf-8')
BASE = os.path.dirname(os.path.abspath(__file__))

SKIP_DIRS = {'node_modules', 'dist', 'target', '__pycache__', '.git', '.venv', '.vite', '.idea'}
SKIP_EXTS = {'.db', '.pyc', '.class', '.jar', '.war', '.log', '.tmp'}

# ---------- 映射表 ----------
# 目录 → 目录：整目录复制
DIR_MAP = {
    # ---- src：三块源码实体 ----
    'src/lost-found-prototype': '02-李子研/05_源码',
    'src/lost-found-web': '04-邓昌兴/lost-found-web',
    'src/lost-found-server': '03_批次0-邓昌兴/lost-found-server',
    # ---- model：设计模型（9 张）与界面原型（6 张真截图）----
    'model/设计模型': '02-李子研/设计模型',
    'model/界面原型': '02-李子研/05_源码/screenshots',
}

# 文件 → 文件：单文件复制
FILE_MAP = {
    # ---- model：需求 4 图 ----
    'model/需求模型/用例图.md': '01_批次0-阴亮/用例图.md',
    'model/需求模型/需求4图-补齐3张.md': '04_图表与交叉材料/需求4图-补齐3张.md',
    # ---- doc：5 项必交物相关 ----
    'doc/01-软件需求规格说明书.md': '03_六份交付材料/需求说明书.md',
    'doc/02-软件设计规格说明书.md': '02-李子研/设计说明书.md',
    'doc/03-总体设计报告.md': '03_六份交付材料/总体设计报告.md',
    'doc/04-测试报告.md': '02-欧阳昊添/测试报告.md',
    'doc/04a-测试报告-三层测试回填块.md': '04_图表与交叉材料/测试报告-三层测试回填块.md',
    'doc/04b-测试执行记录-本机复跑24项全绿.txt': '04_图表与交叉材料/测试执行记录-本机复跑24项全绿.txt',
    'doc/05-测试用例表.md': '02-欧阳昊添/测试用例表.md',
    'doc/06-情况记录表.md': '02-欧阳昊添/情况记录表.md',
    'doc/07-产品宣传彩页.pdf': '07_提交包/产品宣传彩页.pdf',
    'doc/08-实践工作自评报告-模板.md': '00_任务总览/实践工作自评报告-模板.md',
    # ---- doc：口径与交叉材料 ----
    'doc/10-术语表-v1.md': '03_六份交付材料/术语表-v1.md',
    'doc/11-全组约定与编号总则-v1.md': '03_六份交付材料/全组约定与编号总则-v1.md',
    'doc/12-接口契约-v1.md': '02-李子研/api-contract-v1.md',
    'doc/13-需求-设计对照表.md': '02-李子研/需求-设计对照表.md',
    'doc/14-接口-代码检查表.md': '02-李子研/接口-代码检查表.md',
    'doc/15-老师指导书-提交要求核对与整改清单.md': '00_任务总览/老师指导书-提交要求核对与整改清单.md',
    'doc/16-今夜派工单.md': '00_任务总览/今夜派工单-补齐必交物与演示.md',
    'doc/17-工作量比例-proposal.md': '00_任务总览/工作量比例-proposal.md',
    # ---- doc：演示与答辩 ----
    'doc/20-演示脚本.md': '06_答辩与演示/演示脚本-v0.md',
    'doc/21-答辩题库.md': '06_答辩与演示/答辩题库.md',
    'doc/22-PPT大纲.md': '02-欧阳昊添/PPT大纲.md',
    'doc/23-PPT故事线.md': '06_答辩与演示/PPT故事线.md',
    'doc/24-答辩讲稿框架.md': '06_答辩与演示/答辩讲稿框架.md',
    'doc/25-答辩PPT-第2组.pptx': '02-欧阳昊添/答辩PPT-第2组.pptx',
}


def _ignore(dirname, names):
    out = []
    for n in names:
        if n in SKIP_DIRS:
            out.append(n)
        elif os.path.splitext(n)[1].lower() in SKIP_EXTS:
            out.append(n)
    return out


def copy_dir(src, dst):
    if not os.path.isdir(src):
        print('  [SKIP] 源目录不存在: %s' % src)
        return 0
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copytree(src, dst, ignore=_ignore, dirs_exist_ok=True)
    n = sum(len(f) for _, _, f in os.walk(dst))
    print('  [DIR ] %-46s <- %-40s %3d 文件' % (dst, src, n))
    return n


def copy_file(src, dst):
    if not os.path.isfile(src):
        print('  [SKIP] 源文件不存在: %s' % src)
        return 0
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    print('  [FILE] %-46s <- %s' % (dst, src))
    return 1


def clean_runtime():
    """清掉目标目录里偶然产生的运行产物（冒烟会生成 .db / __pycache__）。"""
    removed = 0
    for root in ('src', 'model', 'doc'):
        if not os.path.isdir(root):
            continue
        for dp, dns, fns in os.walk(root):
            for n in list(dns):
                if n == '__pycache__':
                    shutil.rmtree(os.path.join(dp, n))
                    dns.remove(n)
                    removed += 1
            for n in fns:
                if os.path.splitext(n)[1].lower() in {'.db', '.pyc', '.log', '.tmp'}:
                    os.remove(os.path.join(dp, n))
                    removed += 1
    return removed


def main():
    os.chdir(BASE)
    print('=' * 100)
    print('同步提交视图 → src / model / doc（方案 A：只复制，不动原目录）')
    print('=' * 100)
    total = 0
    print('\n[目录映射]')
    for dst, src in DIR_MAP.items():
        total += copy_dir(src, dst)
    print('\n[文件映射]')
    for dst, src in FILE_MAP.items():
        total += copy_file(src, dst)
    removed = clean_runtime()
    if removed:
        print('  [清理] 移除运行产物 %d 项（.db / .pyc / .log / __pycache__）' % removed)

    print('\n' + '-' * 100)
    for d in ('src', 'model', 'doc'):
        n = sum(len(f) for _, _, f in os.walk(d)) if os.path.isdir(d) else 0
        size = sum(os.path.getsize(os.path.join(dp, f))
                   for dp, _, fs in os.walk(d) for f in fs) if os.path.isdir(d) else 0
        print('  %-6s %3d 文件  %8.1f KB' % (d + '/', n, size / 1024))
    print('-' * 100)
    print('共复制 %d 个文件。原中文过程目录未做任何修改。' % total)
    print('提示：改了原件后重跑本脚本；提交前请确认三目录内 README 仍准确。')


if __name__ == '__main__':
    main()
