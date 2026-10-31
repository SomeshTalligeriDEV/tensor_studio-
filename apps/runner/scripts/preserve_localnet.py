"""One-time migration for legacy managed containers created without --no-purge."""
import io
import tarfile
import docker

client = docker.from_env(timeout=30)
try:
    node = client.containers.get('bitcode-localnet')
    assert node.labels.get('studio.bitcode.managed') == 'true'
    stream, _ = node.get_archive('/scripts/localnet.sh')
    with tarfile.open(fileobj=io.BytesIO(b''.join(stream))) as source:
        original = source.extractfile(source.getmembers()[0]).read()
    old = b'NO_PURGE=0\n'
    if old not in original:
        assert b'NO_PURGE=1\n' in original
        print('Localnet startup already preserves chain data.')
    else:
        # Keep an unmodified backup inside the same managed container.
        archive = io.BytesIO()
        with tarfile.open(fileobj=archive, mode='w') as output:
            for name, data in [('localnet.sh.bitcode-original', original), ('localnet.sh', original.replace(old, b'NO_PURGE=1\n', 1))]:
                entry = tarfile.TarInfo(name)
                entry.mode = 0o755
                entry.size = len(data)
                output.addfile(entry, io.BytesIO(data))
        assert node.put_archive('/scripts', archive.getvalue())
        print('Legacy localnet startup now preserves chain data; original script backed up in container.')
finally:
    client.close()
