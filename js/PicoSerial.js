const VENDOR_ID = 0x2E8A

class PicoSerial {
  constructor(onConnect, onDisconnect, logger) {
    this.picoPort = null
    this.reading = false
    this.textDecoder = new TextDecoder()
    this.textEncoder = new TextEncoder()
    this.commandExecutor = new CommandExecutor(this)
    this.connectCallback = onConnect
    this.disconnectCallback = onDisconnect
    this.logger = logger
  }

  async connect() {
    if (!navigator.serial) {
      alert("Your browser doesn't support connecting to the Pico (Web Serial API)")
    } else {
      if (!this.picoPort) this.picoPort = await navigator.serial.requestPort({ filters: [{ usbVendorId: VENDOR_ID }] })
      if (this.picoPort) await this.openPico()
    }
  }

  async openPico() {
    if (this.picoPort) await this.picoPort.open({ baudRate: 115200 })
    this.onConnect()
    this.reader = this.picoPort.readable.getReader()
    this.writer = this.picoPort.writable.getWriter()
    setTimeout(this.readFromPico.bind(this), 10)
    this.picoPort.addEventListener('disconnect', this.onDisconnect.bind(this))
  }

  onConnect() {
    this.connectCallback()
  }

  onDisconnect() {
    this.picoPort = null
    this.disconnectCallback()
  }

  async readFromPico() {
    this.reading = true
    try {
      while (this.reading) {
        const { value } = await this.reader.read()
        const stringValue = this.textDecoder.decode(value)
        this.commandExecutor.streamer(stringValue)
        this.logger(stringValue)
      }
    } catch (e) {
      console.log('Read from Pico error', e)
    }
  }

  async writeIntoPico(str) {
    const buffer = this.textEncoder.encode(str)
    console.log('writing to pico')
    await this.writer.write(buffer)
  }

  async disconnect() {
    this.reading = false
    await this.reader.cancel()
    await this.reader.releaseLock()
    await this.writer.close()
    await this.writer.releaseLock()
    await this.picoPort.close()
    this.onDisconnect()
  }

  listFiles(dir, callback) {
    this.commandExecutor.execListDir(dir, callback)
  }

  readFile(file, callback) {
    this.commandExecutor.execReadFile(file, (base64Data) => {
        if (typeof base64Data === 'string' && !base64Data.includes('OSError:')) {
            try {
                callback(base64ToText(base64Data));
            } catch (e) {
                console.error("Failed to decode base64 file:", e);
                callback(base64Data);
            }
        } else {
            callback(base64Data);
        }
    })
  }

  saveFile(file, content, callback) {
    this.commandExecutor.execWriteFile(file, content, callback)
  }

  stopDevice(callback) {
    this.commandExecutor.execInterrupt(callback)
  }

  rebootDevice(callback) {
    this.commandExecutor.execReboot(callback)
  }

  createFile(name, callback) {
    this.commandExecutor.execCreateFile(name, callback)
  }

  createFolder(name, callback) {
    this.commandExecutor.execCreateFolder(name, callback)
  }

  deleteFile(name, callback) {
    this.commandExecutor.execDeleteFile(name, callback)
  }

  renameFile(srcPath, targetPath, callback) {
    this.commandExecutor.execRenameFile(srcPath, targetPath, callback)
  }

  deleteAllRecursive(path, callback) {
    this.commandExecutor.execDeleteAllRecursive(path, callback)
  }

  async uploadFile(targetPath, arrayBuffer) {
    const base64Data = arrayBufferToBase64(arrayBuffer);
    await this.commandExecutor.writeBase64File(targetPath, base64Data);
  }

  async createFolderRecursive(path) {
    await this.commandExecutor.execCreateFolderRecursive(path);
  }
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToText(base64) {
    const binaryString = window.atob(base64.trim());
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
}