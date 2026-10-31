#!/usr/bin/env python3
"""Run a source-built, real Subtensor localnet on macOS without containers.

Commands mirror RaoFoundation/subtensor scripts/localnet.sh; data stays in a
TensorStudio-owned folder. This does not compile a node or install prerequisites.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / '.localnet' / 'data'
# Operational guard, not an upstream build-size guarantee.
BUILD_FREE_GIB = 20
RUN_FREE_GIB = 2


def tool_output(args):
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=15)
        return result.stdout.strip() if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def preflight(binary):
    free = shutil.disk_usage(ROOT).free / 1024**3
    targets = tool_output(['rustup', 'target', 'list', '--installed']) or ''
    rosetta = subprocess.run(['/usr/bin/arch', '-x86_64', '/usr/bin/true'], capture_output=True).returncode == 0 if sys.platform == 'darwin' else None
    report = {
        'platform': sys.platform,
        'free_gib': round(free, 2),
        'binary_available': bool(binary and binary.is_file() and os.access(binary, os.X_OK)),
        'rust': tool_output(['rustc', '--version']),
        'wasm_target_installed': 'wasm32v1-none' in targets,
        'rosetta_available': rosetta,
        'openssl_available': Path('/opt/homebrew/opt/openssl').exists() or Path('/opt/homebrew/opt/openssl@3').exists(),
        'build_space_guard_gib': BUILD_FREE_GIB,
        'run_space_guard_gib': RUN_FREE_GIB,
    }
    report['ready_to_run'] = report['binary_available'] and free >= RUN_FREE_GIB
    print(json.dumps(report, indent=2))
    return report


def run(binary):
    # Reject conflicts before touching files or starting any process.
    sockets = []
    try:
        for port in (9944, 9945, 9946, 30334, 30335, 30336):
            sock = socket.socket()
            sockets.append(sock)
            sock.bind(('127.0.0.1', port))
    except OSError:
        raise SystemExit('A localnet port is already occupied. Stop the existing node before starting another.')
    finally:
        for sock in sockets:
            sock.close()
    DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(DATA, 0o700)
    spec = DATA / 'local.json'
    if not spec.exists():
        # Write atomically; never replace the genesis for existing chain data.
        temporary = DATA / 'local.json.tmp'
        try:
            with temporary.open('w') as target:
                subprocess.run([str(binary), 'build-spec', '--disable-default-bootnode', '--raw', '--chain', 'local'], stdout=target, check=True)
            json.loads(temporary.read_text())
            temporary.replace(spec)
        finally:
            temporary.unlink(missing_ok=True)
    # Same dev authority identities as the official source launcher.
    third = DATA / 'three'
    for scheme, key_type in [('Sr25519', 'aura'), ('Ed25519', 'gran')]:
        subprocess.run([str(binary), 'key', 'insert', '--base-path', str(third), '--chain', str(spec), '--scheme', scheme, '--suri', '//Three', '--key-type', key_type], check=True)
    processes = []
    stopping = False

    def stop(*_):
        nonlocal stopping
        if stopping:
            return
        stopping = True
        for process in processes:
            if process.poll() is None:
                process.terminate()
        deadline = time.monotonic() + 15
        for process in processes:
            try:
                process.wait(timeout=max(.1, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        for index, authority in enumerate(('one', 'two', 'three')):
            args = [str(binary), '--base-path', str(DATA / authority), '--chain', str(spec),
                    '--port', str(30334 + index), '--rpc-port', str(9944 + index), '--validator',
                    '--rpc-cors=http://localhost:5173,http://127.0.0.1:5173', '--allow-private-ipv4',
                    '--discover-local', '--unsafe-force-node-key-generation']
            args += ['--name', 'Three'] if authority == 'three' else ['--' + authority]
            processes.append(subprocess.Popen(args))
        print('Native localnet starting. RPC: ws://127.0.0.1:9944. Ctrl-C stops these three authorities.', flush=True)
        while not stopping:
            failed = next((p.returncode for p in processes if p.poll() is not None), None)
            if failed is not None:
                raise SystemExit(f'Authority exited ({failed}); stopping the remaining nodes.')
            time.sleep(.5)
    finally:
        stop()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--binary', type=Path, help='Native macOS node-subtensor built with localnet features')
    parser.add_argument('--run', action='store_true', help='Start real authorities after checking prerequisites')
    args = parser.parse_args()
    binary = args.binary.expanduser().resolve() if args.binary else None
    report = preflight(binary)
    if args.run:
        if not report['ready_to_run']:
            raise SystemExit('Localnet not started: provide a native binary and at least 2 GiB free disk. See docs/LOCALNET-M3.md.')
        run(binary)
    elif not report['ready_to_run']:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
