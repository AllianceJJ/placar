param([string]$Raiz, [int]$Porta = 8765)
# Servidor estatico minimo para o harness: GET le arquivo, PUT grava o corpo no arquivo.
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Porta/")
$l.Start()
Write-Output "servindo $Raiz em http://localhost:$Porta/"
$tipos = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.json'='application/json; charset=utf-8'; '.txt'='text/plain; charset=utf-8' }
while ($l.IsListening) {
  $c = $l.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
    if (-not $rel) { $rel = 'index.html' }
    $arq = Join-Path $Raiz $rel
    $c.Response.Headers.Add('Access-Control-Allow-Origin', '*')
    $c.Response.Headers.Add('Cache-Control', 'no-store')
    if ($c.Request.HttpMethod -eq 'PUT' -or $c.Request.HttpMethod -eq 'POST') {
      $dir = Split-Path $arq -Parent
      if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
      $fs = [IO.File]::Create($arq)
      $c.Request.InputStream.CopyTo($fs)
      $fs.Close()
      $b = [Text.Encoding]::UTF8.GetBytes('ok')
      $c.Response.OutputStream.Write($b, 0, $b.Length)
    } elseif (Test-Path $arq -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($arq).ToLower()
      $c.Response.ContentType = $(if ($tipos[$ext]) { $tipos[$ext] } else { 'application/octet-stream' })
      $b = [IO.File]::ReadAllBytes($arq)
      $c.Response.ContentLength64 = $b.Length
      $c.Response.OutputStream.Write($b, 0, $b.Length)
    } else {
      $c.Response.StatusCode = 404
    }
  } catch { $c.Response.StatusCode = 500 }
  finally { $c.Response.Close() }
}
