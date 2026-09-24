set -e
FF=/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2
D=(11 9 8 11 9 11); X=0.8
for i in 0 1 2 3 4 5; do
  $FF -y -loglevel error -framerate 30 -i frames/s$i/f%05d.jpg -c:v libx264 -preset medium -crf 15 -pix_fmt yuv420p -r 30 v$i.mp4
done
# xfade chain offsets: cumulative(len) - X each step
o1=$(python3 -c "print(${D[0]}-$X)"); L=$(python3 -c "print(${D[0]}+${D[1]}-$X)")
o2=$(python3 -c "print($L-$X)"); L=$(python3 -c "print($L+${D[2]}-$X)")
o3=$(python3 -c "print($L-$X)"); L=$(python3 -c "print($L+${D[3]}-$X)")
o4=$(python3 -c "print($L-$X)"); L=$(python3 -c "print($L+${D[4]}-$X)")
o5=$(python3 -c "print($L-$X)"); L=$(python3 -c "print($L+${D[5]}-$X)")
echo "total $L s"
$FF -y -loglevel error -i v0.mp4 -i v1.mp4 -i v2.mp4 -i v3.mp4 -i v4.mp4 -i v5.mp4 -filter_complex \
"[0][1]xfade=transition=fade:duration=$X:offset=$o1[a];[a][2]xfade=transition=fade:duration=$X:offset=$o2[b];[b][3]xfade=transition=fade:duration=$X:offset=$o3[c];[c][4]xfade=transition=fade:duration=$X:offset=$o4[d];[d][5]xfade=transition=fade:duration=$X:offset=$o5,format=yuv420p[v]" \
-map "[v]" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart -r 30 phils_auto_3d_walkthrough.mp4
$FF -i phils_auto_3d_walkthrough.mp4 2>&1 | grep -E "Duration|Stream"
