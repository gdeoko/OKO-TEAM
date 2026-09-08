"""Deployment failure tests use temporary synthetic sites; no network or services."""
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest


class FollowupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        spec = importlib.util.spec_from_file_location('followup', Path(__file__).with_name('followup.py'))
        self.app = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.app)
        a = self.app
        root = Path(self.temp.name)
        a.SOURCE, a.WEB = root / 'source', root / 'web'
        a.BASE, a.RELEASE = a.WEB / 'r2', a.WEB / 'r3'
        (a.SOURCE / 'deploy').mkdir(parents=True)
        (a.SOURCE / 'deploy/followup.py').write_text('# fixture')
        self.data = root / 'records.json'
        self.data.write_text('{"customer":"preserved"}')
        rows = []
        for site in a.SITES:
            for directory, text in ((a.BASE, 'old'), (a.SOURCE, 'new')):
                (directory / site).mkdir(parents=True)
                (directory / site / 'index.html').write_text(text)
            (a.WEB / site).symlink_to(a.BASE / site)
            (a.BASE / site / 'data').symlink_to(self.data)
            rows.append({'path': site + '/index.html', 'base_sha256': a.digest(a.BASE / site / 'index.html'),
                         'sha256': a.digest(a.SOURCE / site / 'index.html')})
        (a.SOURCE / 'deploy/followup-manifest.json').write_text(json.dumps({'files': rows}))
        def run(*args):
            if args[:2] == ('cp', '-a'):
                shutil.copytree(args[2], args[3], symlinks=True)
            else:
                self.assertIn(args, [('nginx', '-t'), ('systemctl', 'reload', 'php8.3-fpm')])
        a.run = run

    def test_prepare_preserves_active_roots_and_external_records(self):
        a = self.app
        a.prepare()
        a.active_at(a.BASE)
        a.verify(a.RELEASE, 'sha256')
        self.assertTrue((a.RELEASE / 'rocketcdn/data').is_symlink())
        self.assertEqual(self.data.read_text(), '{"customer":"preserved"}')

    def test_failed_health_restores_both_roots(self):
        a = self.app
        a.prepare()
        def fail():
            a.active_at(a.RELEASE)
            raise RuntimeError('synthetic failed HTTP check')
        a.health = fail
        with self.assertRaisesRegex(RuntimeError, 'failed HTTP'):
            a.activate()
        a.active_at(a.BASE)
        self.assertEqual(self.data.read_text(), '{"customer":"preserved"}')

    def test_changed_live_file_blocks_activation(self):
        a = self.app
        a.prepare()
        (a.BASE / 'rocketvpn/index.html').write_text('client update')
        with self.assertRaisesRegex(RuntimeError, 'differs'):
            a.activate()
        a.active_at(a.BASE)

    def test_runtime_or_traversal_entries_are_rejected(self):
        a = self.app
        for name in ('rocketcdn/config.local.php', '../escape.html', 'rocketvpn/../escape.js'):
            (a.SOURCE / 'deploy/followup-manifest.json').write_text(json.dumps({'files': [{'path': name}]}))
            with self.assertRaises(RuntimeError):
                a.records()


if __name__ == '__main__':
    unittest.main()
