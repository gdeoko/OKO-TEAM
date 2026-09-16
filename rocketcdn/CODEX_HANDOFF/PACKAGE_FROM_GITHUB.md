# Full Rocket CDN package stored in this branch

The complete handoff ZIP is stored as numbered binary parts in:

`rocketcdn/CODEX_HANDOFF/package-parts/`

Expected archive:

- name: `RocketCDN_Codex_Package_2026-08-22.zip`
- SHA-256: `b19fcced34d9ff42c86fa318698b87a0cea69394e162b69d38f75a67e266f680`
- size: `39,731,625` bytes

## Linux / macOS

```bash
git clone --branch codex/rocketcdn-handoff-20260822 --single-branch https://github.com/gdeoko/OKO-TEAM.git
cd OKO-TEAM/rocketcdn/CODEX_HANDOFF/package-parts
cat RocketCDN_Codex_Package_2026-08-22.zip.part-* > ../RocketCDN_Codex_Package_2026-08-22.zip
cd ..
printf '%s  %s\n' 'b19fcced34d9ff42c86fa318698b87a0cea69394e162b69d38f75a67e266f680' 'RocketCDN_Codex_Package_2026-08-22.zip' | sha256sum -c -
unzip -q RocketCDN_Codex_Package_2026-08-22.zip
```

On macOS, if `sha256sum` is unavailable:

```bash
test "$(shasum -a 256 RocketCDN_Codex_Package_2026-08-22.zip | awk '{print $1}')" = 'b19fcced34d9ff42c86fa318698b87a0cea69394e162b69d38f75a67e266f680'
```

## Windows PowerShell

```powershell
git clone --branch codex/rocketcdn-handoff-20260822 --single-branch https://github.com/gdeoko/OKO-TEAM.git
Set-Location OKO-TEAM\rocketcdn\CODEX_HANDOFF\package-parts
$output = [System.IO.File]::Create((Join-Path (Split-Path (Get-Location) -Parent) 'RocketCDN_Codex_Package_2026-08-22.zip'))
try {
  Get-ChildItem 'RocketCDN_Codex_Package_2026-08-22.zip.part-*' |
    Sort-Object Name |
    ForEach-Object {
      $input = [System.IO.File]::OpenRead($_.FullName)
      try { $input.CopyTo($output) } finally { $input.Dispose() }
    }
} finally { $output.Dispose() }
Set-Location ..
$hash = (Get-FileHash .\RocketCDN_Codex_Package_2026-08-22.zip -Algorithm SHA256).Hash.ToLower()
if ($hash -ne 'b19fcced34d9ff42c86fa318698b87a0cea69394e162b69d38f75a67e266f680') { throw "SHA-256 mismatch: $hash" }
Expand-Archive .\RocketCDN_Codex_Package_2026-08-22.zip -DestinationPath .
```

## Important

The package intentionally contains no secret values, private keys, passwords, session cookies, or live tokens. It contains the exact variable names, public endpoints, account identifiers, paths, validation commands, and procedures needed to obtain or inject secrets through the authorized service account or secret store.
