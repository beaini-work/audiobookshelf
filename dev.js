// Using port 3333 is important when running the client web app separately
const Path = require('path')
module.exports.config = {
  Port: 3333,
  ConfigPath: Path.resolve('config'),
  MetadataPath: Path.resolve('metadata'),
  FFmpegPath: process.platform === 'darwin' ? '/usr/local/bin/ffmpeg' : '/usr/bin/ffmpeg',
  FFProbePath: process.platform === 'darwin' ? '/usr/local/bin/ffprobe' : '/usr/bin/ffprobe',
  SkipBinariesCheck: false
}
