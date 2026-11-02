#!/bin/sh
# Regenerates the Android launcher icons and splash screens from the SVGs in this folder (needs ImageMagick)
set -e
cd "$(dirname "$0")"
RES=../android/app/src/main/res
render() { magick -background none -density 600 "$1" -resize "$2x$2" "$3"; }
for pair in mdpi:48:108 hdpi:72:162 xhdpi:96:216 xxhdpi:144:324 xxxhdpi:192:432; do
  d=${pair%%:*}; rest=${pair#*:}; legacy=${rest%%:*}; fg=${rest#*:}
  render icon.svg "$legacy" "$RES/mipmap-$d/ic_launcher.png"
  render round.svg "$legacy" "$RES/mipmap-$d/ic_launcher_round.png"
  render foreground.svg "$fg" "$RES/mipmap-$d/ic_launcher_foreground.png"
done
# Splash: the bars centred on the app's dark ink, at every size Capacitor ships
for f in $(cd "$RES" && ls drawable*/splash.png); do
  size=$(magick identify -format '%wx%h' "$RES/$f")
  w=${size%x*}; h=${size#*x}; s=$(( (w < h ? w : h) * 80 / 100 ))
  magick -size "${w}x${h}" xc:'#18213a' \( -background none -density 600 foreground.svg -resize "${s}x${s}" \) -gravity center -composite "$RES/$f"
done
echo "Icons and splash screens written to $RES"
