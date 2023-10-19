const zlib = require('zlib');
const Pack = require('tar').Pack.Sync;
const fs = require('fs');
const path = require('path');

const sourceDir = './files';
const targetDir = './compressed';
const gzipFilename = 'files.tgz';
const brotliFilename = 'files.tar.br';
const logStream = fs.createWriteStream('./log.txt', { flags: 'a' });

const getSourceSize = () => {
  let totalSize = 0;
  const files = fs.readdirSync(sourceDir);
  files.forEach((file) => {
    totalSize += fs.statSync(path.join(sourceDir, file)).size;
  });
  return totalSize
};

const uncompressedSize = getSourceSize();

const init = () => {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir);
  }
};

init();

const compressDir = (sourceDir, targetDir, filename, gzip) => {
  const target = path.join(targetDir, filename);
  const writeStream = fs.createWriteStream(target);
  fs.readdir(sourceDir, (err, files) => {
    if (err) {
      console.error(`Error reading directory ${sourceDir}`);
      return;
    }
    const packOptions = {
      cwd: sourceDir,
    };
    if (gzip) {
      packOptions.gzip = true;
    } else {
      packOptions.brotli = true;
    }
    const pack = new Pack(packOptions);
    files.forEach((file) => {
      pack.write(file);
    });
    pack.end().pipe(writeStream);
  });
};

const logStats = (gzip, executionTime, filename = undefined) => {
  const compressionType = gzip ? 'Gzip' : 'Brotli';
  logStream.write(`\t${compressionType}\n`);
  if (filename) {
    const size = fs.statSync(path.join(targetDir, filename)).size;
    const ratio = (size / uncompressedSize) * 100;
    logStream.write(`\t\tCompressed Size: ${size} bytes\n`);
    logStream.write(`\t\tCompression Ratio: ${ratio.toFixed(2)}%\n`);
  }
  logStream.write(`\t\tExecution Time: ${executionTime.toFixed(4)} ms\n`);
};

const cleanup = (targetDir, intervalId = null) => {
  if (intervalId) {
    clearInterval(intervalId);
  }
  fs.readdir(targetDir, (err, files) => {
    if (err) {
      console.error(`Error reading directory ${targetDir}`);
      return;
    }
    files.forEach((file) => {
      fs.rm(path.join(targetDir, file), (err) => {
        if (err) {
        }
      });
    });
  });
};

const compress = (gzip) => {
  const filename = gzip ? gzipFilename : brotliFilename;
  const start = performance.now();
  compressDir(sourceDir, targetDir, filename, gzip);
  const time = performance.now() - start;
  return time;
};

const singleEventCompression = () => {
  logStream.write('Single event compression\n');
  const gzipTime = compress(true);
  const brotliTime = compress(false);

  setTimeout(() => {
    logStats(true, gzipTime, gzipFilename);
    logStats(false, brotliTime, brotliFilename);
    cleanup(targetDir);
  }, 10);
};

const multipleEventCompression = (seconds, eps) => {
  logStream.write('Multiple event compression\n');
  let totalEvents = 0;
  logStream.write(`\t${eps} events per second\n`);
  const targetEvents = eps * seconds;
  const intervalId = setInterval(() => {
    logStream.write(`\t  Event ${totalEvents + 1} of ${targetEvents}\n`);
    const gzipTime = compress(true);
    const brotliTime = compress(false);
    logStats(true, gzipTime);
    logStats(false, brotliTime);
    totalEvents += 1;
    if (totalEvents === targetEvents) {
      cleanup(targetDir, intervalId);
      totalEvents = 0;
      return;
    }
  }, 1000 / eps);
};

const benchmark = (seconds = 60, events = [10, 50, 100]) => {
  logStream.write('Compression Algorithms Benchmark\n');
  logStream.write(`  Uncompressed Files Size: ${uncompressedSize} bytes\n\n`);
  singleEventCompression();
  events.forEach((eps, index) => {
    setTimeout(() => {
      multipleEventCompression(seconds, eps);
    }, 1000 * seconds * index);
  });
};

benchmark();
