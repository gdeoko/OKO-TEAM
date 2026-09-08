import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('rocket_integrate', Path(__file__).with_name('integrate.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.source, self.target = root / 'source', root / 'target'
        for p in [self.source / 'rocketvpn', self.target / 'rocketvpn']:
            p.mkdir(parents=True)
        (self.source / 'rocketvpn/app.js').write_bytes(b'new')
        (self.target / 'rocketvpn/app.js').write_bytes(b'old')
        (self.target / 'rocketvpn/texture.jpg').write_bytes(b'texture')
        self.row = {'path': 'rocketvpn/app.js', 'sha': mod.blob(b'new'), 'base_sha': mod.blob(b'old'), 'mode': '100644'}
        self.manifest = {'files': [self.row], 'required': ['rocketvpn/app.js', 'rocketvpn/texture.jpg']}

    def test_preserves_other_projects_docs_and_existing_files(self):
        others = {'index.html': b'other project', 'CLAUDE.md': b'project rules',
                  'rocketvpn/docs/SCENARIO.md': b'scenario', 'rocketvpn/tools/checks/check.mjs': b'check'}
        for name, data in others.items():
            dest = self.target / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        plan = mod.inspect(self.source, self.target, self.manifest)
        self.assertEqual((self.target / 'rocketvpn/app.js').read_bytes(), b'old')
        mod.apply(plan)
        self.assertEqual((self.target / 'rocketvpn/app.js').read_bytes(), b'new')
        for name, data in others.items():
            self.assertEqual((self.target / name).read_bytes(), data)
        self.assertEqual(mod.inspect(self.source, self.target, self.manifest), [])

    def test_parallel_edit_prevents_any_writes(self):
        (self.target / 'rocketvpn/app.js').write_bytes(b'parallel improvement')
        with self.assertRaisesRegex(ValueError, 'conflicts'):
            mod.inspect(self.source, self.target, self.manifest)
        self.assertEqual((self.target / 'rocketvpn/app.js').read_bytes(), b'parallel improvement')

    def test_requires_existing_project_assets(self):
        (self.target / 'rocketvpn/texture.jpg').unlink()
        with self.assertRaisesRegex(ValueError, 'missing_prerequisites'):
            mod.inspect(self.source, self.target, self.manifest)

    def test_rejects_paths_outside_rocket_and_symlink_parents(self):
        with self.assertRaises(ValueError):
            mod.safe(self.target, 'rocketvpn/../../index.html')
        (self.target / 'rocketcdn').symlink_to(self.source / 'rocketvpn', target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'Symlink'):
            mod.safe(self.target, 'rocketcdn/app.js')

    def test_source_tampering_is_rejected(self):
        (self.source / 'rocketvpn/app.js').write_bytes(b'different release')
        with self.assertRaisesRegex(ValueError, 'Source changed'):
            mod.inspect(self.source, self.target, self.manifest)

    def test_concurrent_write_rolls_back_only_our_earlier_change(self):
        a = self.target / 'rocketvpn/app.js'
        b = self.target / 'rocketvpn/other.js'
        b.write_bytes(b'changed concurrently')
        with self.assertRaisesRegex(ValueError, 'Concurrent edit'):
            mod.apply([(a, b'old', b'new', 0o644), (b, b'old other', b'new other', 0o644)])
        self.assertEqual(a.read_bytes(), b'old')
        self.assertEqual(b.read_bytes(), b'changed concurrently')


if __name__ == '__main__':
    unittest.main()
