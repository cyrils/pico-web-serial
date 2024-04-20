let usbVendorId = 0x2E8A
let ascii = ['NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', '' /*ACK*/, 'BEL', 'BS', '\t', '\n', 'VT', 'FF', '', 'SO', 'SI', 'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB', '' /*CAN*/, 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US']
let asciiChars = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'
for (let i = 0; i < asciiChars.length; i++) ascii.push(asciiChars[i])
ascii.push('DEL')
for (let i = 0; i < 128; i++) ascii.push('.')
window.ascii = ascii
let readHandler = null

class PicoSerial {
  constructor() {
    this.pico = null;
    this.currentRead = [];
  }

  async start() {
    if (!navigator.serial) {
      alert("Your browser doesn't support connecting to the Pico (the web serial API)")
    } else {
      this.pico = await navigator.serial.requestPort({ filters: [{ usbVendorId }] })
      if (this.pico) await this.openPico()
    }
  }


  async stop() {
    //
  }

  async openPico() {
    if (this.pico) await this.pico.open({ baudRate: 115200 })
    console.log('Pico', this.pico)
    this.onConnect()
    this.log(`[Pico connected]\n\n`)
    this.reader = this.pico.readable.getReader()
    this.writer = this.pico.writable.getWriter()
    setTimeout(this.readFromPico.bind(this), 10)
    this.writeToPico('ls')
    this.pico.addEventListener('disconnect', this.onDisconnect)
  }

  onConnect() {
    this.clearLog()
    document.querySelectorAll(".hide").forEach(node => {
      node.classList.remove('hidden');
    })
    document.querySelector('#search').classList.add('hidden');
    document.querySelector('#restart').classList.add('hidden');
  }

  onDisconnect() {
    console.log('disconnect')
    this.log(`[Pico disconnected]\n\n`)
    this.pico = null
  }

  log(message) {
    let output = document.querySelector('#log');
    output.textContent += message;
    output.scrollTop = output.scrollHeight
  }

  clearLog() {
    document.querySelector('#log').textContent = '';
  }

  async readFromPico () {
    try {
      while (true) {
        const { value } = await this.reader.read()
        let arr = Array.from(value)
        for (let i = 0; i < arr.length; i++) {
          // deal with escape sequences (or at least, ignore them for now)
          if (arr[i] === 27) this.outputLine() // 27=ESC
          if (arr[i] === 67 && !this.currentRead.length) {
            this.currentRead.push(arr[i])
            this.outputLine()
          }
          else if (this.currentRead[0] === 27 && arr[i] === 109) { // eg ESC[0m to reset style
            this.outputLine()
          }
          else if (arr[i] === 67 && this.currentRead[0] === 27) {
            this.outputLine() // 67 = C used to escape an escape sequence(?)
          } else {
            if (arr[i] !== 6) this.currentRead.push(arr[i]) // 6=ACK
            let len = this.currentRead.length
            if (this.currentRead[len - 2] === 13 && this.currentRead[len - 1] === 10) {
              this.outputLine()
            }
          }
        }
        if (readHandler) readHandler(value)
      }
    } catch (e) {
      console.log('Read from Pico error', e)
    } finally {
      this.reader.releaseLock()
    }
  }

  outputLine () {
    if (this.currentRead[0] !== 27) {
      let text = `${ this.asciify(this.currentRead) }`
      if (text !== 'undefined') {
        this.log(`${ this.asciify(this.currentRead) }`)
      }
    } // else its an escape sequence which we ignore
    this.currentRead = []
  }

  asciify (val) {
    return val.map(v => ascii[v]).join('')
  }

  async writeToPico (data, type = 'text') {
    if (type === 'text') await this.writer.write((new TextEncoder()).encode(data + '\r'))
    else await this.writer.write(data) // Uint8Array
  }

  async restart() {
    // TODO
  }

  async saveData() {
    // TODO
  }

  async stop() {
    // TODO
  }
  

}

window.addEventListener('DOMContentLoaded', async () => {
  let app = new PicoSerial();

  document.querySelector("#search").addEventListener("click", async () => await app.start());
  document.querySelector("#disconnect").addEventListener("click", async () => await app.stop());
  document.querySelector("#restart").addEventListener("click", async () => await app.restart());
  document.querySelector("#save").addEventListener("click", async () => await app.saveData());

  window.addEventListener('beforeunload', async () => await app.stop())
});


// copied and edited from @KalumaJS/cli
// TODO: simplify the buffer stuff (just use Uint8Array)
let ymodem = (() => {
  const path = { basename: (filePath) => filePath.split('/').pop() }
  let Buffer = {
    from: (arr) => new Uint8Array(arr), // .buffer ?
    alloc: (size, fill = 0) => {
      if (fill) {
        let arr = []
        for (let i = 0; i < size; i++) arr.push(fill)
        return new Uint8Array(arr)
      } else {
        return new Uint8Array(size)
      }
    },
    copy: (source, target, targetStart = 0, sourceStart = 0, sourceEnd = source.length) => {
      for (let i = 0; sourceStart + i < sourceEnd; i++) {
        target[targetStart + i] = source[sourceStart + i]
      }
    },
    write: (target, string, offset = 0) => {
      let buf = (new TextEncoder()).encode(string) // .buffer ?
      Buffer.copy(buf, target, offset)
    },
    writeUInt16BE: (target, value, offset = 0) => {
      target[offset] = ((value >> 8) & 0xff) // 1st 8bits
      target[offset+1] = value & 0xff // 2nd 8bits
    }
  }

  // from crc16xmodem.js
  let crc16 = (() => {
    const crc16xmodem = defineCrc('xmodem', function(buf, previous) {
      let crc = typeof previous !== 'undefined' ? ~~previous : 0x0;
      for (let index = 0; index < buf.length; index++) {
        const byte = buf[index];
        let code = (crc >>> 8) & 0xff;
        code ^= byte & 0xff;
        code ^= code >>> 4;
        crc = (crc << 8) & 0xffff;
        crc ^= code;
        code = (code << 5) & 0xffff;
        crc ^= code;
        code = (code << 7) & 0xffff;
        crc ^= code;
      }
      return crc;
    });
    function defineCrc (model, calc) {
      const fn = (buf, previous) => calc(buf, previous) >>> 0;
      fn.signed = calc;
      fn.unsigned = fn;
      fn.model = model;
      return fn;
    }
    return crc16xmodem
  })()

  const PACKET_SIZE = 1024;
  const STX = 0x02; // start 1K=1024byte data packet
  const EOT = 0x04; // end of transmission
  const ACK = 0x06; // acknowledgement
  const NAK = 0x15; // negative acknowledgement
  const CAN = 0x18; // 24 two in a row aborts transfer
  const CRC16 = 0x43; // 0d67 "C", request 16-bit CRC

    // Make file header payload from file path and size
  function makeFileHeader(filePath, fileSize) {
    var payload = Buffer.alloc(PACKET_SIZE, 0x00);
    var offset = 0;
    if (filePath) {
      var filename = filePath.split('/').pop();
      Buffer.write(payload, filename, offset);
      offset = filename.length + 1;
    }
    if (fileSize) {
      Buffer.write(payload, fileSize.toString() + " ", offset);
    }
    return payload;
  }

  // Split buffer into multiple smaller buffers of the given size
  function splitBuffer(buffer, size, fixedSize) {
    if (buffer.byteLength > size) {
      var array = [];
      var start = 0;
      var end = start + size - 1;
      while (start < buffer.byteLength) {
        if (end >= buffer.byteLength) {
          end = buffer.byteLength - 1;
        }
        var chunk = Buffer.alloc(fixedSize || end - start + 1, 0xff);
        Buffer.copy(buffer, chunk, 0, start, end + 1);
        array.push(chunk);
        start = start + size;
        end = start + size - 1;
      }
      return array;
    } else {
      var buf = Buffer.alloc(fixedSize || size, 0xff);
      Buffer.copy(buffer, buf, 0, 0, buffer.byteLength);
      return [buf];
    }
  }

  // Transfer a file to serial port using ymodem protocol
  async function transfer(filename, buffer, callback, progressCallback) {
    var queue = [];
    var totalBytes = 0;
    var writtenBytes = 0;
    var seq = 0;
    var session = false;
    var sending = false;
    var finished = false;

    // Send buffer to the Pico
    function sendBuffer(buffer) {
      var chunks = splitBuffer(buffer, 256);
      chunks.forEach(async (chunk) => {
        // console.log('OUT', chunk)
        // output.textContent += `\n\nOUT: \n${asciify(chunk)}`
        await writeToPico(chunk, 'buffer')
        // serial.drain((err) => err ? close() : false)
      });
    }

    // Send packet
    function sendPacket() {
      if (seq < queue.length) {
        // make a packet (3 for packet header, YModem.PACKET_SIZE for payload, 2 for crc16)
        var packet = Buffer.alloc(3 + PACKET_SIZE + 2);
        // header
        packet[0] = STX;
        packet[1] = seq;
        packet[2] = 0xff - packet[1];
        // payload
        var payload = queue[seq];
        Buffer.copy(payload, packet, 3)
        var crc = crc16(payload);
        Buffer.writeUInt16BE(packet, crc, packet.byteLength - 2);
        // send
        sendBuffer(packet);
      } else {
        // send EOT
        if (sending) sendBuffer(Buffer.from([EOT]));
      }
    }

    // Handler for data from Ymodem
    function handler (data) {
      for (var i = 0; i < data.byteLength; i++) {
        if (!finished) {
          var ch = data[i];
          if (ch === CRC16) {
            if (!sending) {
              sendPacket();
              sending = true;
            }
          } else if (ch === ACK) {
            if (!session) {
              close();
            }
            if (sending) {
              if (seq < queue.length) {
                if (writtenBytes < totalBytes) {
                  writtenBytes = (seq + 1) * PACKET_SIZE;
                  if (writtenBytes > totalBytes) {
                    writtenBytes = totalBytes;
                  }
                  if (progressCallback) {
                    progressCallback({
                      writtenBytes: writtenBytes,
                      totalBytes: totalBytes,
                    });
                  }
                }
                seq++;
                sendPacket();
              } else {
                // send complete
                if (session) {
                  // file sent successfully
                }
                sending = false;
                session = false;
                // send null header for end of session
                var endsession = Buffer.alloc(PACKET_SIZE + 5, 0x00);
                endsession[0] = STX;
                endsession[1] = 0x00;
                endsession[2] = 0xff;
                sendBuffer(endsession);
              }
            }
          } else if (ch === NAK) {
            sendPacket();
          } else if (ch === CAN) {
            close();
          }
        }
      }
    }

    // Finish transmittion
    function close(err) {
      readHandler = null
      session = false;
      sending = false;
      if (!finished && callback) {
        if (err) {
          callback(err);
        } else {
          callback(null, {
            filePath: filename,
            totalBytes: totalBytes,
            writtenBytes: writtenBytes,
          });
        }
      }
      finished = true;
    }

    // Make file header payload
    totalBytes = buffer.byteLength;
    var headerPayload = makeFileHeader(filename, totalBytes);
    queue.push(headerPayload);

    // Make file data packets
    var payloads = splitBuffer(buffer, PACKET_SIZE, PACKET_SIZE);
    payloads.forEach((payload) => queue.push(payload));

    // Start to transfer
    session = true;

    // Listen to data coming from the Pico's ymodem implementation
    readHandler = handler
  }

  return { transfer }
})()