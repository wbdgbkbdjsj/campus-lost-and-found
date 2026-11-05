# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['run_demo.py'],
    pathex=['../src/lost-found-prototype'],
    binaries=[],
    datas=[('../src/lost-found-prototype/web', 'web')],
    hiddenimports=['main', 'service', 'state_machine', 'models', 'uvicorn', 'uvicorn.logging', 'anyio', 'sqlalchemy', 'pydantic', 'fastapi', 'starlette'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='校园失物招领演示',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
