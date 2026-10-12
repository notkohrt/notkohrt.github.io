"""Create a deterministic ZIP of a verified, ordinary-file build directory."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import sys

root, destination = map(Path, sys.argv[1:])
try:
    with destination.open('xb') as output:
        try:
            with ZipFile(output, 'w', compression=ZIP_DEFLATED) as archive:
                for file in sorted(root.rglob('*')):
                    if file.is_symlink():
                        raise ValueError('Bundle must not contain symlinks')
                    if file.is_dir():
                        continue
                    if not file.is_file():
                        raise ValueError('Bundle must contain ordinary files')
                    info = ZipInfo(file.relative_to(root).as_posix(), date_time=(1980, 1, 1, 0, 0, 0))
                    info.compress_type = ZIP_DEFLATED
                    info.create_system = 3
                    info.external_attr = 0o100644 << 16
                    archive.writestr(info, file.read_bytes())
        except BaseException:
            destination.unlink()
            raise
except FileExistsError:
    sys.exit('ZIP output already exists; choose a new output path to preserve it.')
