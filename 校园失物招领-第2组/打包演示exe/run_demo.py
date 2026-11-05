# -*- coding: utf-8 -*-
"""校园失物招领与认领审核系统 · 演示启动器

用途：
  - 源码形态：在本目录执行 `python run_demo.py` 即可起服务（与 `uvicorn main:app` 等价，但会自动开浏览器）。
  - 打包形态：由 PyInstaller 打成单个 exe 后，双击即起服务 + 自动打开浏览器，现场免装 Python。

行为：
  - 监听 127.0.0.1:8000（仅本机，演示足够且避免暴露端口）。
  - 数据库 lostfound.db 落在「可执行文件所在目录」，保证可写且持久（不落在临时解压目录）。
  - 前端静态目录 web/ 由 main.py 以脚本目录为基准定位，打包后由 PyInstaller 注入到 _MEIPASS，无需改代码。
  - 关闭控制台窗口即停止服务。
"""
import os
import sys
import webbrowser
import threading
import time

FROZEN = getattr(sys, "frozen", False)
PORT = 8000

# 决定原型代码所在目录
if FROZEN:
    # 打包后：main/service/models/state_machine/web 都被 PyInstaller 收集到 _MEIPASS
    BUNDLE_DIR = sys._MEIPASS
else:
    HERE = os.path.dirname(os.path.abspath(__file__))
    PROTO = os.path.normpath(os.path.join(HERE, "..", "src", "lost-found-prototype"))
    if PROTO not in sys.path:
        sys.path.insert(0, PROTO)
    BUNDLE_DIR = PROTO

# 工作目录切到「可执行文件所在目录」，让 SQLite 落在可写且持久的位置
if FROZEN:
    os.chdir(os.path.dirname(sys.executable))
else:
    os.chdir(PROTO)


def _open_browser():
    url = "http://127.0.0.1:%d/" % PORT
    # 等服务起来后再开，最多重试若干次
    for i in range(10):
        try:
            webbrowser.open(url)
            break
        except Exception:
            time.sleep(1)


def main():
    import uvicorn
    threading.Thread(target=_open_browser, daemon=True).start()
    print("=" * 64)
    print("校园失物招领与认领审核系统 · 演示服务")
    print("浏览器将自动打开：http://127.0.0.1:%d/" % PORT)
    print("账号：stu001 / reviewer001 / super001（口令均为 123456）")
    print("关闭本窗口即停止服务。")
    print("=" * 64)
    try:
        uvicorn.run("main:app", host="127.0.0.1", port=PORT, log_level="info")
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
