param([Parameter(Mandatory=$true)][string]$Source)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetRoot = Join-Path $PSScriptRoot '../public'
$sourceImage = [Drawing.Image]::FromFile((Resolve-Path -LiteralPath $Source))
$assets = @{ 'rajaudios-logo.png' = 256; 'favicon-32.png' = 32; 'apple-touch-icon.png' = 180; 'icon-192.png' = 192; 'icon-512.png' = 512 }
foreach ($asset in $assets.GetEnumerator()) {
  $bitmap = New-Object Drawing.Bitmap($asset.Value, $asset.Value)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.DrawImage($sourceImage, 0, 0, $asset.Value, $asset.Value)
  $outputPath = if ($asset.Key -eq 'rajaudios-logo.png') { Join-Path $PSScriptRoot '../public/rajaudios-logo.png' } else { Join-Path $assetRoot $asset.Key }
  $bitmap.Save($outputPath, [Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}
$sourceImage.Dispose()
$iconSizes = @(16, 32, 48)
$iconImages = @()
foreach ($size in $iconSizes) {
  $sourceImage = [Drawing.Image]::FromFile((Join-Path $assetRoot 'icon-512.png'))
  $bitmap = New-Object Drawing.Bitmap($size, $size)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
  $stream = New-Object IO.MemoryStream
  $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
  $iconImages += ,$stream.ToArray()
  $stream.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
  $sourceImage.Dispose()
}
$iconStream = [IO.File]::Create((Join-Path $assetRoot 'favicon.ico'))
$writer = New-Object IO.BinaryWriter($iconStream)
$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]3)
$offset = 6 + 16 * 3
for ($i = 0; $i -lt 3; $i++) {
  $writer.Write([byte]$iconSizes[$i])
  $writer.Write([byte]$iconSizes[$i])
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([uint16]1)
  $writer.Write([uint16]32)
  $writer.Write([uint32]$iconImages[$i].Length)
  $writer.Write([uint32]$offset)
  $offset += $iconImages[$i].Length
}
foreach ($bytes in $iconImages) { $writer.Write([byte[]]$bytes) }
$writer.Dispose()
